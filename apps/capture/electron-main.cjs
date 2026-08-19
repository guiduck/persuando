const fs = require("node:fs");
const path = require("node:path");

process.stdout?.on?.("error", (error) => {
  if (error?.code !== "EPIPE") throw error;
});
process.stderr?.on?.("error", (error) => {
  if (error?.code !== "EPIPE") throw error;
});

const logPath = path.join(__dirname, "electron-debug.log");
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, line);
  try {
    console.log(`[Persuando Capture] ${message}`);
  } catch {
    // The app can be launched from terminals that close stdout after spawning Electron.
  }
}

log("Electron CommonJS bootstrap loaded.");

import("./dist/src/main.js").catch((error) => {
  log("Failed to load Electron main process.");
  fs.appendFileSync(logPath, `${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
