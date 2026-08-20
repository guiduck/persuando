import type {
  BrowserWindow as ElectronBrowserWindow,
  Event as ElectronEvent,
  IpcMainInvokeEvent,
  Tray as ElectronTray
} from "electron";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electron = require("electron") as typeof import("electron");
const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, Tray } = electron;
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.CAPTURE_RENDERER_URL !== undefined;
const preloadPath = resolve(__dirname, "../../preload.cjs");

let dashboardWindow: ElectronBrowserWindow | undefined;
let toolbarWindow: ElectronBrowserWindow | undefined;
let authWindow: ElectronBrowserWindow | undefined;
let tray: ElectronTray | undefined;
let appIsQuitting = false;
let authCookieUrl = process.env.PERSUANDO_API_BASE_URL ?? "http://localhost:4000";

interface CaptureAuthUser {
  id: string;
  email: string;
  displayName: string;
  provider: "google" | "local-dev";
}

function log(message: string): void {
  try {
    console.log(`[Persuando Capture] ${message}`);
  } catch {
    // Some launch paths close stdout after spawning Electron; keep the UI running.
  }
}

interface CaptureRuntimeState {
  activeSessionId?: string;
  endedAt?: string;
  error?: string;
  listening: boolean;
  paused: boolean;
  startedAt?: string;
  status: "idle" | "active" | "paused" | "revoked" | "error" | "ended" | "reconnecting";
  toolbarVisible: boolean;
}

const runtimeState: CaptureRuntimeState = {
  listening: false,
  paused: false,
  status: "idle",
  toolbarVisible: true
};

async function createWindows(): Promise<void> {
  log("Creating dashboard and toolbar windows.");
  dashboardWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    title: "Persuando Capture",
    center: true,
    show: true,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: false
    }
  });
  dashboardWindow.on("ready-to-show", () => {
    log("Dashboard ready to show.");
    dashboardWindow?.show();
    dashboardWindow?.focus();
    dashboardWindow?.moveTop();
  });
  dashboardWindow.webContents.on("did-fail-load", (_event: ElectronEvent, errorCode: number, errorDescription: string) => {
    log(`Dashboard failed to load: ${errorCode} ${errorDescription}`);
  });

  dashboardWindow.on("close", (event: ElectronEvent) => {
    if (!appIsQuitting) {
      event.preventDefault();
      dashboardWindow?.hide();
    }
  });

  toolbarWindow = new BrowserWindow({
    width: 680,
    height: 74,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    alwaysOnTop: true,
    title: "Persuando Toolbar",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: false
    }
  });
  toolbarWindow.webContents.on("did-fail-load", (_event: ElectronEvent, errorCode: number, errorDescription: string) => {
    log(`Toolbar failed to load: ${errorCode} ${errorDescription}`);
  });

  await Promise.all([loadRenderer(dashboardWindow, "/dashboard"), loadRenderer(toolbarWindow, "/toolbar")]);
  log("Renderer loaded.");
  dashboardWindow.show();
  dashboardWindow.focus();
  dashboardWindow.moveTop();
  toolbarWindow.show();
}

function createTray(): void {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Persuando Capture");
  tray.on("click", () => showToolbar());
  updateTrayMenu();
}

async function loadRenderer(window: ElectronBrowserWindow, route: string): Promise<void> {
  if (isDev) {
    log(`Loading dev renderer route ${route}.`);
    await window.loadURL(`${process.env.CAPTURE_RENDERER_URL}${route}`);
    return;
  }

  log(`Loading built renderer route ${route}.`);
  await window.loadFile(resolve(__dirname, "../renderer/index.html"), { hash: route });
}

function showDashboard(): void {
  dashboardWindow?.show();
  dashboardWindow?.focus();
}

function showToolbar(): void {
  runtimeState.toolbarVisible = true;
  toolbarWindow?.show();
  toolbarWindow?.focus();
  broadcastState();
}

function hideToolbar(): void {
  runtimeState.toolbarVisible = false;
  toolbarWindow?.hide();
  broadcastState();
}

function sendCommand(command: string): void {
  const target = toolbarWindow && !toolbarWindow.isDestroyed() ? toolbarWindow : dashboardWindow;
  target?.webContents.send("capture:command", command);
}

function broadcastState(): void {
  updateTrayMenu();
  for (const window of [dashboardWindow, toolbarWindow]) {
    window?.webContents.send("capture:state", runtimeState);
  }
}

async function capturePrimaryScreenImage(): Promise<{ dataUrl: string; sourceLabel: string }> {
  log("Screen capture requested.");
  const sources = await desktopCapturer.getSources({
    thumbnailSize: { width: 1440, height: 900 },
    types: ["screen"]
  });
  const source = sources.find((item) => !item.thumbnail.isEmpty()) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    log(`Screen capture unavailable: sources=${sources.length}.`);
    throw new Error("No screen source available for capture.");
  }
  const dataUrl = source.thumbnail.toDataURL();
  log(`Screen capture completed: source=${source.name} sources=${sources.length} dataUrlLength=${dataUrl.length}.`);
  return {
    dataUrl,
    sourceLabel: source.name
  };
}

async function readAuthUserFromCookie(): Promise<CaptureAuthUser | undefined> {
  const candidateUrls = Array.from(new Set([authCookieUrl, process.env.PERSUANDO_API_BASE_URL, "https://api-persuando.gfig.space", "http://localhost:4000"].filter((url): url is string => Boolean(url))));
  for (const url of candidateUrls) {
    const cookies = await electron.session.defaultSession.cookies.get({ name: "persuando_user", url });
    const token = cookies[0]?.value;
    if (!token) continue;
    const payload = token.split(".")[0];
    if (!payload) continue;
    try {
      const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CaptureAuthUser;
      if (user?.id && user?.email) {
        authCookieUrl = url;
        return user;
      }
    } catch {
      // Ignore malformed auth cookies and keep looking at the next configured API origin.
    }
  }
  return undefined;
}
function loginWithGoogle(loginUrl: string): Promise<CaptureAuthUser | undefined> {
  return new Promise((resolveLogin, rejectLogin) => {
    const loginOrigin = new URL(loginUrl).origin;
    authCookieUrl = loginOrigin;
    authWindow?.close();
    toolbarWindow?.hide();
    authWindow = new BrowserWindow({
      width: 720,
      height: 760,
      parent: dashboardWindow,
      modal: false,
      title: "Persuando Google Sign In",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    let completed = false;
    const finish = async () => {
      if (completed) return;
      completed = true;
      const user = await readAuthUserFromCookie();
      authWindow?.close();
      authWindow = undefined;
      if (runtimeState.toolbarVisible) toolbarWindow?.show();
      resolveLogin(user);
    };

    authWindow.webContents.on("did-finish-load", () => {
      const url = authWindow?.webContents.getURL() ?? "";
      const currentUrl = new URL(url);
      if (currentUrl.origin === loginOrigin && currentUrl.pathname === "/auth/google/callback") finish();
    });
    authWindow.webContents.on("did-fail-load", (_event: ElectronEvent, _errorCode: number, errorDescription: string) => {
      if (completed) return;
      completed = true;
      authWindow?.close();
      authWindow = undefined;
      if (runtimeState.toolbarVisible) toolbarWindow?.show();
      rejectLogin(new Error(errorDescription));
    });
    authWindow.on("closed", () => {
      authWindow = undefined;
      if (runtimeState.toolbarVisible) toolbarWindow?.show();
      if (!completed) resolveLogin(undefined);
    });
    authWindow.loadURL(loginUrl).catch(rejectLogin);
  });
}

function updateTrayMenu(): void {
  if (!tray) return;
  const status = runtimeState.status;
  tray.setToolTip(`Persuando Capture - ${status}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { enabled: false, label: `Status: ${status}` },
      { label: runtimeState.toolbarVisible ? "Hide toolbar" : "Show toolbar", click: () => (runtimeState.toolbarVisible ? hideToolbar() : showToolbar()) },
      { label: "Open dashboard", click: () => showDashboard() },
      { type: "separator" },
      { label: runtimeState.listening ? "End session" : "Start listening", click: () => sendCommand(runtimeState.listening ? "end-session" : "start-listening") },
      {
        enabled: runtimeState.listening,
        label: runtimeState.paused ? "Resume capture" : "Pause capture",
        click: () => sendCommand(runtimeState.paused ? "resume-capture" : "pause-capture")
      },
      { enabled: runtimeState.listening, label: "Capture context", click: () => sendCommand("capture-context") },
      { enabled: runtimeState.listening, label: "Revoke capture", click: () => sendCommand("revoke-capture") },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          appIsQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

ipcMain.handle("capture:get-state", () => runtimeState);
ipcMain.handle("capture:show-dashboard", () => showDashboard());
ipcMain.handle("capture:show-toolbar", () => showToolbar());
ipcMain.handle("capture:hide-toolbar", () => hideToolbar());
ipcMain.handle("capture:start-periodic-screen-context", () => sendCommand("start-periodic-screen-context"));
ipcMain.handle("capture:stop-periodic-screen-context", () => sendCommand("stop-periodic-screen-context"));
ipcMain.handle("capture:login-google", (_event, loginUrl: string) => loginWithGoogle(loginUrl));
ipcMain.handle("capture:get-auth-user", () => readAuthUserFromCookie());
ipcMain.handle("capture:capture-screen-image", () => capturePrimaryScreenImage());
ipcMain.handle("capture:set-listening", (_event: IpcMainInvokeEvent, listening: boolean) => {
  runtimeState.listening = listening;
  runtimeState.paused = false;
  runtimeState.status = listening ? "active" : "ended";
  runtimeState.startedAt = listening ? new Date().toISOString() : runtimeState.startedAt;
  runtimeState.endedAt = listening ? undefined : new Date().toISOString();
  broadcastState();
  return runtimeState;
});
ipcMain.handle("capture:set-paused", (_event: IpcMainInvokeEvent, paused: boolean) => {
  runtimeState.paused = paused;
  runtimeState.status = paused ? "paused" : "active";
  broadcastState();
  return runtimeState;
});
ipcMain.handle("capture:set-status", (_event: IpcMainInvokeEvent, patch: Partial<CaptureRuntimeState>) => {
  Object.assign(runtimeState, patch);
  broadcastState();
  return runtimeState;
});

await app.whenReady();
log("Electron app is ready.");
createTray();
await createWindows();

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindows();
});

app.on("before-quit", () => {
  appIsQuitting = true;
});
