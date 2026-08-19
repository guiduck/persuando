import assert from "node:assert/strict";
import test from "node:test";

import { createFakeDatabase } from "./fake-database.mjs";
import { InMemoryJobQueue } from "../dist/src/modules/jobs/job-queue.js";
import { JobWorkerHandlersService } from "../dist/src/modules/jobs/job-worker-handlers.service.js";
import { JobsService } from "../dist/src/modules/jobs/jobs.service.js";
import { persuandoJobNames, persuandoJobQueues } from "../dist/src/modules/jobs/job-contracts.js";
import { ProvidersService } from "../dist/src/modules/providers/providers.service.js";
import { RetentionService } from "../dist/src/modules/retention/retention.service.js";
import { SessionsService } from "../dist/src/modules/sessions/sessions.service.js";
import { SettingsService } from "../dist/src/modules/settings/settings.service.js";
import { WorkspacesService } from "../dist/src/modules/workspaces/workspaces.service.js";

test("JobsService enqueues provider, generation, and retention jobs on dedicated queues", async () => {
  const queue = new InMemoryJobQueue();
  const service = new JobsService(queue);

  const providerJob = await service.enqueueProviderCredentialValidation({
    userId: "google:user-1",
    credentialId: "credential-1"
  });
  const generationJob = await service.enqueueSessionAssistanceGeneration({
    userId: "google:user-1",
    sessionId: "session-1"
  });
  const retentionJob = await service.enqueueRetentionCleanup({ requestedAt: "2026-05-22T12:00:00.000Z" });

  assert.equal(providerJob.name, persuandoJobNames.validateProviderCredential);
  assert.equal(providerJob.queueName, persuandoJobQueues.providerValidation);
  assert.equal(generationJob.queueName, persuandoJobQueues.providerGeneration);
  assert.equal(retentionJob.queueName, persuandoJobQueues.retentionCleanup);
  assert.equal(queue.jobs.length, 3);
});

test("JobWorkerHandlersService validates credentials through the backend-only credential service", async () => {
  const handlers = new JobWorkerHandlersService(
    { validateCredential: async (userId, credentialId) => ({ ok: true, userId, credentialId }) },
    createFakeDatabase(),
    new ProvidersService({ env: { providerAdapter: "mock" } }),
    {},
    {}
  );

  const result = await handlers.handleProviderCredentialValidation({
    userId: "google:user-1",
    credentialId: "credential-1"
  });

  assert.equal(result.ok, true);
  assert.equal(result.userId, "google:user-1");
  assert.equal(result.credentialId, "credential-1");
});

test("JobWorkerHandlersService generates persisted summary, insight, and suggestion outputs", async () => {
  const database = createFakeDatabase();
  const settingsService = new SettingsService(database);
  const sessionsService = new SessionsService(new RetentionService(), database);
  const workspacesService = new WorkspacesService(database);
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const session = await sessionsService.createSession({
    ownerUserId: "google:user-1",
    workspaceId: workspace.id,
    title: "Queued session",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  await database.transcriptSegment.create({
    data: {
      id: "segment-1",
      sessionId: session.id,
      text: "Explique OAuth e armazenamento seguro de credenciais.",
      startMs: 0,
      endMs: 500,
      confidence: 0.94,
      source: "microphone",
      language: "pt-BR",
      provisional: false
    }
  });
  const handlers = new JobWorkerHandlersService(
    { decryptForProviderCall: async () => undefined },
    database,
    new ProvidersService({ env: { providerAdapter: "mock" } }),
    sessionsService,
    settingsService
  );

  const result = await handlers.handleSessionAssistanceGeneration({
    userId: "google:user-1",
    sessionId: session.id
  });

  assert.equal(typeof result.summaryId, "string");
  assert.equal(result.insightCount > 0, true);
  assert.equal(result.suggestionCount > 0, true);
});

test("JobWorkerHandlersService runs persisted retention cleanup", async () => {
  const database = createFakeDatabase();
  const sessionsService = new SessionsService(new RetentionService(), database);
  const workspacesService = new WorkspacesService(database);
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  await sessionsService.createSession(
    {
      ownerUserId: "google:user-1",
      workspaceId: workspace.id,
      title: "Expired session",
      primaryLanguage: "pt-BR",
      responseLanguage: "pt-BR",
      retentionMode: "seven_day_workspace",
      consentGrantIds: []
    },
    new Date("2026-05-01T12:00:00.000Z")
  );
  const handlers = new JobWorkerHandlersService(
    {},
    database,
    new ProvidersService({ env: { providerAdapter: "mock" } }),
    sessionsService,
    new SettingsService(database)
  );

  const result = await handlers.handleRetentionCleanup({ requestedAt: "2026-05-22T12:00:00.000Z" });

  assert.equal(result.cleaned.length, 1);
  assert.equal(result.cleaned[0]?.status, "deleted");
});
