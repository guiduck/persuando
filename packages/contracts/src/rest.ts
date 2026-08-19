import type {
  ConsentGrant,
  ConsentType,
  Insight,
  ProviderCredentialMetadata,
  RetentionMode,
  Session,
  Suggestion,
  Summary,
  TranscriptSegment,
  UserSettings,
  Workspace
} from "./types.js";

export interface GetCurrentWorkspaceResponse {
  workspace: Workspace;
  activeSessions: Session[];
  recentSessions: Session[];
}

export interface CreateSessionRequest {
  workspaceId: string;
  title: string;
  primaryLanguage: string;
  responseLanguage: string;
  retentionMode: RetentionMode;
  consentGrantIds: string[];
}

export interface SessionResponse {
  session: Session;
  consentGrants: ConsentGrant[];
}

export interface SessionHistoryResponse extends SessionResponse {
  transcriptSegments: TranscriptSegment[];
  summaries: Summary[];
  insights: Insight[];
  suggestions: Suggestion[];
}

export interface SettingsResponse {
  settings: UserSettings;
  providerCredential?: ProviderCredentialMetadata;
}

export interface UpdateSettingsRequest {
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

export interface CreateProviderCredentialRequest {
  providerName: string;
  secret: string;
}

export interface ProviderCredentialResponse {
  credential: ProviderCredentialMetadata;
}

export interface ProviderValidationResponse {
  credential: ProviderCredentialMetadata;
  ok: boolean;
  safeMessage: string;
}

export interface CreateConsentGrantRequest {
  consentType: ConsentType;
  sessionId?: string;
  consentTextVersion: string;
}

export interface ConsentGrantResponse {
  consentGrant: ConsentGrant;
}

export interface ManualDeleteSessionResponse {
  sessionId: string;
  deletedAt: string;
}
