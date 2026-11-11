import assert from "node:assert/strict";
import test from "node:test";
import { captureActiveScreenImage, synchronizeCaptureActivity } from "../dist/src/renderer/screen-context.js";

test("paused, ended and replaced screen contexts do not start a screenshot", async () => {
  let screenshots = 0;
  const captureImage = async () => { screenshots += 1; return "image"; };
  assert.equal(await captureActiveScreenImage(undefined, captureImage, () => true), undefined);
  assert.equal(await captureActiveScreenImage({ isActive: () => false, captureRevision: 0 }, captureImage, () => true), undefined);
  assert.equal(await captureActiveScreenImage({ isActive: () => true, captureRevision: 0 }, captureImage, () => false), undefined);
  assert.equal(screenshots, 0);
});

test("screen context discards an in-flight image after pause, stop, revoke or session replacement", async () => {
  for (const change of ["pause", "stop", "revoke", "replace"]) {
    let active = true;
    let current = true;
    let finish;
    const pendingImage = new Promise((resolve) => { finish = resolve; });
    const result = captureActiveScreenImage({ isActive: () => active, captureRevision: 0 }, () => pendingImage, () => current);
    if (change === "replace" || change === "revoke") current = false;
    else active = false;
    finish("stale screenshot");
    assert.equal(await result, undefined, change);
  }
});

test("screen context resumes only for an active current session and preserves capture errors", async () => {
  let active = false;
  const capture = { isActive: () => active, captureRevision: 0 };
  assert.equal(await captureActiveScreenImage(capture, async () => "image", () => true), undefined);
  active = true;
  assert.equal(await captureActiveScreenImage(capture, async () => "image", () => true), "image");
  await assert.rejects(() => captureActiveScreenImage(capture, async () => { throw new Error("screen denied"); }, () => true), /screen denied/);
});

test("a pause followed by resume cannot publish a screenshot from before that pause", async () => {
  let finish;
  const capture = { isActive: () => true, captureRevision: 1 };
  const pendingImage = new Promise((resolve) => { finish = resolve; });
  const result = captureActiveScreenImage(capture, () => pendingImage, () => true);
  capture.captureRevision += 2;
  finish("image from before pause");
  assert.equal(await result, undefined);
});

test("a pause/resume control from another window changes the actual screen-capture owner", async () => {
  let active = true;
  const capture = {
    session: { id: "session-1" }, captureRevision: 0, isActive: () => active,
    pause() { active = false; this.captureRevision += 1; },
    resume() { active = true; this.captureRevision += 1; },
    stop() { active = false; this.captureRevision += 1; }
  };
  let screenshots = 0;
  const frame = async () => { screenshots += 1; return "image"; };
  const sharedState = { activeSessionId: "session-1", listening: true, paused: true, status: "paused" };
  assert.equal(synchronizeCaptureActivity(capture, sharedState), true);
  assert.equal(await captureActiveScreenImage(capture, frame, () => true), undefined);
  assert.equal(screenshots, 0);
  synchronizeCaptureActivity(capture, { ...sharedState, paused: false, status: "active" });
  assert.equal(await captureActiveScreenImage(capture, frame, () => true), "image");
  assert.equal(screenshots, 1);
});

test("shared end/revoke/error and replacement stop the owner without stopping initial startup", () => {
  let stops = 0;
  const capture = { session: { id: "session-1" }, pause() {}, resume() {}, stop() { stops += 1; } };
  assert.equal(synchronizeCaptureActivity(capture, { activeSessionId: "session-1", listening: false, paused: false, status: "active" }), true);
  assert.equal(stops, 0);
  for (const status of ["ended", "revoked", "error"]) {
    assert.equal(synchronizeCaptureActivity(capture, { listening: false, paused: false, status }), false);
  }
  assert.equal(synchronizeCaptureActivity(capture, { activeSessionId: "replacement", listening: true, paused: false, status: "active" }), false);
  assert.equal(stops, 4);
});
