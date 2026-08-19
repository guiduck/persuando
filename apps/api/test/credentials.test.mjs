import assert from "node:assert/strict";
import test from "node:test";

import { CredentialsController } from "../dist/src/modules/credentials/credentials.controller.js";
import { CredentialsService } from "../dist/src/modules/credentials/credentials.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

const config = {
  env: {
    credentialEncryptionKey: "test-credential-encryption-key",
    credentialEncryptionKeyVersion: "test-v1"
  }
};

test("CredentialsService stores only masked credential metadata", async () => {
  const service = new CredentialsService(config, createFakeDatabase());
  const metadata = await service.createCredential({
    userId: "google:user-1",
    providerName: "openai-compatible",
    secret: "sk-test-secret-value"
  });

  assert.equal(metadata.userId, "google:user-1");
  assert.equal(metadata.providerName, "openai-compatible");
  assert.equal(metadata.encryptionVersion, "test-v1");
  assert.equal(metadata.validationStatus, "unverified");
  assert.equal(metadata.maskedDisplayValue, "sk-t...alue");
  assert.equal(JSON.stringify(metadata).includes("sk-test-secret-value"), false);
});

test("CredentialsService decrypts secrets only through backend provider-call access", async () => {
  const service = new CredentialsService(config, createFakeDatabase());
  const metadata = await service.createCredential({
    userId: "google:user-1",
    providerName: "openai-compatible",
    secret: "sk-provider-secret"
  });

  assert.equal(await service.decryptForProviderCall("google:user-1", metadata.id), "sk-provider-secret");
  await assert.rejects(() => service.decryptForProviderCall("google:user-2", metadata.id), /not found/i);
});

test("CredentialsService tracks invalid and deleted credential states", async () => {
  const service = new CredentialsService(config, createFakeDatabase());
  const metadata = await service.createCredential({
    userId: "google:user-1",
    providerName: "openai-compatible",
    secret: "sk-provider-secret"
  });

  assert.equal((await service.markInvalid("google:user-1", metadata.id)).validationStatus, "invalid");
  assert.equal((await service.deleteCredential("google:user-1", metadata.id)).validationStatus, "deleted");
  await assert.rejects(() => service.decryptForProviderCall("google:user-1", metadata.id), /not available/i);
});

test("CredentialsService validates credentials with safe metadata responses", async () => {
  const service = new CredentialsService(config, createFakeDatabase());
  const metadata = await service.createCredential({
    userId: "google:user-1",
    providerName: "openai-compatible",
    secret: "sk-provider-secret"
  });

  const result = await service.validateCredential("google:user-1", metadata.id);

  assert.equal(result.ok, true);
  assert.equal(result.credential.validationStatus, "valid");
  assert.equal(result.safeMessage.includes("sk-provider-secret"), false);
});

test("CredentialsController exposes create, metadata, validate, and delete endpoints", async () => {
  const service = new CredentialsService(config, createFakeDatabase());
  const auditEvents = [];
  const controller = new CredentialsController(
    service,
    {
      verifyUserSessionToken() {
        return undefined;
      }
    },
    {
      createEvent(input) {
        auditEvents.push(input);
        return { id: "audit-1", userId: input.userId, type: input.type, createdAt: new Date().toISOString() };
      }
    }
  );

  const created = await controller.createCredential(undefined, "google:user-1", {
    providerName: "openai-compatible",
    secret: "sk-provider-secret"
  });
  const fetched = await controller.getCredential(undefined, "google:user-1", created.credential.id);
  const validation = await controller.validateCredential(undefined, "google:user-1", created.credential.id);
  const deleted = await controller.deleteCredential(undefined, "google:user-1", created.credential.id);

  assert.equal(fetched.credential.id, created.credential.id);
  assert.equal(validation.ok, true);
  assert.equal(deleted.credential.validationStatus, "deleted");
  assert.deepEqual(auditEvents.map((event) => event.type), [
    "provider_credential.created",
    "provider_credential.deleted"
  ]);
});
