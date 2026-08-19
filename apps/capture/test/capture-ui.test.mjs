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
