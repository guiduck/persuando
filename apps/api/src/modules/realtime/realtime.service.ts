import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import {
  type CaptureAudioChunkEvent,
  type CaptureStatusEvent,
  type CodeCopilotContext,
  type CopilotContextEvent,
  type Insight,
  type InsightId,
  isKnownWebSocketEventType,
  type PersuandoWebSocketEvent,
  type ResponseAckEvent,
  type ResponseGenerateEvent,
  type ResponseSubscribeEvent,
  type ResponseUnsubscribeEvent,
  type SessionId,
  type SessionStatus,
  type Suggestion,
  type SuggestionId,
  type Summary,
  type TranscriptSegment,
  type TranscriptSegmentId
} from "@persuando/contracts";
import { randomUUID } from "node:crypto";

import type { AuthenticatedUser } from "../auth/auth.service.js";
import { ConsentService } from "../consent/consent.service.js";
import { CredentialsService } from "../credentials/credentials.service.js";
import { DatabaseService } from "../database/database.service.js";
import { ProviderAdapterError, toSafeProviderError } from "../providers/provider-adapter.js";
import { ProvidersService } from "../providers/providers.service.js";
import { SessionsService } from "../sessions/sessions.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";

export type RealtimeClientType = "capture" | "response";

export interface RealtimeClient {
  activeCaptureSessionIds: Set<string>;
  clientId: string;
  user: AuthenticatedUser;
  clientType: RealtimeClientType;
  subscribedSessionIds: Set<string>;
  lastAckBySessionId: Map<string, number>;
}

export type RealtimeHandleResult =
  | { action: "subscribed"; replayedEvents: PersuandoWebSocketEvent[] }
  | { action: "unsubscribed" }
  | { action: "acknowledged"; lastReceivedSequence: number }
  | { action: "audio_chunk_accepted"; chunkSequence: number; transcriptSegmentId?: string }
  | { action: "accepted" };

export const REALTIME_INGESTION_OPTIONS = "REALTIME_INGESTION_OPTIONS";

@Injectable()
export class RealtimeService {
  readonly moduleName = "realtime";
  private readonly logger = new Logger(RealtimeService.name);
  private readonly clients = new Map<string, RealtimeClient>();
  private readonly eventsBySessionId = new Map<string, PersuandoWebSocketEvent[]>();
  private readonly eventListeners = new Set<(event: PersuandoWebSocketEvent) => void>();
  private nextSequence = 1;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly consentService: ConsentService,
    private readonly database: DatabaseService,
    private readonly providersService: ProvidersService,
    private readonly settingsService: SettingsService,
    private readonly credentialsService: CredentialsService,
    @Optional()
    @Inject(REALTIME_INGESTION_OPTIONS)
    private readonly options: RealtimeIngestionOptions = {}
  ) {}

  connectClient(input: { clientId: string; user?: AuthenticatedUser; clientType: RealtimeClientType }): RealtimeClient {
    if (!input.user) {
      throw new UnauthorizedException("Realtime authentication required");
    }

    const client: RealtimeClient = {
      activeCaptureSessionIds: new Set(),
      clientId: input.clientId,
      user: input.user,
      clientType: input.clientType,
      subscribedSessionIds: new Set(),
      lastAckBySessionId: new Map()
    };
    this.clients.set(input.clientId, client);
    return client;
  }

  async disconnectClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    this.clients.delete(clientId);
    if (!client || client.clientType !== "capture") return;

    for (const sessionId of client.activeCaptureSessionIds) {
      const session = await this.sessionsService.getSession(sessionId);
      if (!session || (session.status !== "active" && session.status !== "paused")) continue;
      const ended = await this.sessionsService.endSession(sessionId);
      if (!ended) continue;
      this.publishServerEvent({
        version: 1,
        type: "session.status",
        sessionId: sessionId as SessionId,
        sentAt: new Date().toISOString(),
        payload: {
          status: ended.status,
          safeMessage: "Capture client disconnected."
        }
      });
    }
  }

  async handleClientEvent(clientId: string, event: unknown): Promise<RealtimeHandleResult> {
    const client = this.getClient(clientId);
    const parsed = parseRealtimeEvent(event);
    await this.assertSessionAccess(client, parsed.sessionId);

    if (parsed.type === "response.subscribe") {
      return this.subscribe(client, parsed);
    }

    if (parsed.type === "response.unsubscribe") {
      client.subscribedSessionIds.delete(parsed.sessionId);
      return { action: "unsubscribed" };
    }

    if (parsed.type === "response.ack") {
      client.lastAckBySessionId.set(parsed.sessionId, parsed.payload.lastReceivedSequence);
      return { action: "acknowledged", lastReceivedSequence: parsed.payload.lastReceivedSequence };
    }

    if (parsed.type === "response.generate") {
      return this.generateManualAssistance(client, parsed);
    }

    if (parsed.type === "capture.status") {
      return this.updateCaptureStatus(client, parsed);
    }

    if (parsed.type === "capture.audio_chunk") {
      return this.ingestAudioChunk(client, parsed);
    }

    if (parsed.type === "copilot.context") {
      return this.ingestCopilotContext(client, parsed);
    }

    if (!client.subscribedSessionIds.has(parsed.sessionId) && client.clientType === "response") {
      throw new ForbiddenException("Client is not subscribed to session");
    }

    this.appendEvent(parsed);
    return { action: "accepted" };
  }

  publishServerEvent(event: Omit<PersuandoWebSocketEvent, "sequence">): PersuandoWebSocketEvent {
    const withSequence = {
      ...event,
      sequence: this.nextSequence++
    } as PersuandoWebSocketEvent;
    this.appendEvent(withSequence);
    return withSequence;
  }

  getClient(clientId: string): RealtimeClient {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new UnauthorizedException("Realtime client is not connected");
    }
    return client;
  }

  onEvent(listener: (event: PersuandoWebSocketEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  isSubscribed(clientId: string, sessionId: string): boolean {
    return this.clients.get(clientId)?.subscribedSessionIds.has(sessionId) ?? false;
  }

  private async updateCaptureStatus(client: RealtimeClient, event: CaptureStatusEvent): Promise<RealtimeHandleResult> {
    if (client.clientType !== "capture") {
      throw new ForbiddenException("Only Capture Mode clients can update capture status");
    }

    const nextStatus = sessionStatusFromCaptureStatus(event.payload.status);
    if (nextStatus === "active") client.activeCaptureSessionIds.add(event.sessionId);
    if (nextStatus === "ended" || nextStatus === "revoked" || nextStatus === "error") {
      client.activeCaptureSessionIds.delete(event.sessionId);
    }
    const updated = nextStatus === "ended"
      ? await this.sessionsService.endSession(event.sessionId)
      : await this.sessionsService.updateSessionStatus(event.sessionId, nextStatus);
    if (!updated) {
      throw new NotFoundException("Session not found");
    }

    this.appendEvent(event);
    this.publishServerEvent({
      version: 1,
      type: "session.status",
      sessionId: event.sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        status: updated.status,
        safeMessage: captureStatusMessage(event.payload.status)
      }
    });
    return { action: "accepted" };
  }

  private subscribe(client: RealtimeClient, event: ResponseSubscribeEvent): RealtimeHandleResult {
    client.subscribedSessionIds.add(event.sessionId);
    const lastSeenSequence = event.payload.lastSeenSequence ?? client.lastAckBySessionId.get(event.sessionId) ?? 0;
    const replayedEvents = (this.eventsBySessionId.get(event.sessionId) ?? []).filter(
      (storedEvent) => (storedEvent.sequence ?? 0) > lastSeenSequence
    );

    return { action: "subscribed", replayedEvents };
  }

  private async assertSessionAccess(client: RealtimeClient, sessionId: string): Promise<void> {
    const session = await this.sessionsService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    this.workspaceAccessService.assertSessionAccess(client.user, session);
  }

  private async ingestAudioChunk(client: RealtimeClient, event: CaptureAudioChunkEvent): Promise<RealtimeHandleResult> {
    if (client.clientType !== "capture") {
      throw new ForbiddenException("Only Capture Mode clients can upload audio chunks");
    }

    const session = await this.sessionsService.getSession(event.sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    this.workspaceAccessService.assertSessionAccess(client.user, session);

    if (session.status !== "active") {
      throw new ForbiddenException("Session must be active before audio upload");
    }

    const consentGrants = await this.consentService.listGrants(client.user.id, event.sessionId);
    this.assertAudioUploadConsent(consentGrants);
    this.assertAudioTranscriptionConsent(consentGrants);

    if (this.providersService.getActiveAdapterName() !== "mock") {
      const providerConsentDecision = this.consentService.requireExternalProviderConsent(consentGrants);
      if (!providerConsentDecision.ok) {
        throw new ForbiddenException(`Provider transcription blocked: ${providerConsentDecision.code}`);
      }
    }

    validateAudioChunkPayload(event);
    this.logger.log(
      `Audio chunk received: sessionId=${event.sessionId} chunkSequence=${event.payload.chunkSequence} byteLength=${event.payload.byteLength} codec=${event.payload.codec}`
    );
    await this.assertAudioChunkSequence(event);
    await this.assertAudioBackpressure(event.sessionId);
    client.activeCaptureSessionIds.add(event.sessionId);

    await this.database.captureEvent.create({
      data: {
        id: randomUUID(),
        sessionId: event.sessionId,
        eventType: event.type,
        sequence: BigInt(event.payload.chunkSequence),
        occurredAt: new Date(event.payload.clientTimestamp),
        safeMetadata: {
          clientId: client.clientId,
          codec: event.payload.codec,
          durationMs: event.payload.durationMs,
          byteLength: event.payload.byteLength
        }
      }
    });
    this.appendEvent(redactAudioChunkEvent(event));

    let transcriptSegment: TranscriptSegment | undefined;
    try {
      transcriptSegment = await this.transcribeAcceptedAudioChunk(client, event);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.publishSafeProviderError(event.sessionId, error);
      const safeError = toSafeProviderError(error);
      this.logger.warn(
        `Transcription provider failed: sessionId=${event.sessionId} chunkSequence=${event.payload.chunkSequence} code=${safeError.code} retryable=${safeError.retryable} message=${safeError.message}`
      );
      if (error instanceof ProviderAdapterError && error.retryable) {
        return {
          action: "audio_chunk_accepted",
          chunkSequence: event.payload.chunkSequence
        };
      }
      throw error;
    }

    if (!transcriptSegment) {
      return {
        action: "audio_chunk_accepted",
        chunkSequence: event.payload.chunkSequence
      };
    }

    this.publishServerEvent({
      version: 1,
      type: "transcript.segment",
      sessionId: event.sessionId,
      sentAt: new Date().toISOString(),
      payload: { segment: transcriptSegment }
    });

    if (event.payload.chunkSequence === 1 || event.payload.chunkSequence % 5 === 0) {
      try {
        await this.generateSessionAssistance(client, event.sessionId, transcriptSegment);
      } catch (error) {
        this.publishSafeProviderError(event.sessionId, error);
        const safeError = toSafeProviderError(error);
        this.logger.warn(
          `Assistance generation failed: sessionId=${event.sessionId} chunkSequence=${event.payload.chunkSequence} code=${safeError.code} retryable=${safeError.retryable} message=${safeError.message}`
        );
      }
    }

    return {
      action: "audio_chunk_accepted",
      chunkSequence: event.payload.chunkSequence,
      transcriptSegmentId: transcriptSegment.id
    };
  }

  private async ingestCopilotContext(client: RealtimeClient, event: CopilotContextEvent): Promise<RealtimeHandleResult> {
    if (client.clientType !== "capture") {
      throw new ForbiddenException("Only Capture Mode clients can upload copilot context");
    }

    const session = await this.sessionsService.getSession(event.sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    this.workspaceAccessService.assertSessionAccess(client.user, session);
    this.logger.log(
      `Copilot context access ok: sessionId=${event.sessionId} contextId=${event.payload.contextId} sessionStatus=${session.status} clientId=${client.clientId}`
    );

    if (session.status !== "active") {
      throw new ForbiddenException("Session must be active before copilot context upload");
    }

    validateCopilotContextPayload(event);
    this.logger.log(
      `Copilot context received: sessionId=${event.sessionId} contextId=${event.payload.contextId} hasImage=${Boolean(event.payload.imageReference)} textLength=${event.payload.textContext?.length ?? 0}`
    );
    const consentGrants = await this.consentService.listGrants(client.user.id, event.sessionId);
    this.logger.log(
      `Copilot context consent check: sessionId=${event.sessionId} contextId=${event.payload.contextId} grantCount=${consentGrants.length} adapter=${this.providersService.getActiveAdapterName()}`
    );
    await this.assertCodeCopilotConsent(consentGrants);
    if (this.providersService.getActiveAdapterName() !== "mock") {
      const providerConsentDecision = this.consentService.requireExternalProviderConsent(consentGrants);
      if (!providerConsentDecision.ok) {
        throw new ForbiddenException(`Copilot provider blocked: ${providerConsentDecision.code}`);
      }
    }

    const context = await this.persistCopilotContext(event);
    this.logger.log(
      `Copilot context persisted: sessionId=${event.sessionId} contextId=${context.id} hasImage=${Boolean(event.payload.imageReference)} status=${context.status}`
    );
    const appendedContext = this.appendEvent(event);
    this.logger.log(
      `Copilot context fanout queued: sessionId=${event.sessionId} contextId=${context.id} sequence=${appendedContext.sequence ?? "none"} listeners=${this.eventListeners.size}`
    );

    if (isPeriodicScreenContext(event)) {
      this.logger.log(
        `Periodic screen context accepted without generation: sessionId=${event.sessionId} contextId=${context.id}`
      );
      return { action: "accepted" };
    }

    try {
      const explanation = await this.generateCopilotExplanation(client, event, context);
      this.publishServerEvent({
        version: 1,
        type: "copilot.explanation",
        sessionId: event.sessionId,
        sentAt: new Date().toISOString(),
        payload: {
          contextId: context.id,
          content: explanation,
          kind: copilotExplanationKind(event.payload.explanationMode)
        }
      });
    } catch (error) {
      if (error instanceof HttpException) {
        await this.markCopilotContextDiscarded(context.id);
        throw error;
      }
      this.publishServerEvent({
        version: 1,
        type: "provider.error",
        sessionId: event.sessionId,
        sentAt: new Date().toISOString(),
        payload: toSafeProviderError(error)
      });
      const safeError = toSafeProviderError(error);
      this.logger.warn(
        `Copilot generation failed: sessionId=${event.sessionId} contextId=${context.id} code=${safeError.code} retryable=${safeError.retryable} message=${safeError.message}`
      );
      if (error instanceof ProviderAdapterError && error.retryable) {
        return { action: "accepted" };
      }
      throw error;
    }

    return { action: "accepted" };
  }

  private async transcribeAcceptedAudioChunk(client: RealtimeClient, event: CaptureAudioChunkEvent): Promise<TranscriptSegment | undefined> {
    const settings = await this.settingsService.getSettings(client.user.id);
    const apiKey = settings.providerCredentialId
      ? await this.credentialsService.decryptForProviderCall(client.user.id, settings.providerCredentialId)
      : undefined;
    const audio = decodeAudioPayload(event);
    const prompt = await this.buildTranscriptionPrompt(event.sessionId, settings.primaryLanguage);
    this.logger.log(
      `Transcription provider request: provider=${this.providersService.getActiveAdapterName()} sessionId=${event.sessionId} chunkSequence=${event.payload.chunkSequence} model=${settings.transcriptionModel} language=${settings.primaryLanguage} byteLength=${audio.byteLength} durationMs=${event.payload.durationMs} promptLength=${prompt.length} hasCredential=${Boolean(apiKey)}`
    );
    const output = await this.providersService.transcribe({
      apiKey,
      audio,
      codec: event.payload.codec,
      language: settings.primaryLanguage,
      model: settings.transcriptionModel,
      prompt,
      sessionId: event.sessionId
    });
    this.assertAudioTranscriptionConsent(await this.consentService.listGrants(client.user.id, event.sessionId));
    const transcriptText = output.transcript.text.trim();
    const startMs = Math.max(0, (event.payload.chunkSequence - 1) * event.payload.durationMs);
    const endMs = startMs + event.payload.durationMs;
    this.logger.log(
      `Transcription provider response: sessionId=${event.sessionId} chunkSequence=${event.payload.chunkSequence} textLength=${transcriptText.length} language=${output.transcript.language}`
    );
    if (!transcriptText) return undefined;
    const created = await this.database.transcriptSegment.create({
      data: {
        id: randomUUID(),
        sessionId: event.sessionId,
        text: transcriptText,
        startMs,
        endMs,
        confidence: output.transcript.confidence,
        source: "microphone",
        language: output.transcript.language,
        provisional: output.transcript.provisional
      }
    });
    return toTranscriptSegment(created);
  }

  private async generateSessionAssistance(
    client: RealtimeClient,
    sessionId: SessionId,
    sourceSegment: TranscriptSegment
  ): Promise<void> {
    const settings = await this.settingsService.getSettings(client.user.id);
    const apiKey = settings.providerCredentialId
      ? await this.credentialsService.decryptForProviderCall(client.user.id, settings.providerCredentialId)
      : undefined;
    const contextSegments = await this.getGenerationContextSegments(sessionId, sourceSegment);
    const sourceSegmentIds = contextSegments.map((segment) => segment.id);
    const output = await this.providersService.generate({
      apiKey,
      analysisModel: settings.analysisModel,
      responseLanguage: settings.responseLanguage,
      sessionId,
      task: "session_assistance",
      transcriptText: contextSegments.map((segment) => segment.text).join("\n")
    });
    await this.publishSummary(sessionId, output.summary.content, sourceSegmentIds);
    await this.publishInsights(sessionId, output.insights, sourceSegmentIds);
    await this.publishSuggestions(sessionId, output.suggestions, sourceSegmentIds);
  }

  private async generateManualAssistance(client: RealtimeClient, event: ResponseGenerateEvent): Promise<RealtimeHandleResult> {
    if (client.clientType !== "response") {
      throw new ForbiddenException("Only Response Mode clients can request generated assistance");
    }
    if (!client.subscribedSessionIds.has(event.sessionId)) {
      throw new ForbiddenException("Client is not subscribed to session");
    }

    const settings = await this.settingsService.getSettings(client.user.id);
    const apiKey = settings.providerCredentialId
      ? await this.credentialsService.decryptForProviderCall(client.user.id, settings.providerCredentialId)
      : undefined;
    const contextSegments = await this.getRecentTranscriptSegments(event.sessionId);
    const sourceSegmentIds = contextSegments.map((segment) => segment.id);
    const screenContexts = this.getRecentScreenContexts(event.sessionId);
    const transcriptText = this.buildManualGenerationContext(event.payload.mode, contextSegments, screenContexts);
    const imageReferences = event.payload.mode === "code_practice" ? screenContexts.map((context) => context.imageReference).filter((value): value is string => Boolean(value)).slice(-4) : undefined;
    this.logger.log(
      `Manual generation requested: sessionId=${event.sessionId} mode=${event.payload.mode} transcriptSegments=${contextSegments.length} screenContexts=${screenContexts.length} imageReferences=${imageReferences?.length ?? 0} hasCredential=${Boolean(apiKey)}`
    );

    const output = await this.providersService.generate({
      apiKey,
      analysisModel: settings.analysisModel,
      responseLanguage: settings.responseLanguage,
      sessionId: event.sessionId,
      task: event.payload.mode,
      transcriptText,
      imageReferences
    });
    this.logger.log(`Manual generation completed: sessionId=${event.sessionId} mode=${event.payload.mode} summaryLength=${output.summary.content.length} insights=${output.insights.length} suggestions=${output.suggestions.length}`);

    if (event.payload.mode === "summary") {
      await this.publishSummary(event.sessionId, output.summary.content, sourceSegmentIds);
      return { action: "accepted" };
    }

    if (event.payload.mode === "insights") {
      await this.publishInsights(event.sessionId, output.insights, sourceSegmentIds);
      return { action: "accepted" };
    }

    if (event.payload.mode === "followups") {
      await this.publishSuggestions(event.sessionId, output.suggestions, sourceSegmentIds);
      return { action: "accepted" };
    }

    const contextId = randomUUID();
    const guidance = output.suggestions[0]?.content ?? output.summary.content;
    this.publishServerEvent({
      version: 1,
      type: "copilot.explanation",
      sessionId: event.sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        contextId,
        content: guidance,
        kind: "explanation"
      }
    });
    return { action: "accepted" };
  }

  private async publishSummary(sessionId: SessionId, content: string, sourceSegmentIds: TranscriptSegmentId[]): Promise<void> {
    const generatedAt = new Date();
    const summary = await this.database.summary.create({
      data: {
        id: randomUUID(),
        sessionId,
        content,
        sourceSegmentIds,
        generatedAt
      }
    });
    this.publishServerEvent({
      version: 1,
      type: "summary.updated",
      sessionId,
      sentAt: generatedAt.toISOString(),
      payload: { summary: toSummary(summary) }
    });
  }

  private async publishInsights(
    sessionId: SessionId,
    insights: Pick<Insight, "type" | "content" | "confidence">[],
    sourceSegmentIds: TranscriptSegmentId[]
  ): Promise<void> {
    const generatedAt = new Date();
    for (const insight of insights) {
      const createdInsight = await this.database.insight.create({
        data: {
          id: randomUUID(),
          sessionId,
          insightType: insight.type,
          content: insight.content,
          confidence: insight.confidence,
          sourceSegmentIds,
          generatedAt
        }
      });
      this.publishServerEvent({
        version: 1,
        type: "insight.created",
        sessionId,
        sentAt: generatedAt.toISOString(),
        payload: { insight: toInsight(createdInsight) }
      });
    }
  }

  private async publishSuggestions(
    sessionId: SessionId,
    suggestions: Pick<Suggestion, "category" | "content" | "urgency">[],
    sourceSegmentIds: TranscriptSegmentId[]
  ): Promise<void> {
    const generatedAt = new Date();
    for (const suggestion of suggestions) {
      const createdSuggestion = await this.database.suggestion.create({
        data: {
          id: randomUUID(),
          sessionId,
          category: suggestion.category,
          content: suggestion.content,
          urgency: suggestion.urgency,
          sourceSegmentIds,
          generatedAt
        }
      });
      this.publishServerEvent({
        version: 1,
        type: "suggestion.created",
        sessionId,
        sentAt: generatedAt.toISOString(),
        payload: { suggestion: toSuggestion(createdSuggestion) }
      });
    }
  }

  private async persistCopilotContext(event: CopilotContextEvent): Promise<CodeCopilotContext> {
    const problemContext = event.payload.textContext ?? event.payload.imageReference ?? "Context reference received.";
    const created = await this.database.codeCopilotContext.create({
      data: {
        id: event.payload.contextId,
        sessionId: event.sessionId,
        programmingLanguage: event.payload.programmingLanguage,
        explanationMode: event.payload.explanationMode,
        problemContext,
        status: "active"
      }
    });
    return toCodeCopilotContext(created);
  }

  private async generateCopilotExplanation(
    client: RealtimeClient,
    event: CopilotContextEvent,
    context: CodeCopilotContext
  ): Promise<string> {
    const settings = await this.settingsService.getSettings(client.user.id);
    const apiKey = settings.providerCredentialId
      ? await this.credentialsService.decryptForProviderCall(client.user.id, settings.providerCredentialId)
      : undefined;
    const output = await this.providersService.generate({
      apiKey,
      analysisModel: settings.analysisModel,
      responseLanguage: settings.responseLanguage,
      sessionId: event.sessionId,
      task: "code_practice",
      transcriptText: [
        `Code practice mode: ${event.payload.explanationMode}`,
        `Programming language: ${event.payload.programmingLanguage}`,
        `Visible/context notes: ${event.payload.textContext ?? "screen context attached"}`
      ].join("\n"),
      imageReferences: event.payload.imageReference ? [event.payload.imageReference] : undefined
    });
    await this.assertCodeCopilotConsent(await this.consentService.listGrants(client.user.id, event.sessionId));
    const guidance = output.suggestions[0]?.content ?? output.summary.content;
    await this.database.codeCopilotContext.update({
      where: { id: context.id },
      data: {
        generatedGuidance: guidance,
        status: "completed"
      }
    });
    return guidance;
  }

  private async markCopilotContextDiscarded(contextId: string): Promise<void> {
    await this.database.codeCopilotContext.update({
      where: { id: contextId },
      data: { status: "discarded" }
    });
  }

  private publishSafeProviderError(sessionId: SessionId, error: unknown): void {
    this.publishServerEvent({
      version: 1,
      type: "provider.error",
      sessionId,
      sentAt: new Date().toISOString(),
      payload: toSafeProviderError(error)
    });
  }

  private assertAudioUploadConsent(consentGrants: Awaited<ReturnType<ConsentService["listGrants"]>>): void {
    const uploadConsentDecision = this.consentService.requireCaptureUploadConsent(consentGrants);
    if (!uploadConsentDecision.ok) {
      throw new ForbiddenException(`Audio upload blocked: ${uploadConsentDecision.code}`);
    }
  }

  private assertAudioTranscriptionConsent(consentGrants: Awaited<ReturnType<ConsentService["listGrants"]>>): void {
    const transcriptionConsentDecision = this.consentService.requireTranscriptionConsent(consentGrants);
    if (!transcriptionConsentDecision.ok) {
      throw new ForbiddenException(`Audio transcription blocked: ${transcriptionConsentDecision.code}`);
    }
  }

  private async assertCodeCopilotConsent(consentGrants: Awaited<ReturnType<ConsentService["listGrants"]>>): Promise<void> {
    const consentDecision = this.consentService.requireCodeCopilotConsent(consentGrants);
    if (!consentDecision.ok) {
      throw new ForbiddenException(`Code copilot blocked: ${consentDecision.code}`);
    }
  }

  private async getGenerationContextSegments(sessionId: SessionId, sourceSegment: TranscriptSegment): Promise<TranscriptSegment[]> {
    const maxContextSegments = this.options.maxGenerationContextSegments ?? 12;
    const records = await this.database.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { startMs: "desc" },
      take: maxContextSegments
    });
    const segments = records.map(toTranscriptSegment).sort((left, right) => left.startMs - right.startMs);
    return segments.length > 0 ? segments : [sourceSegment];
  }

  private async buildTranscriptionPrompt(_sessionId: SessionId, language: string): Promise<string> {
    return language.toLowerCase().startsWith("pt")
      ? "Transcreva somente o audio atual em portugues do Brasil. Preserve termos tecnicos, nomes de plataformas, comandos, codigo e palavras em ingles quando forem faladas. Nao repita trechos anteriores e nao invente contexto ausente."
      : "Transcribe only the current audio. Preserve technical terms, platform names, commands, code, and mixed-language words. Do not repeat previous segments and do not invent missing context.";
  }

  private async getRecentTranscriptSegments(sessionId: SessionId): Promise<TranscriptSegment[]> {
    const maxContextSegments = this.options.maxGenerationContextSegments ?? 12;
    const records = await this.database.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { startMs: "desc" },
      take: maxContextSegments
    });
    return records.map(toTranscriptSegment).sort((left, right) => left.startMs - right.startMs);
  }

  private getRecentScreenContexts(sessionId: SessionId): { imageReference?: string; textContext?: string }[] {
    return (this.eventsBySessionId.get(sessionId) ?? [])
      .filter((storedEvent): storedEvent is CopilotContextEvent => storedEvent.type === "copilot.context" && Boolean(storedEvent.payload.imageReference))
      .slice(-30)
      .map((storedEvent) => ({
        imageReference: storedEvent.payload.imageReference,
        textContext: storedEvent.payload.textContext
      }));
  }

  private buildManualGenerationContext(
    mode: ResponseGenerateEvent["payload"]["mode"],
    contextSegments: TranscriptSegment[],
    screenContexts: { textContext?: string }[]
  ): string {
    const transcript = contextSegments.map((segment) => `${Math.floor(segment.startMs / 1000)}s: ${segment.text}`).join("\n");
    const screens = screenContexts.map((context, index) => `Screen ${index + 1}: ${context.textContext ?? "screen image attached"}`).join("\n");
    return [
      `Requested output: ${mode}`,
      transcript ? `Recent transcript:\n${transcript}` : "Recent transcript: no transcript text is available yet.",
      screens ? `Recent screen context:\n${screens}` : "Recent screen context: no screenshot context is available yet."
    ].join("\n\n");
  }

  private async assertAudioChunkSequence(event: CaptureAudioChunkEvent): Promise<void> {
    const latest = await this.database.captureEvent.findFirst({
      where: {
        sessionId: event.sessionId,
        eventType: "capture.audio_chunk"
      },
      orderBy: { sequence: "desc" }
    });
    const expected = latest ? Number(latest.sequence) + 1 : 1;
    if (event.payload.chunkSequence !== expected) {
      throw new BadRequestException(`Audio chunk sequence must be ${expected}`);
    }
  }

  private async assertAudioBackpressure(sessionId: string): Promise<void> {
    const buffered = await this.database.captureEvent.count({
      where: {
        sessionId,
        eventType: "capture.audio_chunk"
      }
    });
    const maxBufferedChunks = this.options.maxBufferedAudioChunksPerSession ?? 2400;
    if (buffered >= maxBufferedChunks) {
      throw new HttpException("Audio upload backpressure: too many buffered chunks", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private appendEvent(event: PersuandoWebSocketEvent): PersuandoWebSocketEvent {
    const events = this.eventsBySessionId.get(event.sessionId) ?? [];
    const withSequence = event.sequence
      ? event
      : ({
          ...event,
          sequence: this.nextSequence++
        } as PersuandoWebSocketEvent);
    events.push(withSequence);
    this.eventsBySessionId.set(event.sessionId, events);
    for (const listener of this.eventListeners) listener(withSequence);
    if (withSequence.type === "copilot.context") {
      this.logger.log(
        `Realtime event appended: type=copilot.context sessionId=${withSequence.sessionId} sequence=${withSequence.sequence ?? "none"} hasImage=${Boolean(withSequence.payload.imageReference)} listeners=${this.eventListeners.size}`
      );
    }
    return withSequence;
  }
}

export interface RealtimeIngestionOptions {
  maxBufferedAudioChunksPerSession?: number;
  maxGenerationContextSegments?: number;
}

function validateAudioChunkPayload(event: CaptureAudioChunkEvent): void {
  const { audioBase64, byteLength, chunkSequence, clientTimestamp, codec, durationMs } = event.payload;
  if (!Number.isInteger(chunkSequence) || chunkSequence < 1) {
    throw new BadRequestException("Audio chunk sequence must be a positive integer");
  }
  if (codec !== "pcm16" && codec !== "webm-opus") {
    throw new BadRequestException("Audio codec is unsupported");
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 30000) {
    throw new BadRequestException("Audio chunk duration is invalid");
  }
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new BadRequestException("Audio chunk byteLength is invalid");
  }
  if (!audioBase64 || typeof audioBase64 !== "string") {
    throw new BadRequestException("Audio chunk data is required");
  }
  if (decodeAudioPayload(event).byteLength !== byteLength) {
    throw new BadRequestException("Audio chunk byteLength does not match encoded audio");
  }
  if (Number.isNaN(Date.parse(clientTimestamp))) {
    throw new BadRequestException("Audio chunk clientTimestamp is invalid");
  }
}

function sessionStatusFromCaptureStatus(status: CaptureStatusEvent["payload"]["status"]): SessionStatus {
  if (status === "paused") return "paused";
  if (status === "ended") return "ended";
  if (status === "device_unavailable" || status === "permission_denied") return "error";
  return "active";
}

function captureStatusMessage(status: CaptureStatusEvent["payload"]["status"]): string {
  if (status === "device_unavailable") return "Capture device unavailable.";
  if (status === "permission_denied") return "Capture permission denied.";
  if (status === "paused") return "Capture paused.";
  if (status === "ended") return "Capture ended.";
  return "Capture active.";
}

function validateCopilotContextPayload(event: CopilotContextEvent): void {
  const { contextId, explanationMode, imageReference, programmingLanguage, textContext } = event.payload;
  if (!contextId || contextId.length > 128) {
    throw new BadRequestException("Copilot contextId is required");
  }
  if (!programmingLanguage || programmingLanguage.length > 64) {
    throw new BadRequestException("Copilot programmingLanguage is required");
  }
  if (explanationMode !== "hint" && explanationMode !== "explain" && explanationMode !== "review") {
    throw new BadRequestException("Copilot explanationMode is invalid");
  }
  if (!textContext && !imageReference) {
    throw new BadRequestException("Copilot context requires textContext or imageReference");
  }
  if (textContext && textContext.length > 12000) {
    throw new BadRequestException("Copilot textContext is too large");
  }
}

function decodeAudioPayload(event: CaptureAudioChunkEvent): Uint8Array {
  return new Uint8Array(Buffer.from(event.payload.audioBase64 ?? "", "base64"));
}

function redactAudioChunkEvent(event: CaptureAudioChunkEvent): CaptureAudioChunkEvent {
  const { audioBase64: _audioBase64, ...payload } = event.payload;
  return {
    ...event,
    payload
  };
}

interface TranscriptSegmentRecord {
  id: string;
  sessionId: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | { toNumber(): number };
  source: string;
  language: string;
  provisional: boolean;
}

function toTranscriptSegment(record: TranscriptSegmentRecord): TranscriptSegment {
  return {
    id: record.id as TranscriptSegmentId,
    sessionId: record.sessionId as SessionId,
    text: record.text,
    startMs: record.startMs,
    endMs: record.endMs,
    confidence: typeof record.confidence === "number" ? record.confidence : record.confidence.toNumber(),
    source: "microphone",
    language: record.language,
    provisional: record.provisional
  };
}

interface SummaryRecord {
  id: string;
  sessionId: string;
  content: string;
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toSummary(record: SummaryRecord): Summary {
  return {
    id: record.id,
    sessionId: record.sessionId as SessionId,
    content: record.content,
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)
  };
}

interface InsightRecord {
  id: string;
  sessionId: string;
  insightType: string;
  content: string;
  confidence: number | { toNumber(): number };
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toInsight(record: InsightRecord): Insight {
  return {
    id: record.id as InsightId,
    sessionId: record.sessionId as SessionId,
    type: record.insightType as Insight["type"],
    content: record.content,
    confidence: typeof record.confidence === "number" ? record.confidence : record.confidence.toNumber(),
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)
  };
}

interface SuggestionRecord {
  id: string;
  sessionId: string;
  category: string;
  content: string;
  urgency: string;
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toSuggestion(record: SuggestionRecord): Suggestion {
  return {
    id: record.id as SuggestionId,
    sessionId: record.sessionId as SessionId,
    category: record.category as Suggestion["category"],
    content: record.content,
    urgency: record.urgency as Suggestion["urgency"],
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)
  };
}

interface CodeCopilotContextRecord {
  id: string;
  sessionId: string;
  programmingLanguage: string;
  explanationMode: string;
  problemContext: string;
  generatedGuidance?: string | null;
  status: string;
}

function toCodeCopilotContext(record: CodeCopilotContextRecord): CodeCopilotContext {
  return {
    id: record.id,
    sessionId: record.sessionId as SessionId,
    programmingLanguage: record.programmingLanguage,
    explanationMode: record.explanationMode as CodeCopilotContext["explanationMode"],
    problemContext: record.problemContext,
    generatedGuidance: record.generatedGuidance ?? undefined,
    status: record.status as CodeCopilotContext["status"]
  };
}

function isPeriodicScreenContext(event: CopilotContextEvent): boolean {
  return Boolean(event.payload.imageReference) && (event.payload.textContext ?? "").startsWith("Periodic screen context captured");
}

function copilotExplanationKind(explanationMode: CopilotContextEvent["payload"]["explanationMode"]): "hint" | "explanation" | "review" {
  if (explanationMode === "hint") return "hint";
  if (explanationMode === "review") return "review";
  return "explanation";
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function parseRealtimeEvent(event: unknown): PersuandoWebSocketEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new BadRequestException("Realtime event must be an object");
  }

  const candidate = event as Partial<PersuandoWebSocketEvent>;
  if (candidate.version !== 1) {
    throw new BadRequestException("Realtime event version is unsupported");
  }
  if (typeof candidate.type !== "string" || !isKnownWebSocketEventType(candidate.type)) {
    throw new BadRequestException("Realtime event type is invalid");
  }
  if (typeof candidate.sessionId !== "string" || !candidate.sessionId) {
    throw new BadRequestException("Realtime event sessionId is required");
  }
  if (!candidate.payload || typeof candidate.payload !== "object") {
    throw new BadRequestException("Realtime event payload is required");
  }

  if (candidate.type === "response.ack") {
    const ack = candidate as ResponseAckEvent;
    if (typeof ack.payload.lastReceivedSequence !== "number") {
      throw new BadRequestException("Realtime ack requires lastReceivedSequence");
    }
  }

  if (candidate.type === "response.generate") {
    const generate = candidate as ResponseGenerateEvent;
    if (!["summary", "insights", "followups", "code_practice"].includes(generate.payload.mode)) {
      throw new BadRequestException("Realtime generate mode is invalid");
    }
  }

  if (candidate.type === "response.unsubscribe") {
    return candidate as ResponseUnsubscribeEvent;
  }

  return candidate as PersuandoWebSocketEvent;
}
