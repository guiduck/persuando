import assert from "node:assert/strict";
import test from "node:test";

import { LoggingRedactionService } from "../dist/src/modules/logging/logging-redaction.service.js";

test("LoggingRedactionService redacts nested sensitive fields", () => {
  const service = new LoggingRedactionService();
  const redacted = service.redact({
    requestId: "req-1",
    authorization: "Bearer secret",
    providerPayload: {
      transcript: "sensitive text",
      audio: "binary-ish",
      safe: "visible"
    },
    nested: [{ apiKey: "sk-secret", message: "ok" }]
  });

  assert.deepEqual(redacted, {
    requestId: "req-1",
    authorization: "[REDACTED]",
    providerPayload: "[REDACTED]",
    nested: [{ apiKey: "[REDACTED]", message: "ok" }]
  });
});
