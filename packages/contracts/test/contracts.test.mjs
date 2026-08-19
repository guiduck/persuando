import assert from "node:assert/strict";
import test from "node:test";

import {
  activeMvpConsentTypes,
  maskProviderCredential,
  redactRecord,
  validateMaskedCredential,
  validateRequiredMvpConsent,
  validateSameAccountAccess,
  websocketEventTypes
} from "../dist/src/index.js";

test("required MVP consent rejects missing consent", () => {
  const result = validateRequiredMvpConsent([]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /microphone_capture/);
});

test("required MVP consent accepts every active consent grant", () => {
  const grants = activeMvpConsentTypes.map((consentType, index) => ({
    id: `grant-${index}`,
    userId: "user-1",
    consentType,
    status: "granted",
    consentTextVersion: "2026-05-20",
    grantedAt: "2026-05-20T00:00:00.000Z"
  }));
  assert.deepEqual(validateRequiredMvpConsent(grants), { ok: true });
});

test("same-account access rejects deleted and cross-account sessions", () => {
  assert.equal(validateSameAccountAccess({ ownerUserId: "user-2" }, "user-1").ok, false);
  assert.equal(validateSameAccountAccess({ ownerUserId: "user-1", deletedAt: "2026-05-20T00:00:00.000Z" }, "user-1").ok, false);
  assert.equal(validateSameAccountAccess({ ownerUserId: "user-1" }, "user-1").ok, true);
});

test("provider credentials are masked and redacted", () => {
  const masked = maskProviderCredential("sk-1234567890abcdef");
  assert.equal(masked, "sk-1...cdef");
  assert.equal(validateMaskedCredential(masked).ok, true);
  assert.equal(validateMaskedCredential("sk-1234567890abcdef").ok, false);
  assert.deepEqual(redactRecord({ apiKey: "secret", safe: "ok" }), { apiKey: "[REDACTED]", safe: "ok" });
});

test("all planned WebSocket event names are registered", () => {
  assert.ok(websocketEventTypes.includes("capture.audio_chunk"));
  assert.ok(websocketEventTypes.includes("response.ack"));
  assert.ok(websocketEventTypes.includes("retention.deleted"));
  assert.ok(websocketEventTypes.includes("copilot.context"));
  assert.ok(websocketEventTypes.includes("copilot.explanation"));
});
