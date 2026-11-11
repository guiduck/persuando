import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const { createBootstrapLogger } = createRequire(import.meta.url)("../bootstrap-log.cjs");

test("Capture bootstrap writes to per-user data outside a packaged ASAR", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "persuando-bootstrap-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(console, "log", () => {});
  const archive = join(directory, "app.asar");
  await writeFile(archive, "read-only application archive");
  const userData = join(directory, "user profile", "Persuando Capture");
  const log = createBootstrapLogger({ getPath: (name) => {
    assert.equal(name, "userData");
    return userData;
  } });

  log("Electron CommonJS bootstrap loaded.");
  log("Failed to load Electron main process.\nError: example failure");

  const content = await readFile(join(userData, "logs", "electron-debug.log"), "utf8");
  assert.match(content, /Electron CommonJS bootstrap loaded/);
  assert.match(content, /Error: example failure/);
  assert.equal(await readFile(archive, "utf8"), "read-only application archive");
});

test("Capture bootstrap survives an unwritable log directory and keeps console diagnostics", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "persuando-bootstrap-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const messages = [];
  t.mock.method(console, "log", (message) => messages.push(message));
  const blockedDirectory = join(directory, "not-a-directory");
  await writeFile(blockedDirectory, "existing file");
  const log = createBootstrapLogger({ getPath: () => blockedDirectory });

  assert.doesNotThrow(() => log("Continue starting the application."));
  assert.match(messages[0], /Continue starting the application/);
  assert.equal(await readFile(blockedDirectory, "utf8"), "existing file");
});

test("Capture bootstrap survives unavailable user data and a closed console", (t) => {
  t.mock.method(console, "log", () => { throw new Error("closed output"); });
  const log = createBootstrapLogger({ getPath: () => { throw new Error("user data unavailable"); } });
  assert.doesNotThrow(() => log("Continue without diagnostics."));
});
