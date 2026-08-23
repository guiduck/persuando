import assert from "node:assert/strict";
import test from "node:test";

import { RealtimeGateway } from "../dist/src/modules/realtime/realtime.gateway.js";
import { RealtimeService } from "../dist/src/modules/realtime/realtime.service.js";
import { ConsentService } from "../dist/src/modules/consent/consent.service.js";
import { ProviderAdapterError } from "../dist/src/modules/providers/provider-adapter.js";
import { ProvidersService } from "../dist/src/modules/providers/providers.service.js";
import { RetentionService } from "../dist/src/modules/retention/retention.service.js";
import { SessionsService } from "../dist/src/modules/sessions/sessions.service.js";
import { SettingsService } from "../dist/src/modules/settings/settings.service.js";
import { WorkspaceAccessService } from "../dist/src/modules/workspaces/workspace-access.service.js";
import { WorkspacesService } from "../dist/src/modules/workspaces/workspaces.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

function user(id = "google:user-1") {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    provider: "google"
  };
}

async function buildHarness(overrides = {}) {
  const database = createFakeDatabase();
  const consentService = new ConsentService(database);
  const workspacesService = new WorkspacesService(database);
  const sessionsService = new SessionsService(new RetentionService(), database);
  const settingsService = new SettingsService(database);
  const providersService = overrides.providersService ?? new ProvidersService({ env: { providerAdapter: "mock" } });
  const credentialsService = { decryptForProviderCall: async () => "sk-test-secret-value" };
  const realtimeService = new RealtimeService(
    sessionsService,
    new WorkspaceAccessService(),
    consentService,
    database,
    providersService,
    settingsService,
    credentialsService,
    {
      maxBufferedAudioChunksPerSession: 2
    }
  );
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const session = await sessionsService.createSession({
    ownerUserId: "google:user-1",
    workspaceId: workspace.id,
    title: "Realtime session",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  return { consentService, realtimeService, sessionsService, session };
}

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
    sentAt: "2026-05-22T12:00:00.000Z",
    payload
  };
}

function audioChunk(sessionId, chunkSequence = 1) {
  return event("capture.audio_chunk", sessionId, {
    chunkSequence,
    clientTimestamp: "2026-05-22T12:00:00.000Z",
    codec: "webm-opus",
    durationMs: 250,
    ...testAudioPayload()
  });
}

function copilotContext(sessionId, contextId = "copilot-context-1", overrides = {}) {
  return event("copilot.context", sessionId, {
    contextId,
    programmingLanguage: "typescript",
    explanationMode: "explain",
    textContext: "function add(a: number, b: number) { return a + b }",
    ...overrides
  });
}

async function grantAudioUploadConsent(consentService, sessionId) {
  const microphone = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "microphone_capture",
    consentTextVersion: "2026-05-20"
  });
  const backend = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "backend_transmission",
    consentTextVersion: "2026-05-20"
  });
  const transcription = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "audio_transcription",
    consentTextVersion: "2026-05-20"
  });
  return { backend, microphone, transcription };
}

async function grantCopilotConsent(consentService, sessionId) {
  const codeCopilot = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "code_copilot",
    consentTextVersion: "2026-05-20"
  });
  const screenContext = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "screen_coding_context_capture",
    consentTextVersion: "2026-05-20"
  });
  const backend = await consentService.createGrant({
    userId: "google:user-1",
    sessionId,
    consentType: "backend_transmission",
    consentTextVersion: "2026-05-20"
  });
  return { backend, codeCopilot, screenContext };
}

test("RealtimeService requires an authenticated client", async () => {
  const { realtimeService } = await buildHarness();

  assert.throws(() => realtimeService.connectClient({ clientId: "client-1", clientType: "response" }), /authentication/i);
});

test("RealtimeService subscribes, acknowledges, and replays missed events", async () => {
  const { realtimeService, session } = await buildHarness();
  realtimeService.connectClient({ clientId: "client-1", user: user(), clientType: "response" });
  const subscribed = await realtimeService.handleClientEvent(
    "client-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );
  const published = realtimeService.publishServerEvent(
    event("session.status", session.id, { status: "active" })
  );
  const acknowledged = await realtimeService.handleClientEvent(
    "client-1",
    event("response.ack", session.id, { lastReceivedSequence: published.sequence })
  );
  const replay = await realtimeService.handleClientEvent(
    "client-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );

  assert.equal(subscribed.action, "subscribed");
  assert.equal(acknowledged.action, "acknowledged");
  assert.equal(replay.replayedEvents.length, 1);
  assert.equal(replay.replayedEvents[0]?.sequence, published.sequence);
});

test("RealtimeService unsubscribes response clients", async () => {
  const { realtimeService, session } = await buildHarness();
  realtimeService.connectClient({ clientId: "client-1", user: user(), clientType: "response" });
  await realtimeService.handleClientEvent("client-1", event("response.subscribe", session.id, {}));
  const unsubscribed = await realtimeService.handleClientEvent("client-1", event("response.unsubscribe", session.id, {}));

  assert.equal(unsubscribed.action, "unsubscribed");
  assert.equal(realtimeService.getClient("client-1").subscribedSessionIds.has(session.id), false);
});

test("RealtimeService activates sessions from Capture status updates", async () => {
  const { realtimeService, sessionsService, session } = await buildHarness();
  const publishedEvents = [];
  realtimeService.onEvent((publishedEvent) => publishedEvents.push(publishedEvent));
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  const result = await realtimeService.handleClientEvent(
    "capture-1",
    event("capture.status", session.id, { status: "active" })
  );
  const updated = await sessionsService.getSession(session.id);

  assert.equal(result.action, "accepted");
  assert.equal(updated.status, "active");
  assert.equal(publishedEvents.some((publishedEvent) => publishedEvent.type === "session.status"), true);
});

test("RealtimeService rejects malformed or unknown events", async () => {
  const { realtimeService, session } = await buildHarness();
  realtimeService.connectClient({ clientId: "client-1", user: user(), clientType: "response" });

  await assert.rejects(() => realtimeService.handleClientEvent("client-1", { type: "unknown", sessionId: session.id }), /version/i);
  await assert.rejects(() => realtimeService.handleClientEvent("client-1", event("unknown.event", session.id, {})), /type/i);
});

test("RealtimeService denies cross-account session subscriptions", async () => {
  const { realtimeService, session } = await buildHarness();
  realtimeService.connectClient({ clientId: "client-2", user: user("google:user-2"), clientType: "response" });

  await assert.rejects(
    () => realtimeService.handleClientEvent("client-2", event("response.subscribe", session.id, {})),
    /another account/i
  );
});

test("RealtimeGateway receives serialized messages and delegates explicit session routing", async () => {
  const { realtimeService, session } = await buildHarness();
  const gateway = new RealtimeGateway(realtimeService);
  gateway.connect({ clientId: "client-1", user: user(), clientType: "response" });

  const result = await gateway.receiveMessage(
    "client-1",
    JSON.stringify(event("response.subscribe", session.id, { lastSeenSequence: 0 }))
  );
  const published = gateway.publish(event("session.status", session.id, { status: "active" }));

  assert.equal(result.action, "subscribed");
  assert.equal(published.sequence, 1);
});

test("RealtimeService accepts capture audio chunks only with active session and consent", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  const result = await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));

  assert.equal(result.action, "audio_chunk_accepted");
  assert.equal(result.chunkSequence, 1);
  assert.equal(typeof result.transcriptSegmentId, "string");
});

test("RealtimeService persists transcript segments and replays transcript fan-out events", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const result = await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );

  assert.equal(result.action, "audio_chunk_accepted");
  assert.equal(replay.action, "subscribed");
  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "capture.audio_chunk"), true);
  const transcriptEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "transcript.segment");
  assert.equal(transcriptEvent?.payload.segment.id, result.transcriptSegmentId);
  assert.equal(transcriptEvent?.payload.segment.text, "Mock transcript segment from authorized microphone audio.");
});

test("RealtimeService generates summaries, insights, and suggestions from transcript context", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const result = await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );

  const summaryEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "summary.updated");
  const insightEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "insight.created");
  const suggestionEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "suggestion.created");
  assert.equal(summaryEvent?.payload.summary.sourceSegmentIds.includes(result.transcriptSegmentId), true);
  assert.equal(insightEvent?.payload.insight.sourceSegmentIds.includes(result.transcriptSegmentId), true);
  assert.equal(suggestionEvent?.payload.suggestion.sourceSegmentIds.includes(result.transcriptSegmentId), true);
  assert.match(summaryEvent?.payload.summary.content ?? "", /Mock transcript segment/i);
});

test("RealtimeService rejects capture audio chunks when consent is missing", async () => {
  const { realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1)), /CONSENT_MISSING/i);
});

test("RealtimeService stops active capture after consent is revoked", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  const grants = await grantAudioUploadConsent(consentService, session.id);
  await consentService.revokeGrant("google:user-1", grants.microphone.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1)), /CONSENT_REVOKED/i);
});

test("RealtimeService rejects capture audio chunks when session is not active", async () => {
  const { consentService, realtimeService, session } = await buildHarness();
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1)), /active/i);
});

test("RealtimeService enforces audio chunk sequencing", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 2)), /sequence must be 1/i);
});

test("RealtimeService applies audio upload backpressure", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));
  await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 2));

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 3)), /backpressure/i);
});

test("RealtimeService publishes safe provider errors and keeps capture alive when transcription is retryable", async () => {
  const providersService = {
    getActiveAdapterName: () => "mock",
    transcribe: async () => {
      throw new ProviderAdapterError("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", true);
    },
    generate: async () => {
      throw new Error("should not generate after transcription failure");
    }
  };
  const { consentService, realtimeService, sessionsService, session } = await buildHarness({ providersService });
  await sessionsService.markActive(session.id);
  await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const result = await realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));
  assert.equal(result.action, "audio_chunk_accepted");
  assert.equal(result.transcriptSegmentId, undefined);
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );
  const providerErrorEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "provider.error");

  assert.equal(providerErrorEvent?.payload.code, "PROVIDER_RATE_LIMITED");
  assert.equal(providerErrorEvent?.payload.retryable, true);
  assert.equal(JSON.stringify(providerErrorEvent?.payload).includes("sk-"), false);
});

test("RealtimeService stops provider processing if transcription consent is revoked mid-flight", async () => {
  const deferred = createDeferred();
  const started = createDeferred();
  const providersService = {
    getActiveAdapterName: () => "mock",
    transcribe: async () => {
      started.resolve();
      await deferred.promise;
      return {
        transcript: {
          text: "This should not be persisted after revocation.",
          confidence: 1,
          language: "pt-BR",
          provisional: false
        }
      };
    },
    generate: async () => {
      throw new Error("should not generate after consent revocation");
    }
  };
  const { consentService, realtimeService, sessionsService, session } = await buildHarness({ providersService });
  await sessionsService.markActive(session.id);
  const grants = await grantAudioUploadConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const pending = realtimeService.handleClientEvent("capture-1", audioChunk(session.id, 1));
  await started.promise;
  await consentService.revokeGrant("google:user-1", grants.transcription.id);
  deferred.resolve();

  await assert.rejects(() => pending, /CONSENT_REVOKED/i);
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );

  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "transcript.segment"), false);
  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "provider.error"), false);
});

test("RealtimeService requires code copilot consent before accepting copilot context", async () => {
  const { realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  await assert.rejects(() => realtimeService.handleClientEvent("capture-1", copilotContext(session.id)), /CONSENT_MISSING/i);
});

test("RealtimeService persists copilot context and publishes provider guidance", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantCopilotConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const result = await realtimeService.handleClientEvent(
    "capture-1",
    copilotContext(session.id, "copilot-context-1", { programmingLanguage: "" })
  );
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );
  const contextEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "copilot.context");
  const explanationEvent = replay.replayedEvents.find((storedEvent) => storedEvent.type === "copilot.explanation");

  assert.equal(result.action, "accepted");
  assert.equal(contextEvent?.payload.contextId, "copilot-context-1");
  assert.equal(contextEvent?.payload.programmingLanguage, "javascript");
  assert.equal(explanationEvent?.payload.contextId, "copilot-context-1");
  assert.equal(explanationEvent?.payload.kind, "explanation");
  assert.equal((explanationEvent?.payload.content ?? "").length > 0, true);
});

test("RealtimeService stops copilot output if copilot consent is revoked mid-flight", async () => {
  const deferred = createDeferred();
  const started = createDeferred();
  const providersService = {
    getActiveAdapterName: () => "mock",
    transcribe: async () => {
      throw new Error("should not transcribe for copilot");
    },
    generate: async () => {
      started.resolve();
      await deferred.promise;
      return {
        summary: { content: "Generated guidance should be discarded." },
        insights: [],
        suggestions: [{ category: "response", content: "Generated guidance should be discarded.", urgency: "medium" }]
      };
    }
  };
  const { consentService, realtimeService, sessionsService, session } = await buildHarness({ providersService });
  await sessionsService.markActive(session.id);
  const grants = await grantCopilotConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });

  const pending = realtimeService.handleClientEvent("capture-1", copilotContext(session.id));
  await started.promise;
  await consentService.revokeGrant("google:user-1", grants.codeCopilot.id);
  deferred.resolve();

  await assert.rejects(() => pending, /CONSENT_REVOKED/i);
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );

  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "copilot.context"), true);
  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "copilot.explanation"), false);
  assert.equal(replay.replayedEvents.some((storedEvent) => storedEvent.type === "provider.error"), false);
});

test("RealtimeService sends all 30 requested screenshots to the real Code Practice generation input", async () => {
  const generationInputs = [];
  const providersService = {
    getActiveAdapterName: () => "mock",
    transcribe: async () => {
      throw new Error("should not transcribe");
    },
    generate: async (input) => {
      generationInputs.push(input);
      return {
        summary: { content: "Level Order Traversal usa BFS." },
        insights: [],
        suggestions: [{
          category: "response",
          content: "Use BFS com uma fila e visite os nós nível por nível.",
          urgency: "high"
        }]
      };
    }
  };
  const { consentService, realtimeService, sessionsService, session } = await buildHarness({ providersService });
  await grantCopilotConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });
  await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );
  const screenContexts = Array.from({ length: 30 }, (_, index) => ({
    imageReference: `data:image/png;base64,image-${index + 1}`,
    textContext: `Screenshot ${index + 1}`
  }));

  const result = await realtimeService.handleClientEvent(
    "response-1",
    event("response.generate", session.id, { mode: "code_practice", screenContexts })
  );
  await sessionsService.markActive(session.id);
  realtimeService.connectClient({ clientId: "capture-history", user: user(), clientType: "capture" });
  for (let index = 1; index <= 15; index += 1) {
    await realtimeService.handleClientEvent(
      "capture-history",
      copilotContext(session.id, `history-screen-${index}`, {
        imageReference: `data:image/png;base64,history-${index}`,
        textContext: `Periodic screen context captured ${index}`
      })
    );
  }
  await realtimeService.handleClientEvent(
    "response-1",
    event("response.generate", session.id, { mode: "code_practice", screenContexts })
  );
  const replay = await realtimeService.handleClientEvent(
    "response-1",
    event("response.subscribe", session.id, { lastSeenSequence: 0 })
  );
  const explanation = replay.replayedEvents.find((storedEvent) => storedEvent.type === "copilot.explanation");

  assert.equal(result.action, "accepted");
  assert.equal(generationInputs.length, 2);
  assert.equal(generationInputs[0].task, "code_practice");
  assert.equal(generationInputs[0].programmingLanguage, "typescript");
  assert.ok(generationInputs[0].generationId);
  assert.deepEqual(generationInputs[0].previousCodePracticeGuidance, []);
  assert.deepEqual(generationInputs[1].previousCodePracticeGuidance, [
    "Use BFS com uma fila e visite os nós nível por nível."
  ]);
  assert.equal(generationInputs[0].imageReferences.length, 30);
  assert.equal(generationInputs[0].imageReferences[0], "data:image/png;base64,image-1");
  assert.equal(generationInputs[0].imageReferences.at(-1), "data:image/png;base64,image-30");
  assert.equal(generationInputs[1].imageReferences.length, 30);
  assert.equal(generationInputs[1].imageReferences.at(-1), "data:image/png;base64,history-15");
  assert.match(explanation?.payload.content ?? "", /BFS com uma fila/i);
  assert.doesNotMatch(explanation?.payload.content ?? "", /altura|getHeight/i);
});

test("RealtimeService rejects more than 30 requested screenshots", async () => {
  const { realtimeService, session } = await buildHarness();
  realtimeService.connectClient({ clientId: "response-1", user: user(), clientType: "response" });
  const screenContexts = Array.from({ length: 31 }, (_, index) => ({
    imageReference: `data:image/png;base64,image-${index + 1}`
  }));

  await assert.rejects(
    () => realtimeService.handleClientEvent(
      "response-1",
      event("response.generate", session.id, { mode: "code_practice", screenContexts })
    ),
    /at most 30 screen contexts/i
  );
});

test("Session history keeps the latest 30 persisted screenshots in FIFO order", async () => {
  const { consentService, realtimeService, sessionsService, session } = await buildHarness();
  await sessionsService.markActive(session.id);
  await grantCopilotConsent(consentService, session.id);
  realtimeService.connectClient({ clientId: "capture-1", user: user(), clientType: "capture" });

  for (let index = 1; index <= 31; index += 1) {
    await realtimeService.handleClientEvent(
      "capture-1",
      copilotContext(session.id, `periodic-context-${index}`, {
        debugId: `periodic-debug-${index}`,
        imageReference: `data:image/png;base64,image-${index}`,
        textContext: `Periodic screen context captured ${index}`
      })
    );
  }

  const history = await sessionsService.getSessionHistory(session.id);

  assert.equal(history?.screenContexts.length, 30);
  assert.equal(history?.screenContexts[0].imageReference, "data:image/png;base64,image-2");
  assert.equal(history?.screenContexts.at(-1).imageReference, "data:image/png;base64,image-31");
  assert.equal(history?.screenContexts.at(-1).debugId, "periodic-debug-31");
});

function createDeferred() {
  let resolve;
  const promise = new Promise((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
