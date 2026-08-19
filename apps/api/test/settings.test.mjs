import assert from "node:assert/strict";
import test from "node:test";

import { SettingsController } from "../dist/src/modules/settings/settings.controller.js";
import { SettingsService } from "../dist/src/modules/settings/settings.service.js";
import { createFakeDatabase } from "./fake-database.mjs";

test("SettingsService returns toolbar-first MVP defaults", async () => {
  const service = new SettingsService(createFakeDatabase());
  const settings = await service.getSettings("google:user-1");

  assert.equal(settings.primaryLanguage, "pt-BR");
  assert.equal(settings.transcriptionModel, "gpt-4o-mini-transcribe");
  assert.equal(settings.analysisModel, "gpt-4o-mini");
  assert.equal(settings.autoScrollDefault, true);
  assert.equal(settings.periodicScreenshotCaptureDefault, false);
});

test("SettingsService updates provider, language, capture defaults, and retention settings", async () => {
  const service = new SettingsService(createFakeDatabase());
  const settings = await service.updateSettings("google:user-1", {
    providerCredentialId: "credential-1",
    primaryLanguage: "en-US",
    responseLanguage: "pt-BR",
    preferredProgrammingLanguage: "python",
    transcriptionModel: "gpt-4o-transcribe",
    analysisModel: "gpt-4o",
    microphoneCaptureDefault: true,
    periodicScreenshotCaptureDefault: true,
    codePracticeContextDefault: true,
    autoScrollDefault: false,
    sessionTimerMinutes: 45,
    retentionMode: "seven_day_workspace"
  });

  assert.equal(settings.providerCredentialId, "credential-1");
  assert.equal(settings.primaryLanguage, "en-US");
  assert.equal(settings.microphoneCaptureDefault, true);
  assert.equal(settings.periodicScreenshotCaptureDefault, true);
  assert.equal(settings.sessionTimerMinutes, 45);
});

test("SettingsController returns settings with masked provider credential metadata", async () => {
  const settingsService = new SettingsService(createFakeDatabase());
  const credential = {
    id: "credential-1",
    userId: "google:user-1",
    providerName: "openai-compatible",
    maskedDisplayValue: "sk-t...alue",
    encryptionVersion: "test-v1",
    validationStatus: "valid"
  };
  const controller = new SettingsController(
    settingsService,
    {
      verifyUserSessionToken() {
        return undefined;
      }
    },
    {
      async getCredentialMetadata() {
        return credential;
      }
    }
  );

  await controller.updateSettings(undefined, "google:user-1", {
    providerCredentialId: "credential-1",
    primaryLanguage: "pt-BR",
    responseLanguage: "pt-BR",
    preferredProgrammingLanguage: "typescript",
    transcriptionModel: "gpt-4o-mini-transcribe",
    analysisModel: "gpt-4o-mini",
    microphoneCaptureDefault: false,
    periodicScreenshotCaptureDefault: false,
    codePracticeContextDefault: false,
    autoScrollDefault: true,
    sessionTimerMinutes: 30,
    retentionMode: "seven_day_workspace"
  });
  const response = await controller.getSettings(undefined, "google:user-1");

  assert.equal(response.settings.providerCredentialId, "credential-1");
  assert.equal(response.providerCredential?.maskedDisplayValue, "sk-t...alue");
});
