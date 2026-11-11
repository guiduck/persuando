const { app } = require("electron");
const { createBootstrapLogger } = require("./bootstrap-log.cjs");

process.stdout?.on?.("error", (error) => {
  if (error?.code !== "EPIPE") throw error;
});
process.stderr?.on?.("error", (error) => {
  if (error?.code !== "EPIPE") throw error;
});

const log = createBootstrapLogger(app);

log("Electron CommonJS bootstrap loaded.");

import("./dist/src/main.js").catch((error) => {
  log(`Failed to load Electron main process.\n${error?.stack ?? error}`);
  process.exitCode = 1;
});
