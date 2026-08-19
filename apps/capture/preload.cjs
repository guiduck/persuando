const { contextBridge, ipcRenderer } = require("electron");

const api = {
  captureScreenImage: () => ipcRenderer.invoke("capture:capture-screen-image"),
  getAuthUser: () => ipcRenderer.invoke("capture:get-auth-user"),
  getState: () => ipcRenderer.invoke("capture:get-state"),
  hideToolbar: () => ipcRenderer.invoke("capture:hide-toolbar"),
  loginWithGoogle: (loginUrl) => ipcRenderer.invoke("capture:login-google", loginUrl),
  onCommand(listener) {
    const wrapped = (_event, command) => listener(command);
    ipcRenderer.on("capture:command", wrapped);
    return () => ipcRenderer.off("capture:command", wrapped);
  },
  onState(listener) {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("capture:state", wrapped);
    return () => ipcRenderer.off("capture:state", wrapped);
  },
  setListening: (listening) => ipcRenderer.invoke("capture:set-listening", listening),
  setPaused: (paused) => ipcRenderer.invoke("capture:set-paused", paused),
  setStatus: (patch) => ipcRenderer.invoke("capture:set-status", patch),
  showDashboard: () => ipcRenderer.invoke("capture:show-dashboard"),
  showToolbar: () => ipcRenderer.invoke("capture:show-toolbar")
};

contextBridge.exposeInMainWorld("persuandoCapture", api);
