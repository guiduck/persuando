import { activeMvpConsentTypes, type ConsentGrant, type ConsentType, type Session } from "./types.js";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasActiveConsent(grants: readonly ConsentGrant[], consentType: ConsentType): boolean {
  return grants.some((grant) => grant.consentType === consentType && grant.status === "granted");
}

export function validateRequiredMvpConsent(grants: readonly ConsentGrant[]): ValidationResult {
  const missing = activeMvpConsentTypes.filter((type) => !hasActiveConsent(grants, type));
  if (missing.length > 0) {
    return { ok: false, reason: `Missing active consent: ${missing.join(", ")}` };
  }
  return { ok: true };
}

export function validateSameAccountAccess(session: Pick<Session, "ownerUserId" | "deletedAt">, userId: string): ValidationResult {
  if (session.deletedAt) return { ok: false, reason: "Session has been deleted" };
  if (session.ownerUserId !== userId) return { ok: false, reason: "Session belongs to another account" };
  return { ok: true };
}

export function validateMaskedCredential(value: string): ValidationResult {
  if (value.length > 16 && !value.includes("...")) {
    return { ok: false, reason: "Credential metadata must not expose an unmasked secret" };
  }
  return { ok: true };
}
