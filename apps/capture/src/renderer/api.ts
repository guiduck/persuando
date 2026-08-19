import type {
  ConsentGrant,
  ConsentType,
  ProviderCredentialMetadata,
  SettingsResponse,
  Session,
  SessionResponse,
  UpdateSettingsRequest,
  UserSettings
} from "@persuando/contracts";

export interface AuthMeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
    provider: "google" | "local-dev";
  };
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const websocketBaseUrl = import.meta.env.VITE_WEBSOCKET_URL ?? "ws://localhost:4000/realtime";
let captureAuthUser: AuthMeResponse["user"];

export function setCaptureAuthUser(user: AuthMeResponse["user"] | undefined): void {
  captureAuthUser = user;
}

export function googleLoginUrl(): string {
  return `${apiBaseUrl}/auth/google`;
}

export function captureWebSocketUrl(): string {
  const url = new URL(websocketBaseUrl);
  url.searchParams.set("clientType", "capture");
  if (captureAuthUser?.id) url.searchParams.set("userId", captureAuthUser.id);
  return url.toString();
}

export async function getCurrentUser(): Promise<AuthMeResponse> {
  const response = await fetchApi<AuthMeResponse>("/auth/me");
  if (response.authenticated || !captureAuthUser) return response;
  return { authenticated: true, user: captureAuthUser };
}

export async function getSettings(): Promise<SettingsResponse> {
  return fetchApi<SettingsResponse>("/settings");
}

export async function getCurrentWorkspace(): Promise<{ workspace: { id: string }; activeSessions: Session[]; recentSessions: Session[] }> {
  return fetchApi<{ workspace: { id: string }; activeSessions: Session[]; recentSessions: Session[] }>("/workspaces/current");
}

export async function createSession(settings: UserSettings): Promise<SessionResponse> {
  const workspace = await getCurrentWorkspace();
  return fetchApi<SessionResponse>("/sessions", {
    body: JSON.stringify({
      workspaceId: workspace.workspace.id,
      title: "Persuando live capture",
      primaryLanguage: settings.primaryLanguage,
      responseLanguage: settings.responseLanguage,
      retentionMode: settings.retentionMode,
      consentGrantIds: []
    }),
    method: "POST"
  });
}

export async function saveProviderCredential(secret: string): Promise<ProviderCredentialMetadata> {
  const response = await fetchApi<{ credential: ProviderCredentialMetadata }>("/provider-credentials", {
    body: JSON.stringify({ providerName: "openai-compatible", secret }),
    method: "POST"
  });
  return response.credential;
}

export async function validateProviderCredential(credentialId: string): Promise<ProviderCredentialMetadata> {
  const response = await fetchApi<{ credential: ProviderCredentialMetadata }>(`/provider-credentials/${credentialId}/validate`, {
    method: "POST"
  });
  return response.credential;
}

export async function updateSettings(settings: UpdateSettingsRequest): Promise<SettingsResponse> {
  return fetchApi<SettingsResponse>("/settings", {
    body: JSON.stringify(settings),
    method: "PUT"
  });
}

export async function grantConsent(consentType: ConsentType): Promise<ConsentGrant> {
  const response = await fetchApi<{ consentGrant: ConsentGrant }>("/consent-grants", {
    body: JSON.stringify({ consentType, consentTextVersion: "mvp-visible-consent-v1" }),
    method: "POST"
  });
  return response.consentGrant;
}

export async function listConsentGrants(): Promise<ConsentGrant[]> {
  const response = await fetchApi<{ consentGrants: ConsentGrant[] }>("/consent-grants");
  return response.consentGrants;
}

export async function revokeConsent(grantId: string): Promise<ConsentGrant> {
  const response = await fetchApi<{ consentGrant: ConsentGrant }>(`/consent-grants/${grantId}`, {
    method: "DELETE"
  });
  return response.consentGrant;
}

export function settingsRequestFrom(settings: UserSettings, patch: Partial<UpdateSettingsRequest>): UpdateSettingsRequest {
  return {
    providerCredentialId: settings.providerCredentialId,
    primaryLanguage: settings.primaryLanguage,
    responseLanguage: settings.responseLanguage,
    preferredProgrammingLanguage: settings.preferredProgrammingLanguage,
    transcriptionModel: settings.transcriptionModel,
    analysisModel: settings.analysisModel,
    microphoneCaptureDefault: settings.microphoneCaptureDefault,
    periodicScreenshotCaptureDefault: settings.periodicScreenshotCaptureDefault,
    codePracticeContextDefault: settings.codePracticeContextDefault,
    autoScrollDefault: settings.autoScrollDefault,
    sessionTimerMinutes: settings.sessionTimerMinutes,
    retentionMode: settings.retentionMode,
    ...patch
  };
}

async function fetchApi<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined)
  };
  if (captureAuthUser?.id) headers["x-user-id"] = captureAuthUser.id;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers
    });
  } catch {
    throw new Error(`API unavailable at ${apiBaseUrl}. Start the API with npm.cmd run dev:api.`);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${path}`);
  }

  return (await response.json()) as TResponse;
}
