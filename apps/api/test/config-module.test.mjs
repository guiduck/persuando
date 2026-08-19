import assert from "node:assert/strict";
import test from "node:test";

import { ApiConfigService } from "../dist/src/modules/config/config.service.js";

const baseEnv = {
  DATABASE_URL: "postgres://example",
  REDIS_URL: "redis://example",
  AUTH_SESSION_SECRET: "secret",
  CREDENTIAL_ENCRYPTION_KEY: "key",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret"
};

test("ApiConfigService loads backend runtime configuration", () => {
  const config = new ApiConfigService(baseEnv);
  assert.equal(config.env.databaseUrl, "postgres://example");
  assert.equal(config.env.redisUrl, "redis://example");
  assert.equal(config.env.googleClientId, "google-client");
  assert.equal(config.env.providerAdapter, "mock");
});

test("ApiConfigService requires Google credentials outside local/test environments", () => {
  assert.throws(
    () =>
      new ApiConfigService({
        ...baseEnv,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        NODE_ENV: "production"
      }),
    /Google auth credentials/
  );
});
