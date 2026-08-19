import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { CredentialsService } from "../credentials/credentials.service.js";
import { DatabaseService } from "../database/database.service.js";
import { ProvidersService } from "../providers/providers.service.js";
import { SessionsService } from "../sessions/sessions.service.js";
import { SettingsService } from "../settings/settings.service.js";
import type {
  ProviderCredentialValidationJob,
  RetentionCleanupJobPayload,
  SessionAssistanceGenerationJob
} from "./job-contracts.js";

@Injectable()
export class JobWorkerHandlersService {
  readonly moduleName = "jobs.worker_handlers";

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly database: DatabaseService,
    private readonly providersService: ProvidersService,
    private readonly sessionsService: SessionsService,
    private readonly settingsService: SettingsService
  ) {}

  handleProviderCredentialValidation(input: ProviderCredentialValidationJob) {
    return this.credentialsService.validateCredential(input.userId, input.credentialId);
  }

  async handleSessionAssistanceGeneration(input: SessionAssistanceGenerationJob): Promise<{
    summaryId?: string;
    insightCount: number;
    suggestionCount: number;
  }> {
    const settings = await this.settingsService.getSettings(input.userId);
    const apiKey = settings.providerCredentialId
      ? await this.credentialsService.decryptForProviderCall(input.userId, settings.providerCredentialId)
      : undefined;
    const segments = await this.database.transcriptSegment.findMany({
      where: { sessionId: input.sessionId },
      orderBy: { startMs: "desc" },
      take: 12
    });
    const orderedSegments = segments.sort((left, right) => Number(left.startMs) - Number(right.startMs));
    if (orderedSegments.length === 0) {
      return { insightCount: 0, suggestionCount: 0 };
    }

    const sourceSegmentIds = orderedSegments.map((segment) => segment.id);
    const generatedAt = new Date();
    const output = await this.providersService.generate({
      apiKey,
      analysisModel: settings.analysisModel,
      responseLanguage: settings.responseLanguage,
      sessionId: input.sessionId,
      transcriptText: orderedSegments.map((segment) => segment.text).join("\n")
    });
    const summary = await this.database.summary.create({
      data: {
        id: randomUUID(),
        sessionId: input.sessionId,
        content: output.summary.content,
        sourceSegmentIds,
        generatedAt
      }
    });

    for (const insight of output.insights) {
      await this.database.insight.create({
        data: {
          id: randomUUID(),
          sessionId: input.sessionId,
          insightType: insight.type,
          content: insight.content,
          confidence: insight.confidence,
          sourceSegmentIds,
          generatedAt
        }
      });
    }

    for (const suggestion of output.suggestions) {
      await this.database.suggestion.create({
        data: {
          id: randomUUID(),
          sessionId: input.sessionId,
          category: suggestion.category,
          content: suggestion.content,
          urgency: suggestion.urgency,
          sourceSegmentIds,
          generatedAt
        }
      });
    }

    return {
      summaryId: summary.id,
      insightCount: output.insights.length,
      suggestionCount: output.suggestions.length
    };
  }

  handleRetentionCleanup(input: RetentionCleanupJobPayload) {
    return this.sessionsService.cleanupExpiredSessions(new Date(input.requestedAt));
  }
}
