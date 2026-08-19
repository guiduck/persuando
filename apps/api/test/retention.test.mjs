import assert from "node:assert/strict";
import test from "node:test";

import { RetentionCleanupJob } from "../dist/src/modules/retention/retention-cleanup.job.js";
import { RetentionService } from "../dist/src/modules/retention/retention.service.js";

const now = new Date("2026-05-22T12:00:00.000Z");

function session(overrides = {}) {
  return {
    id: "session-1",
    workspaceId: "workspace-1",
    ownerUserId: "google:user-1",
    title: "Test session",
    status: "ended",
    retentionExpiresAt: "2026-05-29T12:00:00.000Z",
    activeResponseClientIds: [],
    ...overrides
  };
}

test("RetentionService applies 7-day workspace retention", () => {
  const service = new RetentionService();
  const retained = service.applyRetentionPolicy(
    {
      id: "session-1",
      status: "created"
    },
    "seven_day_workspace",
    now
  );

  assert.equal(retained.retentionExpiresAt, "2026-05-29T12:00:00.000Z");
});

test("RetentionService filters deleted and expired sessions from visible history", () => {
  const service = new RetentionService();
  const visible = service.filterVisibleSessions(
    [
      session({ id: "visible", retentionExpiresAt: "2026-05-23T12:00:00.000Z" }),
      session({ id: "expired", retentionExpiresAt: "2026-05-21T12:00:00.000Z" }),
      session({ id: "deleted", deletedAt: "2026-05-22T11:00:00.000Z" })
    ],
    now
  );

  assert.deepEqual(visible.map((item) => item.id), ["visible"]);
});

test("RetentionService manual delete is idempotent", () => {
  const service = new RetentionService();
  const deleted = service.manualDeleteSession(session(), now);
  const repeated = service.manualDeleteSession(deleted, new Date("2026-05-22T13:00:00.000Z"));

  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.deletedAt, "2026-05-22T12:00:00.000Z");
  assert.equal(repeated.deletedAt, "2026-05-22T12:00:00.000Z");
});

test("RetentionCleanupJob marks expired sessions deleted and keeps retained sessions", () => {
  const service = new RetentionService();
  const job = new RetentionCleanupJob(service);
  const result = job.run(
    [
      session({ id: "expired", retentionExpiresAt: "2026-05-21T12:00:00.000Z" }),
      session({ id: "retained", retentionExpiresAt: "2026-05-23T12:00:00.000Z" }),
      session({ id: "already-deleted", deletedAt: "2026-05-20T12:00:00.000Z" })
    ],
    now
  );

  assert.deepEqual(result.cleaned.map((item) => item.id), ["expired"]);
  assert.equal(result.cleaned[0]?.status, "deleted");
  assert.deepEqual(result.retained.map((item) => item.id), ["retained", "already-deleted"]);
});
