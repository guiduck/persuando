import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceAccessService } from "../dist/src/modules/workspaces/workspace-access.service.js";

const user = {
  id: "google:user-1",
  email: "person@example.com",
  displayName: "Person",
  provider: "google"
};

test("WorkspaceAccessService allows same-account workspace and session access", () => {
  const service = new WorkspaceAccessService();

  assert.doesNotThrow(() => service.assertWorkspaceAccess(user, { id: "workspace-1", ownerUserId: "google:user-1" }));
  assert.doesNotThrow(() =>
    service.assertSessionAccess(user, {
      id: "session-1",
      ownerUserId: "google:user-1",
      workspaceId: "workspace-1"
    })
  );
});

test("WorkspaceAccessService rejects cross-account and deleted resources", () => {
  const service = new WorkspaceAccessService();

  assert.throws(() => service.assertWorkspaceAccess(user, { id: "workspace-1", ownerUserId: "google:other" }), /another account/);
  assert.throws(
    () => service.assertSessionAccess(user, { id: "session-1", ownerUserId: "google:user-1", workspaceId: "workspace-1", deletedAt: "now" }),
    /not found/i
  );
});
