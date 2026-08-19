import assert from "node:assert/strict";
import test from "node:test";

import { createMockProviderOutput, parseEnv } from "../dist/src/index.js";

test("parseEnv loads required configuration and defaults", () => {
  const env = parseEnv({
    DATABASE_URL: "postgres://example",
    REDIS_URL: "redis://example",
    AUTH_SESSION_SECRET: "secret",
    CREDENTIAL_ENCRYPTION_KEY: "key"
  });

  assert.equal(env.providerAdapter, "mock");
  assert.equal(env.sessionRetentionDays, 7);
  assert.equal(env.websocketUrl, "ws://localhost:4000/realtime");
  assert.equal(env.googleCallbackUrl, "http://localhost:4000/auth/google/callback");
});

test("parseEnv rejects missing required secrets", () => {
  assert.throws(() => parseEnv({}), /DATABASE_URL/);
});

test("mock provider returns deterministic safe outputs", () => {
  const output = createMockProviderOutput({
    sessionId: "session-1",
    transcriptText: "We should decide the rollout owner.",
    responseLanguage: "en"
  });

  assert.match(output.summary.content, /rollout owner/);
  assert.equal(output.transcript.provisional, false);
  assert.equal(output.suggestions[0]?.category, "response");
});
