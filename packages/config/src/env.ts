import { SESSION_RETENTION_DAYS } from "@persuando/contracts";

export interface PersuandoEnv {
  databaseUrl: string;
  redisUrl: string;
  authSessionSecret: string;
  localDevUserId: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleCallbackUrl: string;
  credentialEncryptionKey: string;
  credentialEncryptionKeyVersion: string;
  apiBaseUrl: string;
  websocketUrl: string;
  allowedOrigins: string[];
  providerAdapter: "mock" | "openai-compatible";
  openAiCompatibleBaseUrl?: string;
  sessionRetentionDays: number;
  retentionCleanupCron: string;
  logLevel: "debug" | "info" | "warn" | "error";
  logRedactKeys: string[];
}

export function parseEnv(source: Record<string, string | undefined>): PersuandoEnv {
  const providerAdapter = source.PROVIDER_ADAPTER === "openai-compatible" ? "openai-compatible" : "mock";
  return {
    databaseUrl: required(source, "DATABASE_URL"),
    redisUrl: required(source, "REDIS_URL"),
    authSessionSecret: required(source, "AUTH_SESSION_SECRET"),
    localDevUserId: source.LOCAL_DEV_USER_ID ?? "dev-user-1",
    googleClientId: source.GOOGLE_CLIENT_ID,
    googleClientSecret: source.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: source.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",
    credentialEncryptionKey: required(source, "CREDENTIAL_ENCRYPTION_KEY"),
    credentialEncryptionKeyVersion: source.CREDENTIAL_ENCRYPTION_KEY_VERSION ?? "dev-v1",
    apiBaseUrl: source.API_BASE_URL ?? "http://localhost:4000",
    websocketUrl: source.WEBSOCKET_URL ?? "ws://localhost:4000/realtime",
    allowedOrigins: splitList(source.ALLOWED_ORIGINS ?? "http://localhost:3000"),
    providerAdapter,
    openAiCompatibleBaseUrl: source.OPENAI_COMPATIBLE_BASE_URL,
    sessionRetentionDays: Number(source.SESSION_RETENTION_DAYS ?? SESSION_RETENTION_DAYS),
    retentionCleanupCron: source.RETENTION_CLEANUP_CRON ?? "0 */2 * * *",
    logLevel: parseLogLevel(source.LOG_LEVEL),
    logRedactKeys: splitList(source.LOG_REDACT_KEYS ?? "")
  };
}

function required(source: Record<string, string | undefined>, key: string): string {
  const value = source[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLogLevel(value: string | undefined): PersuandoEnv["logLevel"] {
  if (value === "debug" || value === "warn" || value === "error") return value;
  return "info";
}
