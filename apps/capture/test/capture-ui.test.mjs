import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const captureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const renderer = await readFile(resolve(captureRoot, "src/renderer/main.tsx"), "utf8");
const captureSession = await readFile(resolve(captureRoot, "src/renderer/capture-session.ts"), "utf8");
const electronMain = await readFile(resolve(captureRoot, "src/main.ts"), "utf8");

test("Capture app includes settings, consent, toolbar, and microphone upload surfaces", () => {
  const combined = `${renderer}\n${captureSession}\n${electronMain}`;
  for (const expected of [
    "Sign in with Google",
    "OpenAI-compatible API key",
    "Transcription model",
    "Analysis model",
    "Primary language",
    "Response language",
    "Microphone capture",
    "External AI provider usage",
    "Code practice context",
    "Start listening",
    "Pause",
    "End",
    "Ask",
    "Capture screen",
    "capture.audio_chunk",
    "copilot.context",
    "MediaRecorder",
    "Tray"
  ]) {
    assert.match(combined, new RegExp(expected.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Capture app offers current GPT-5.6 analysis models", () => {
  assert.match(renderer, /gpt-5\.6-sol/);
  assert.match(renderer, /gpt-5\.6-terra/);
  assert.match(renderer, /gpt-5\.6-luna/);
});
test("Capture app persists an explicit programming language selection", () => {
  assert.match(renderer, /value=\{settings\?\.preferredProgrammingLanguage/);
  assert.match(renderer, /<option value="javascript">JavaScript<\/option>/);
  assert.match(renderer, /<option value="typescript">TypeScript<\/option>/);
});
test("Capture app labels the session timer in minutes", () => {
  assert.match(renderer, /Session timer \(minutes\)/);
  assert.match(renderer, /sessionTimerMinutes/);
});
test("Capture app exposes visible error and permission failure paths", () => {
  const combined = `${renderer}\n${captureSession}`;
  assert.match(combined, /Capture error/);
  assert.match(combined, /getUserMedia/);
  assert.match(combined, /getDisplayMedia/);
  assert.match(combined, /Capture failed/);
});

test("Capture app supports tray commands and robust capture statuses", () => {
  const combined = `${renderer}\n${captureSession}\n${electronMain}`;
  for (const expected of [
    "capture:command",
    "pause-capture",
    "resume-capture",
    "revoke-capture",
    "reconnecting",
    "provider or realtime error",
    "setStatus",
    "setContextMenu"
  ]) {
    assert.match(combined.toLowerCase(), new RegExp(expected.toLowerCase().replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Capture app copy avoids forbidden responsible-use claims", () => {
  const combined = `${renderer}\n${captureSession}\n${electronMain}`.toLowerCase();
  for (const forbidden of ["stealth", "invisible", "proctor", "bypass", "evade", "cheat"]) {
    assert.doesNotMatch(combined, new RegExp(forbidden));
  }
});


test("Capture app exposes native screen capture bridge", () => {
  assert.match(`${renderer}
${electronMain}`, /captureScreenImage|capture-screen-image/);
});

test("floating toolbar explains every action and keeps a global screenshot shortcut", () => {
  for (const expected of [
    "Open the Capture dashboard and settings",
    "Hide the floating toolbar; reopen it from the system tray",
    "Send the text in Ask to Code Practice as a hint",
    "Take a screenshot and send it to Screen context",
    "Pause microphone capture without ending the session",
    "Resume microphone capture",
    "End the current capture session",
    "Start a new microphone capture session"
  ]) {
    assert.ok(renderer.includes(expected));
  }

  assert.match(renderer, /<Camera[^>]+aria-hidden="true"/);
  assert.match(renderer, /shortcut="Ctrl\+E"/);
  assert.match(renderer, /toolbar-button-wrap/);
  assert.match(electronMain, /globalShortcut\.register\(SCREEN_CAPTURE_ACCELERATOR/);
  assert.match(electronMain, /CommandOrControl\+E/);
  assert.match(electronMain, /broadcastCommand\("capture-context"\)/);
  assert.match(electronMain, /thumbnail\.toJPEG\(70\)/);
  assert.match(renderer, /capture-context ignored in renderer without the active capture session/);
  assert.match(electronMain, /globalShortcut\.unregisterAll\(\)/);
});
