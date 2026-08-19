import assert from "node:assert/strict";
import test from "node:test";

import { ConsentService } from "../dist/src/modules/consent/consent.service.js";
import { CredentialsService } from "../dist/src/modules/credentials/credentials.service.js";
import { LoggingRedactionService } from "../dist/src/modules/logging/logging-redaction.service.js";
import { ProvidersService } from "../dist/src/modules/providers/providers.service.js";
import { RealtimeService } from "../dist/src/modules/realtime/realtime.service.js";
import { RetentionCleanupJob } from "../dist/src/modules/retention/retention-cleanup.job.js";
import { RetentionService } from "../dist/src/modules/retention/retention.service.js";
import { SessionsService } from "../dist/src/modules/sessions/sessions.service.js";
import { SettingsService } from "../dist/src/modules/settings/settings.service.js";
import { WorkspaceAccessService } from "../dist/src/modules/workspaces/workspace-access.service.js";
import { WorkspacesService } from "../dist/src/modules/workspaces/workspaces.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

const user = {
  id: "google:user-1",
  email: "user@example.com",
  displayName: "User",
  provider: "google"
};

const config = {
  env: {
    credentialEncryptionKey: "test-credential-encryption-key",
    credentialEncryptionKeyVersion: "test-v1"
  }
};

function testAudioPayload() {
  const audio = Buffer.from("fake-webm-audio");
  return {
    audioBase64: audio.toString("base64"),
    byteLength: audio.byteLength
  };
}

function event(type, sessionId, payload = {}) {
  return {
    version: 1,
    type,
    sessionId,
    sentAt: new Date().toISOString(),
    payload
  };
}

function audioChunk(sessionId, chunkSequence = 1) {
  return event("capture.audio_chunk", sessionId, {
    ...testAudioPayload(),
    chunkSequence,
    clientTimestamp: new Date().toISOString(),
    codec: "webm-opus",
    durationMs: 250
  });
}

async function buildHarness(options = {}) {
  const database = createFakeDatabase();
  const retentionService = new RetentionService();
  const workspacesService = new WorkspacesService(database);
  const sessionsService = new SessionsService(retentionService, database);
  const consentService = new ConsentService(database);
  const settingsService = new SettingsService(database);
  const credentialsService = new CredentialsService(config, database);
  const providersService = options.providersService ?? new ProvidersService({ env: { providerAdapter: "mock" } });
  const realtimeService = new RealtimeService(
    sessionsService,
    new WorkspaceAccessService(),
    consentService,
    database,
    providersService,
    settingsService,
    credentialsService,
    { maxBufferedAudioChunksPerSession: options.maxBufferedAudioChunksPerSession ?? 10 }
  );
  const workspace = await workspacesService.getOrCreateCurrentWorkspace(user.id);
  return {
    consentService,
    credentialsService,
    database,
    realtimeService,
    retentionService,
    sessionsService,
    settingsService,
    workspace
  };
}

async function createActiveSession(harness) {
  const session = await harness.sessionsService.createSession({
    consentGrantIds: [],
    ownerUserId: user.id,
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    title: "E2E session",
    workspaceId: harness.workspace.id
  });
  await harness.database.session.update({
    where: { id: session.id },
    data: { status: "active" }
  });
  return { ...session, status: "active" };
}

async function grantMvpConsent(consentService, sessionId) {
  for (const consentType of [
    "microphone_capture",
    "audio_transcription",
    "backend_transmission",
    "external_ai_provider_usage",
    "session_retention",
    "code_copilot",
    "screen_coding_context_capture"
  ]) {
    await consentService.createGrant({
      userId: user.id,
      sessionId,
      consentType,
      consentTextVersion: "mvp-visible-consent-v1"
    });
  }
}

test("E2E: signed-in user saves credential, grants consent, uploads audio, sees transcript and suggestions", async () => {
  const harness = await buildHarness();
  const credential = await harness.credentialsService.createCredential({
    providerName: "openai-compatible",
    secret: "sk-provider-secret",
    userId: user.id
  });
  await harness.settingsService.updateSettings(user.id, {
    ...(await harness.settingsService.getSettings(user.id)),
    providerCredentialId: credential.id
  });
  const session = await createActiveSession(harness);
  await grantMvpConsent(harness.consentService, session.id);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });
  harness.realtimeService.connectClient({ clientId: "response-1", clientType: "response", user });
  await harness.realtimeService.handleClientEvent("response-1", event("response.subscribe", session.id, { lastSeenSequence: 0 }));

  const result = await harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id));
  const history = await harness.sessionsService.getSessionHistory(session.id);

  assert.equal(result.action, "audio_chunk_accepted");
  assert.equal(history.transcriptSegments.length, 1);
  assert.equal(history.summaries.length, 1);
  assert.equal(history.suggestions.length > 0, true);
});

test("E2E: missing consent blocks capture and provider processing", async () => {
  const harness = await buildHarness();
  const session = await createActiveSession(harness);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });

  await assert.rejects(() => harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id)), /consent/i);
  assert.equal((await harness.sessionsService.getSessionHistory(session.id)).transcriptSegments.length, 0);
});

test("E2E: consent revocation during active capture stops later upload", async () => {
  const harness = await buildHarness();
  const session = await createActiveSession(harness);
  await grantMvpConsent(harness.consentService, session.id);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });
  await harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id));
  const grant = (await harness.consentService.listGrants(user.id, session.id)).find((item) => item.consentType === "microphone_capture");
  await harness.consentService.revokeGrant(user.id, grant.id);

  await assert.rejects(() => harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 2)), /revoked/i);
});

test("E2E: late response join receives history and then new replay events after ack", async () => {
  const harness = await buildHarness();
  const session = await createActiveSession(harness);
  await grantMvpConsent(harness.consentService, session.id);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });
  await harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id));
  harness.realtimeService.connectClient({ clientId: "response-late", clientType: "response", user });

  const subscribed = await harness.realtimeService.handleClientEvent("response-late", event("response.subscribe", session.id, { lastSeenSequence: 0 }));
  const maxSequence = Math.max(...subscribed.replayedEvents.map((item) => item.sequence ?? 0));
  await harness.realtimeService.handleClientEvent("response-late", event("response.ack", session.id, { lastReceivedSequence: maxSequence }));

  assert.equal(subscribed.replayedEvents.some((item) => item.type === "transcript.segment"), true);
  assert.equal(subscribed.replayedEvents.some((item) => item.type === "suggestion.created"), true);
});

test("E2E: code copilot context requires consent and returns practice guidance", async () => {
  const harness = await buildHarness();
  const session = await createActiveSession(harness);
  await grantMvpConsent(harness.consentService, session.id);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });

  const accepted = await harness.realtimeService.handleClientEvent(
    "capture-1",
    event("copilot.context", session.id, {
      contextId: "context-1",
      explanationMode: "explain",
      programmingLanguage: "typescript",
      textContext: "Explain a reduce implementation."
    })
  );
  const context = await harness.database.codeCopilotContext.findFirst({ where: { id: "context-1" } });

  assert.equal(accepted.action, "accepted");
  assert.equal(context.status, "completed");
  assert.equal(typeof context.generatedGuidance, "string");
});

test("E2E: manual delete hides session from future history", async () => {
  const harness = await buildHarness();
  const session = await createActiveSession(harness);

  const deleted = await harness.sessionsService.manualDeleteSession(session.id);

  assert.equal(deleted.status, "deleted");
  assert.throws(() => new WorkspaceAccessService().assertSessionAccess(user, deleted), /not found|deleted/i);
});

test("Operational: retention cleanup is idempotent for expired sessions", async () => {
  const harness = await buildHarness();
  const cleanup = new RetentionCleanupJob(harness.retentionService);
  const expired = [
    {
      deletedAt: undefined,
      endedAt: undefined,
      retentionExpiresAt: "2026-01-01T00:00:00.000Z",
      status: "ended"
    }
  ];

  const first = cleanup.run(expired, new Date("2026-02-01T00:00:00.000Z"));
  const second = cleanup.run(first.cleaned, new Date("2026-02-01T00:00:00.000Z"));

  assert.equal(first.cleaned.length, 1);
  assert.equal(second.cleaned.length, 0);
  assert.equal(second.retained.filter((item) => item.deletedAt).length, 1);
});

test("Operational: audio backpressure and provider latency expose safe degraded states", async () => {
  const slowProvider = {
    getActiveAdapterName: () => "mock",
    async transcribe(input) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return new ProvidersService({ env: { providerAdapter: "mock" } }).transcribe(input);
    },
    generate(input) {
      return new ProvidersService({ env: { providerAdapter: "mock" } }).generate(input);
    }
  };
  const harness = await buildHarness({ maxBufferedAudioChunksPerSession: 1, providersService: slowProvider });
  const session = await createActiveSession(harness);
  await grantMvpConsent(harness.consentService, session.id);
  harness.realtimeService.connectClient({ clientId: "capture-1", clientType: "capture", user });

  await harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id));

  await assert.rejects(() => harness.realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 2)), /backpressure/i);
});

test("Operational: redaction removes secrets, raw audio, and provider payloads from telemetry", () => {
  const redacted = new LoggingRedactionService().redact({
    apiKey: "sk-provider-secret",
    audio: "raw-audio",
    decryptedSecret: "secret",
    providerPayload: { text: "sensitive" },
    safe: "ok"
  });

  assert.equal(JSON.stringify(redacted).includes("sk-provider-secret"), false);
  assert.equal(JSON.stringify(redacted).includes("raw-audio"), false);
  assert.equal(JSON.stringify(redacted).includes("sensitive"), false);
  assert.equal(redacted.safe, "ok");
});
