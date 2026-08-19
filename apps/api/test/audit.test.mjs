import assert from "node:assert/strict";
import test from "node:test";

import { AuditService } from "../dist/src/modules/audit/audit.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

test("AuditService creates safe audit events for sensitive lifecycle actions", async () => {
  const service = new AuditService(createFakeDatabase());
  const event = await service.createEvent({
    userId: "google:user-1",
    sessionId: "session-1",
    type: "provider_credential.created",
    metadata: {
      providerName: "openai-compatible",
      apiKey: "sk-secret",
      credential: "secret"
    }
  });

  assert.equal(event.userId, "google:user-1");
  assert.equal(event.type, "provider_credential.created");
  assert.equal(event.metadata?.providerName, "openai-compatible");
  assert.equal(event.metadata?.apiKey, "[REDACTED]");
  assert.equal(event.metadata?.credential, "[REDACTED]");
});
