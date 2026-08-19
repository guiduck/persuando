import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electron = require("electron") as typeof import("electron");
const { contextBridge, ipcRenderer } = electron;

export interface CaptureRuntimeState {
  activeSessionId?: string;
  endedAt?: string;
  error?: string;
  listening: boolean;
  paused: boolean;
  startedAt?: string;
  status: "idle" | "active" | "paused" | "revoked" | "error" | "ended" | "reconnecting";
  toolbarVisible: boolean;
}

export interface PersuandoCaptureApi {
  captureScreenImage(): Promise<{ dataUrl: string; sourceLabel: string }>;
  getAuthUser(): Promise<{ id: string; email: string; displayName: string; provider: "google" | "local-dev" } | undefined>;
  getState(): Promise<CaptureRuntimeState>;
  hideToolbar(): Promise<void>;
  loginWithGoogle(loginUrl: string): Promise<{ id: string; email: string; displayName: string; provider: "google" | "local-dev" } | undefined>;
  onCommand(listener: (command: string) => void): () => void;
  onState(listener: (state: CaptureRuntimeState) => void): () => void;
  setListening(listening: boolean): Promise<CaptureRuntimeState>;
  setPaused(paused: boolean): Promise<CaptureRuntimeState>;
  setStatus(patch: Partial<CaptureRuntimeState>): Promise<CaptureRuntimeState>;
  showDashboard(): Promise<void>;
  showToolbar(): Promise<void>;
  stopPeriodicScreenContext(): Promise<void>;
  startPeriodicScreenContext(): Promise<void>;
}

const api: PersuandoCaptureApi = {
  captureScreenImage: () => ipcRenderer.invoke("capture:capture-screen-image") as Promise<{ dataUrl: string; sourceLabel: string }>,
  getAuthUser: () => ipcRenderer.invoke("capture:get-auth-user") as Promise<
    { id: string; email: string; displayName: string; provider: "google" | "local-dev" } | undefined
  >,
  getState: () => ipcRenderer.invoke("capture:get-state") as Promise<CaptureRuntimeState>,
  hideToolbar: () => ipcRenderer.invoke("capture:hide-toolbar") as Promise<void>,
  loginWithGoogle: (loginUrl) =>
    ipcRenderer.invoke("capture:login-google", loginUrl) as Promise<
      { id: string; email: string; displayName: string; provider: "google" | "local-dev" } | undefined
    >,
  onState(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, state: CaptureRuntimeState) => listener(state);
    ipcRenderer.on("capture:state", wrapped);
    return () => ipcRenderer.off("capture:state", wrapped);
  },
  onCommand(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, command: string) => listener(command);
    ipcRenderer.on("capture:command", wrapped);
    return () => ipcRenderer.off("capture:command", wrapped);
  },
  setListening: (listening) => ipcRenderer.invoke("capture:set-listening", listening) as Promise<CaptureRuntimeState>,
  setPaused: (paused) => ipcRenderer.invoke("capture:set-paused", paused) as Promise<CaptureRuntimeState>,
  setStatus: (patch) => ipcRenderer.invoke("capture:set-status", patch) as Promise<CaptureRuntimeState>,
  showDashboard: () => ipcRenderer.invoke("capture:show-dashboard") as Promise<void>,
  showToolbar: () => ipcRenderer.invoke("capture:show-toolbar") as Promise<void>,
  startPeriodicScreenContext: () => ipcRenderer.invoke("capture:start-periodic-screen-context") as Promise<void>,
  stopPeriodicScreenContext: () => ipcRenderer.invoke("capture:stop-periodic-screen-context") as Promise<void>
};

contextBridge.exposeInMainWorld("persuandoCapture", api);
