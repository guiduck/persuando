import assert from "node:assert/strict";
import test from "node:test";

import { AuthService } from "../dist/src/modules/auth/auth.service.js";
import { ConsentController } from "../dist/src/modules/consent/consent.controller.js";
import { ConsentService } from "../dist/src/modules/consent/consent.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

const now = new Date("2026-05-20T12:00:00.000Z");

function grant(consentType, overrides = {}) {
  return {
    id: `grant-${consentType}`,
    userId: "google:user-1",
    sessionId: "session-1",
    consentType,
    status: "granted",
    consentTextVersion: "2026-05-20",
    grantedAt: "2026-05-20T11:00:00.000Z",
    ...overrides
  };
}

test("ConsentService allows capture upload only with microphone and backend transmission consent", () => {
  const service = new ConsentService();
  const decision = service.requireCaptureUploadConsent([
    grant("microphone_capture"),
    grant("backend_transmission")
  ], now);

  assert.deepEqual(decision, { ok: true });
});

test("ConsentService blocks transcription when audio transcription consent is missing", () => {
  const service = new ConsentService();
  const decision = service.requireTranscriptionConsent([
    grant("microphone_capture"),
    grant("backend_transmission")
  ], now);

  assert.deepEqual(decision, {
    ok: false,
    code: "CONSENT_MISSING",
    consentType: "audio_transcription",
    status: "missing"
  });
});

test("ConsentService blocks provider use without external provider consent", () => {
  const service = new ConsentService();
  const decision = service.requireExternalProviderConsent([], now);

  assert.deepEqual(decision, {
    ok: false,
    code: "CONSENT_MISSING",
    consentType: "external_ai_provider_usage",
    status: "missing"
  });
});

test("ConsentService blocks retention when retention consent is revoked", () => {
  const service = new ConsentService();
  const decision = service.requireRetentionConsent([
    grant("session_retention", {
      status: "revoked",
      revokedAt: "2026-05-20T11:30:00.000Z"
    })
  ], now);

  assert.deepEqual(decision, {
    ok: false,
    code: "CONSENT_REVOKED",
    consentType: "session_retention",
    status: "revoked"
  });
});

test("ConsentService blocks capture when consent is expired", () => {
  const service = new ConsentService();
  const decision = service.requireCaptureUploadConsent([
    grant("microphone_capture", { expiresAt: "2026-05-20T11:59:00.000Z" }),
    grant("backend_transmission")
  ], now);

  assert.deepEqual(decision, {
    ok: false,
    code: "CONSENT_EXPIRED",
    consentType: "microphone_capture",
    status: "expired"
  });
});

test("ConsentService blocks code copilot without explicit copilot and screen context consent", () => {
  const service = new ConsentService();
  const decision = service.requireCodeCopilotConsent([
    grant("microphone_capture"),
    grant("audio_transcription"),
    grant("backend_transmission"),
    grant("external_ai_provider_usage")
  ], now);

  assert.deepEqual(decision, {
    ok: false,
    code: "CONSENT_MISSING",
    consentType: "code_copilot",
    status: "missing"
  });
});

test("ConsentService allows code copilot only with visible copilot, screen context, and backend transmission consent", () => {
  const service = new ConsentService();
  const decision = service.requireCodeCopilotConsent([
    grant("code_copilot"),
    grant("screen_coding_context_capture"),
    grant("backend_transmission")
  ], now);

  assert.deepEqual(decision, { ok: true });
});

test("ConsentService creates, lists, and revokes user-owned consent grants", async () => {
  const service = new ConsentService(createFakeDatabase());
  const created = await service.createGrant({
    userId: "google:user-1",
    sessionId: "session-1",
    consentType: "microphone_capture",
    consentTextVersion: "2026-05-20"
  });

  assert.equal(created.status, "granted");
  assert.equal((await service.listGrants("google:user-1")).length, 1);
  assert.equal((await service.listGrants("google:user-2")).length, 0);

  const revoked = await service.revokeGrant("google:user-1", created.id);

  assert.equal(revoked?.status, "revoked");
  assert.equal(await service.revokeGrant("google:user-2", created.id), undefined);
});

test("ConsentService includes global grants when checking a session", async () => {
  const service = new ConsentService(createFakeDatabase());
  await service.createGrant({
    userId: "google:user-1",
    consentType: "microphone_capture",
    consentTextVersion: "2026-05-20"
  });
  await service.createGrant({
    userId: "google:user-1",
    sessionId: "session-1",
    consentType: "backend_transmission",
    consentTextVersion: "2026-05-20"
  });

  const grants = await service.listGrants("google:user-1", "session-1");

  assert.equal(grants.length, 2);
  assert.equal(service.requireCaptureUploadConsent(grants).ok, true);
});

test("ConsentController exposes create, list, and revoke responses for REST handlers", async () => {
  const service = new ConsentService(createFakeDatabase());
  const auditEvents = [];
  const controller = new ConsentController(
    service,
    {
      createEvent(input) {
        auditEvents.push(input);
        return { id: "audit-1", userId: input.userId, type: input.type, createdAt: now.toISOString() };
      }
    },
    new AuthService()
  );

  const created = await controller.createGrant(undefined, "google:user-1", {
    consentType: "backend_transmission",
    sessionId: "session-1",
    consentTextVersion: "2026-05-20"
  });
  const listed = await controller.listGrants(undefined, "google:user-1", "session-1");
  const revoked = await controller.revokeGrant(undefined, "google:user-1", created.consentGrant.id);

  assert.equal(created.consentGrant.status, "granted");
  assert.equal(listed.consentGrants.length, 1);
  assert.equal(revoked.consentGrant.status, "revoked");
  assert.deepEqual(auditEvents.map((event) => event.type), ["consent.granted", "consent.revoked"]);
});
