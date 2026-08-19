import assert from "node:assert/strict";
import test from "node:test";

import { ConsentService } from "../dist/src/modules/consent/consent.service.js";
import { RetentionService } from "../dist/src/modules/retention/retention.service.js";
import { SessionsController } from "../dist/src/modules/sessions/sessions.controller.js";
import { SessionsService } from "../dist/src/modules/sessions/sessions.service.js";
import { WorkspaceAccessService } from "../dist/src/modules/workspaces/workspace-access.service.js";
import { WorkspacesController } from "../dist/src/modules/workspaces/workspaces.controller.js";
import { WorkspacesService } from "../dist/src/modules/workspaces/workspaces.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

function buildHarness() {
  const database = createFakeDatabase();
  const retentionService = new RetentionService();
  const sessionsService = new SessionsService(retentionService, database);
  const workspacesService = new WorkspacesService(database);
  const accessService = new WorkspaceAccessService();
  const consentService = new ConsentService(database);
  const authService = {
    verifyUserSessionToken() {
      return undefined;
    }
  };
  const sessionsController = new SessionsController(
    sessionsService,
    workspacesService,
    accessService,
    consentService,
    authService
  );
  const workspacesController = new WorkspacesController(workspacesService, sessionsService, authService);
  return { database, sessionsController, sessionsService, workspacesController, workspacesService };
}

test("SessionsController creates and fetches a same-account session", async () => {
  const { sessionsController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const created = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "Live meeting",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  const fetched = await sessionsController.getSession(undefined, "google:user-1", created.session.id);

  assert.equal(created.session.ownerUserId, "google:user-1");
  assert.equal(fetched.session.id, created.session.id);
  assert.equal(fetched.consentGrants.length, 0);
});

test("SessionsController denies cross-account session fetch", async () => {
  const { sessionsController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const created = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "Private meeting",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });

  await assert.rejects(() => sessionsController.getSession(undefined, "google:user-2", created.session.id), /another account/i);
});

test("SessionsController fetches retained session history artifacts", async () => {
  const { database, sessionsController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const created = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "History meeting",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  await database.transcriptSegment.create({
    data: {
      id: "segment-1",
      sessionId: created.session.id,
      text: "Primeiro trecho transcrito.",
      startMs: 0,
      endMs: 800,
      confidence: 0.96,
      source: "microphone",
      language: "pt-BR",
      provisional: false
    }
  });
  await database.summary.create({
    data: {
      id: "summary-1",
      sessionId: created.session.id,
      content: "Resumo inicial.",
      sourceSegmentIds: ["segment-1"],
      generatedAt: new Date("2026-05-22T12:00:01.000Z")
    }
  });
  await database.insight.create({
    data: {
      id: "insight-1",
      sessionId: created.session.id,
      insightType: "question",
      content: "Qual e o prazo?",
      confidence: 0.8,
      sourceSegmentIds: ["segment-1"],
      generatedAt: new Date("2026-05-22T12:00:02.000Z")
    }
  });
  await database.suggestion.create({
    data: {
      id: "suggestion-1",
      sessionId: created.session.id,
      category: "response",
      content: "Eu confirmaria o prazo.",
      urgency: "medium",
      sourceSegmentIds: ["segment-1"],
      generatedAt: new Date("2026-05-22T12:00:03.000Z")
    }
  });

  const history = await sessionsController.getSession(undefined, "google:user-1", created.session.id);

  assert.equal(history.transcriptSegments[0]?.text, "Primeiro trecho transcrito.");
  assert.equal(history.summaries[0]?.content, "Resumo inicial.");
  assert.equal(history.insights[0]?.content, "Qual e o prazo?");
  assert.equal(history.suggestions[0]?.content, "Eu confirmaria o prazo.");
});

test("WorkspacesController lists active and recent visible sessions for current user", async () => {
  const { sessionsController, sessionsService, workspacesController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const active = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "Active meeting",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  const recent = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "Ended meeting",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  await sessionsService.markActive(active.session.id);
  await sessionsService.endSession(recent.session.id);

  const state = await workspacesController.getCurrentWorkspace(undefined, "google:user-1");

  assert.deepEqual(state.activeSessions.map((session) => session.title), ["Active meeting"]);
  assert.deepEqual(state.recentSessions.map((session) => session.title), ["Ended meeting"]);
  assert.deepEqual(state.workspace.activeSessionIds, [active.session.id]);
  assert.deepEqual(state.workspace.recentSessionIds, [recent.session.id]);
});

test("SessionsService ends stale open sessions when listing visible sessions", async () => {
  const { sessionsService, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const stale = await sessionsService.createSession(
    {
      workspaceId: workspace.id,
      ownerUserId: "google:user-1",
      title: "Abandoned capture",
      primaryLanguage: "pt-BR",
      responseLanguage: "pt-BR",
      retentionMode: "seven_day_workspace",
      consentGrantIds: []
    },
    new Date("2026-08-07T10:00:00.000Z")
  );
  await sessionsService.markActive(stale.id);

  const sessions = await sessionsService.listVisibleSessionsForUser("google:user-1", new Date("2026-08-07T12:30:00.000Z"));

  const listed = sessions.find((session) => session.id === stale.id);
  assert.equal(listed?.status, "ended");
  assert.equal(listed?.endedAt, "2026-08-07T12:30:00.000Z");
});

test("SessionsService ends older open capture sessions when creating a new session", async () => {
  const { sessionsService, workspacesController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const now = new Date();
  const older = await sessionsService.createSession(
    {
      workspaceId: workspace.id,
      ownerUserId: "google:user-1",
      title: "Older active capture",
      primaryLanguage: "pt-BR",
      responseLanguage: "pt-BR",
      retentionMode: "seven_day_workspace",
      consentGrantIds: []
    },
    new Date(now.getTime() - 60_000)
  );
  await sessionsService.markActive(older.id);
  const newer = await sessionsService.createSession(
    {
      workspaceId: workspace.id,
      ownerUserId: "google:user-1",
      title: "Newest active capture",
      primaryLanguage: "pt-BR",
      responseLanguage: "pt-BR",
      retentionMode: "seven_day_workspace",
      consentGrantIds: []
    },
    now
  );

  const state = await workspacesController.getCurrentWorkspace(undefined, "google:user-1");

  assert.deepEqual(state.activeSessions.map((session) => session.id), [newer.id]);
  assert.equal(state.recentSessions.find((session) => session.id === older.id)?.status, "ended");
});
test("SessionsController manual delete removes a session from visible workspace history", async () => {
  const { sessionsController, sessionsService, workspacesController, workspacesService } = buildHarness();
  const workspace = await workspacesService.getOrCreateCurrentWorkspace("google:user-1");
  const created = await sessionsController.createSession(undefined, "google:user-1", {
    workspaceId: workspace.id,
    title: "Delete me",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    retentionMode: "seven_day_workspace",
    consentGrantIds: []
  });
  await sessionsService.endSession(created.session.id);

  const deleted = await sessionsController.deleteSession(undefined, "google:user-1", created.session.id);
  const state = await workspacesController.getCurrentWorkspace(undefined, "google:user-1");

  assert.equal(deleted.sessionId, created.session.id);
  assert.equal(state.recentSessions.length, 0);
  await assert.rejects(() => sessionsController.getSession(undefined, "google:user-1", created.session.id), /not found/i);
});
