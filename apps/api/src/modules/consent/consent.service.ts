import { Injectable } from "@nestjs/common";
import type { ConsentGrant, ConsentGrantId, ConsentStatus, ConsentType, SessionId, UserId } from "@persuando/contracts";

import { DatabaseService } from "../database/database.service.js";

export interface CreateConsentGrantInput {
  userId: string;
  sessionId?: string;
  consentType: ConsentType;
  consentTextVersion: string;
}

@Injectable()
export class ConsentService {
  readonly moduleName = "consent";

  constructor(private readonly database: DatabaseService) {}

  async createGrant(input: CreateConsentGrantInput): Promise<ConsentGrant> {
    const grantedAt = new Date().toISOString();
    const grant: ConsentGrant = {
      id: crypto.randomUUID() as ConsentGrantId,
      userId: input.userId as UserId,
      sessionId: input.sessionId as SessionId | undefined,
      consentType: input.consentType,
      status: "granted",
      consentTextVersion: input.consentTextVersion,
      grantedAt
    };

    await ensureUser(this.database, input.userId);
    const created = await this.database.consentGrant.create({
      data: {
        id: grant.id,
        userId: input.userId,
        sessionId: input.sessionId,
        consentType: input.consentType,
        status: grant.status,
        consentTextVersion: input.consentTextVersion,
        grantedAt: new Date(grantedAt)
      }
    });
    return toConsentGrant(created);
  }

  async listGrants(userId: string, sessionId?: string): Promise<ConsentGrant[]> {
    const grants = await this.database.consentGrant.findMany({
      where: {
        userId
      },
      orderBy: { createdAt: "asc" }
    });
    return grants
      .filter((grant) => !sessionId || grant.sessionId === null || grant.sessionId === undefined || grant.sessionId === sessionId)
      .map(toConsentGrant);
  }

  async revokeGrant(userId: string, grantId: string): Promise<ConsentGrant | undefined> {
    const grant = await this.database.consentGrant.findFirst({ where: { id: grantId, userId } });
    if (!grant) {
      return undefined;
    }

    const revokedGrant = await this.database.consentGrant.update({
      where: { id: grantId },
      data: {
        status: "revoked",
        revokedAt: new Date()
      }
    });
    return toConsentGrant(revokedGrant);
  }

  evaluateRequiredConsent(grants: readonly ConsentGrant[], requiredTypes: readonly ConsentType[], now = new Date()): ConsentDecision {
    for (const consentType of requiredTypes) {
      const grant = this.findLatestGrant(grants, consentType);
      if (!grant) {
        return blocked("CONSENT_MISSING", consentType);
      }

      if (grant.status === "revoked") {
        return blocked("CONSENT_REVOKED", consentType);
      }

      if (grant.status === "expired" || isExpired(grant, now)) {
        return blocked("CONSENT_EXPIRED", consentType);
      }

      if (grant.status !== "granted") {
        return blocked("CONSENT_MISSING", consentType);
      }
    }

    return { ok: true };
  }

  requireCaptureUploadConsent(grants: readonly ConsentGrant[], now = new Date()): ConsentDecision {
    return this.evaluateRequiredConsent(grants, ["microphone_capture", "backend_transmission"], now);
  }

  requireTranscriptionConsent(grants: readonly ConsentGrant[], now = new Date()): ConsentDecision {
    return this.evaluateRequiredConsent(grants, ["microphone_capture", "audio_transcription", "backend_transmission"], now);
  }

  requireExternalProviderConsent(grants: readonly ConsentGrant[], now = new Date()): ConsentDecision {
    return this.evaluateRequiredConsent(grants, ["external_ai_provider_usage"], now);
  }

  requireRetentionConsent(grants: readonly ConsentGrant[], now = new Date()): ConsentDecision {
    return this.evaluateRequiredConsent(grants, ["session_retention"], now);
  }

  requireCodeCopilotConsent(grants: readonly ConsentGrant[], now = new Date()): ConsentDecision {
    return this.evaluateRequiredConsent(grants, ["code_copilot", "screen_coding_context_capture", "backend_transmission"], now);
  }

  private findLatestGrant(grants: readonly ConsentGrant[], consentType: ConsentType): ConsentGrant | undefined {
    return grants
      .filter((grant) => grant.consentType === consentType)
      .sort((left, right) => timestamp(right) - timestamp(left))[0];
  }
}

interface ConsentGrantRecord {
  id: string;
  userId: string;
  sessionId: string | null;
  consentType: string;
  status: string;
  consentTextVersion: string;
  grantedAt: Date | string | null;
  revokedAt: Date | string | null;
  expiresAt: Date | string | null;
}

function toConsentGrant(record: ConsentGrantRecord): ConsentGrant {
  return {
    id: record.id as ConsentGrantId,
    userId: record.userId as UserId,
    sessionId: record.sessionId ? (record.sessionId as SessionId) : undefined,
    consentType: record.consentType as ConsentType,
    status: record.status as ConsentStatus,
    consentTextVersion: record.consentTextVersion,
    grantedAt: toIso(record.grantedAt),
    revokedAt: toIso(record.revokedAt),
    expiresAt: toIso(record.expiresAt)
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

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export type ConsentBlockCode = "CONSENT_MISSING" | "CONSENT_REVOKED" | "CONSENT_EXPIRED";

export type ConsentDecision =
  | { ok: true }
  | {
      ok: false;
      code: ConsentBlockCode;
      consentType: ConsentType;
      status: ConsentStatus;
    };

function blocked(code: ConsentBlockCode, consentType: ConsentType): ConsentDecision {
  const statusByCode = {
    CONSENT_MISSING: "missing",
    CONSENT_REVOKED: "revoked",
    CONSENT_EXPIRED: "expired"
  } as const satisfies Record<ConsentBlockCode, ConsentStatus>;

  return { ok: false, code, consentType, status: statusByCode[code] };
}

function isExpired(grant: ConsentGrant, now: Date): boolean {
  if (!grant.expiresAt) return false;
  return Date.parse(grant.expiresAt) <= now.getTime();
}

function timestamp(grant: ConsentGrant): number {
  return Date.parse(grant.revokedAt ?? grant.grantedAt ?? grant.expiresAt ?? "1970-01-01T00:00:00.000Z");
}
