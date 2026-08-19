import { Injectable } from "@nestjs/common";
import type { ProviderCredentialId, RetentionMode, UserId, UserSettings } from "@persuando/contracts";

import { DatabaseService } from "../database/database.service.js";

export interface UpdateUserSettingsInput {
  providerCredentialId?: string;
  primaryLanguage: string;
  responseLanguage: string;
  preferredProgrammingLanguage: string;
  transcriptionModel: string;
  analysisModel: string;
  microphoneCaptureDefault: boolean;
  periodicScreenshotCaptureDefault: boolean;
  codePracticeContextDefault: boolean;
  autoScrollDefault: boolean;
  sessionTimerMinutes?: number;
  retentionMode: RetentionMode;
}

@Injectable()
export class SettingsService {
  readonly moduleName = "settings";

  constructor(private readonly database: DatabaseService) {}

  async getSettings(userId: string): Promise<UserSettings> {
    await ensureUser(this.database, userId);
    const settings = await this.database.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...defaultSettingsData()
      },
      update: {}
    });
    return toUserSettings(settings);
  }

  async updateSettings(userId: string, input: UpdateUserSettingsInput): Promise<UserSettings> {
    await ensureUser(this.database, userId);
    const updated = await this.database.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        providerCredentialId: input.providerCredentialId,
        primaryLanguage: input.primaryLanguage,
        responseLanguage: input.responseLanguage,
        preferredProgrammingLanguage: input.preferredProgrammingLanguage,
        transcriptionModel: input.transcriptionModel,
        analysisModel: input.analysisModel,
        microphoneCaptureDefault: input.microphoneCaptureDefault,
        periodicScreenshotCaptureDefault: input.periodicScreenshotCaptureDefault,
        codePracticeContextDefault: input.codePracticeContextDefault,
        autoScrollDefault: input.autoScrollDefault,
        sessionTimerMinutes: input.sessionTimerMinutes,
        retentionMode: input.retentionMode
      },
      update: {
        providerCredentialId: input.providerCredentialId,
        primaryLanguage: input.primaryLanguage,
        responseLanguage: input.responseLanguage,
        preferredProgrammingLanguage: input.preferredProgrammingLanguage,
        transcriptionModel: input.transcriptionModel,
        analysisModel: input.analysisModel,
        microphoneCaptureDefault: input.microphoneCaptureDefault,
        periodicScreenshotCaptureDefault: input.periodicScreenshotCaptureDefault,
        codePracticeContextDefault: input.codePracticeContextDefault,
        autoScrollDefault: input.autoScrollDefault,
        sessionTimerMinutes: input.sessionTimerMinutes,
        retentionMode: input.retentionMode,
        updatedAt: new Date()
      }
    });
    return toUserSettings(updated);
  }
}

interface UserSettingsRecord {
  userId: string;
  providerCredentialId: string | null;
  primaryLanguage: string;
  responseLanguage: string;
  preferredProgrammingLanguage: string;
  transcriptionModel: string;
  analysisModel: string;
  microphoneCaptureDefault: boolean;
  periodicScreenshotCaptureDefault: boolean;
  codePracticeContextDefault: boolean;
  autoScrollDefault: boolean;
  sessionTimerMinutes: number | null;
  retentionMode: string;
}

function defaultSettingsData() {
  return {
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
  };
}

function toUserSettings(record: UserSettingsRecord): UserSettings {
  return {
      userId: record.userId as UserId,
      providerCredentialId: record.providerCredentialId as ProviderCredentialId | undefined,
      primaryLanguage: record.primaryLanguage,
      responseLanguage: record.responseLanguage,
      preferredProgrammingLanguage: record.preferredProgrammingLanguage,
      transcriptionModel: record.transcriptionModel,
      analysisModel: record.analysisModel,
      microphoneCaptureDefault: record.microphoneCaptureDefault,
      periodicScreenshotCaptureDefault: record.periodicScreenshotCaptureDefault,
      codePracticeContextDefault: record.codePracticeContextDefault,
      autoScrollDefault: record.autoScrollDefault,
      sessionTimerMinutes: record.sessionTimerMinutes ?? undefined,
      retentionMode: record.retentionMode as RetentionMode
  };
}

async function ensureUser(database: DatabaseService, userId: string): Promise<void> {
  await database.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${userId.replaceAll(":", "_")}@local.persuando.dev`,
      displayName: userId,
      locale: "en"
    },
    update: {}
  });
}
