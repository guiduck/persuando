import type { Insight, SafeError, SessionId, SessionStatus, Suggestion, Summary, TranscriptSegment } from "./types.js";

export const websocketEventTypes = [
  "capture.audio_chunk",
  "capture.status",
  "consent.revoked",
  "response.subscribe",
  "response.unsubscribe",
  "response.ack",
  "response.generate",
  "session.status",
  "transcript.segment",
  "summary.updated",
  "insight.created",
  "suggestion.created",
  "provider.error",
  "retention.deleted",
  "copilot.context",
  "copilot.explanation"
] as const;

export type WebSocketEventType = (typeof websocketEventTypes)[number];

export interface BaseWebSocketEvent<TType extends WebSocketEventType, TPayload> {
  version: 1;
  type: TType;
  sessionId: SessionId;
  sequence?: number;
  sentAt: string;
  payload: TPayload;
}

export type CaptureAudioChunkEvent = BaseWebSocketEvent<
  "capture.audio_chunk",
  {
    chunkSequence: number;
    clientTimestamp: string;
    codec: "pcm16" | "webm-opus";
    durationMs: number;
    byteLength: number;
    audioBase64?: string;
  }
>;

export type CaptureStatusEvent = BaseWebSocketEvent<
  "capture.status",
  {
    status: "active" | "paused" | "resumed" | "ended" | "device_unavailable" | "permission_denied";
  }
>;

export type ConsentRevokedEvent = BaseWebSocketEvent<"consent.revoked", { consentType: string }>;
export type ResponseSubscribeEvent = BaseWebSocketEvent<"response.subscribe", { lastSeenSequence?: number }>;
export type ResponseUnsubscribeEvent = BaseWebSocketEvent<"response.unsubscribe", Record<string, never>>;
export type ResponseAckEvent = BaseWebSocketEvent<"response.ack", { lastReceivedSequence: number }>;
export type ResponseGenerateEvent = BaseWebSocketEvent<"response.generate", { mode: "summary" | "insights" | "followups" | "code_practice" }>;
export type SessionStatusEvent = BaseWebSocketEvent<"session.status", { status: SessionStatus; safeMessage?: string }>;
export type TranscriptSegmentEvent = BaseWebSocketEvent<"transcript.segment", { segment: TranscriptSegment }>;
export type SummaryUpdatedEvent = BaseWebSocketEvent<"summary.updated", { summary: Summary }>;
export type InsightCreatedEvent = BaseWebSocketEvent<"insight.created", { insight: Insight }>;
export type SuggestionCreatedEvent = BaseWebSocketEvent<"suggestion.created", { suggestion: Suggestion }>;
export type ProviderErrorEvent = BaseWebSocketEvent<"provider.error", SafeError>;
export type RetentionDeletedEvent = BaseWebSocketEvent<"retention.deleted", { deletedAt: string }>;
export type CopilotContextEvent = BaseWebSocketEvent<
  "copilot.context",
  {
    contextId: string;
    programmingLanguage: string;
    explanationMode: "hint" | "explain" | "review";
    textContext?: string;
    imageReference?: string;
  }
>;
export type CopilotExplanationEvent = BaseWebSocketEvent<
  "copilot.explanation",
  {
    contextId: string;
    content: string;
    kind: "hint" | "explanation" | "tradeoff" | "review";
  }
>;

export type PersuandoWebSocketEvent =
  | CaptureAudioChunkEvent
  | CaptureStatusEvent
  | ConsentRevokedEvent
  | ResponseSubscribeEvent
  | ResponseUnsubscribeEvent
  | ResponseAckEvent
  | ResponseGenerateEvent
  | SessionStatusEvent
  | TranscriptSegmentEvent
  | SummaryUpdatedEvent
  | InsightCreatedEvent
  | SuggestionCreatedEvent
  | ProviderErrorEvent
  | RetentionDeletedEvent
  | CopilotContextEvent
  | CopilotExplanationEvent;

export function isKnownWebSocketEventType(value: string): value is WebSocketEventType {
  return websocketEventTypes.includes(value as WebSocketEventType);
}
