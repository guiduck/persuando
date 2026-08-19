export type Brand<TName extends string> = string & { readonly __brand: TName };

export type UserId = Brand<"UserId">;
export type WorkspaceId = Brand<"WorkspaceId">;
export type SessionId = Brand<"SessionId">;
export type ConsentGrantId = Brand<"ConsentGrantId">;
export type ProviderCredentialId = Brand<"ProviderCredentialId">;
export type TranscriptSegmentId = Brand<"TranscriptSegmentId">;
export type InsightId = Brand<"InsightId">;
export type SuggestionId = Brand<"SuggestionId">;

export const SESSION_RETENTION_DAYS = 7;

export const consentTypes = [
  "microphone_capture",
  "audio_transcription",
  "backend_transmission",
  "external_ai_provider_usage",
  "session_retention",
  "screen_coding_context_capture",
  "screenshot_capture",
  "visual_analysis",
  "code_copilot",
  "app_site_detection"
] as const;

export type ConsentType = (typeof consentTypes)[number];

export const activeMvpConsentTypes = [
  "microphone_capture",
  "audio_transcription",
  "backend_transmission",
  "external_ai_provider_usage",
  "session_retention",
  "code_copilot",
  "screen_coding_context_capture"
] as const satisfies readonly ConsentType[];

export const deferredConsentTypes = [
  "screenshot_capture",
  "visual_analysis",
  "app_site_detection"
] as const satisfies readonly ConsentType[];

export type ConsentStatus = "granted" | "revoked" | "expired" | "missing";
export type SessionStatus = "created" | "active" | "paused" | "revoked" | "error" | "ended" | "deleted";
export type CaptureStatus = "idle" | "active" | "paused" | "revoked" | "error" | "ended" | "reconnecting";
export type ProviderCredentialStatus = "unverified" | "valid" | "invalid" | "revoked" | "deleted";
export type RetentionMode = "seven_day_workspace" | "manual_deleted";

export interface User {
  id: UserId;
  email: string;
  displayName: string;
  locale: string;
  createdAt: string;
}

export interface Workspace {
  id: WorkspaceId;
  ownerUserId: UserId;
  name: string;
  activeSessionIds: SessionId[];
  recentSessionIds: SessionId[];
}

export interface UserSettings {
  userId: UserId;
  providerCredentialId?: ProviderCredentialId;
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

export interface ProviderCredentialMetadata {
  id: ProviderCredentialId;
  userId: UserId;
  providerName: string;
  maskedDisplayValue: string;
  encryptionVersion: string;
  validationStatus: ProviderCredentialStatus;
  lastCheckedAt?: string;
}

export interface ConsentGrant {
  id: ConsentGrantId;
  userId: UserId;
  sessionId?: SessionId;
  consentType: ConsentType;
  status: ConsentStatus;
  consentTextVersion: string;
  grantedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

export interface Session {
  id: SessionId;
  workspaceId: WorkspaceId;
  ownerUserId: UserId;
  title: string;
  status: SessionStatus;
  startedAt?: string;
  endedAt?: string;
  retentionExpiresAt: string;
  deletedAt?: string;
  activeCaptureClientId?: string;
  activeResponseClientIds: string[];
}

export interface CaptureDevice {
  id: string;
  type: "microphone";
  displayName: string;
  platform: "windows";
  permissionStatus: "available" | "selected" | "disabled" | "unavailable" | "denied";
}

export interface TranscriptSegment {
  id: TranscriptSegmentId;
  sessionId: SessionId;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  source: "microphone";
  language: string;
  provisional: boolean;
}

export interface Summary {
  id: string;
  sessionId: SessionId;
  content: string;
  sourceSegmentIds: TranscriptSegmentId[];
  generatedAt: string;
}

export interface Insight {
  id: InsightId;
  sessionId: SessionId;
  type: "risk" | "objection" | "question" | "decision" | "follow_up" | "note";
  content: string;
  confidence: number;
  sourceSegmentIds: TranscriptSegmentId[];
  generatedAt: string;
}

export interface Suggestion {
  id: SuggestionId;
  sessionId: SessionId;
  category: "response" | "question" | "risk" | "follow_up";
  content: string;
  urgency: "low" | "medium" | "high";
  sourceSegmentIds: TranscriptSegmentId[];
  generatedAt: string;
}

export interface ScreenCaptureEvent {
  id: string;
  sessionId: SessionId;
  capturedAt: string;
  sourceLabel: string;
  imageReference?: string;
  textContext?: string;
  analysisStatus: "captured" | "processed" | "redacted" | "deleted";
}

export interface CodeCopilotContext {
  id: string;
  sessionId: SessionId;
  programmingLanguage: string;
  explanationMode: "hint" | "explain" | "review";
  problemContext: string;
  generatedGuidance?: string;
  status: "inactive" | "active" | "paused" | "completed" | "discarded";
}

export interface AuditEvent {
  id: string;
  userId: UserId;
  sessionId?: SessionId;
  type:
    | "consent.granted"
    | "consent.revoked"
    | "session.started"
    | "session.ended"
    | "provider_credential.created"
    | "provider_credential.deleted"
    | "session.manual_deleted"
    | "retention.cleaned";
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type PersuandoErrorCode =
  | "AUTH_REQUIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_CROSS_ACCOUNT"
  | "CONSENT_MISSING"
  | "CONSENT_REVOKED"
  | "CONSENT_EXPIRED"
  | "PROVIDER_KEY_INVALID"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "AUDIO_FORMAT_UNSUPPORTED"
  | "SESSION_DELETED"
  | "REALTIME_EVENT_INVALID";

export interface SafeError {
  code: PersuandoErrorCode;
  message: string;
  retryable: boolean;
}
