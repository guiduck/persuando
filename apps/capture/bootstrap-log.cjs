const fs = require("node:fs");
const path = require("node:path");

function createBootstrapLogger(app) {
  return function log(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    try {
      // Packaged code lives in a read-only ASAR; logs belong to the current user.
      const logDirectory = path.join(app.getPath("userData"), "logs");
      fs.mkdirSync(logDirectory, { recursive: true });
      fs.appendFileSync(path.join(logDirectory, "electron-debug.log"), line);
    } catch {
      // Diagnostic output must never prevent Capture from starting.
    }
    try {
      console.log(`[Persuando Capture] ${message}`);
    } catch {
      // The app can be launched from terminals that close stdout after spawning Electron.
    }
  };
}

module.exports = { createBootstrapLogger };
