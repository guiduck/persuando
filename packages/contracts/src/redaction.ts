export const sensitiveKeyPatterns = [
  /api[-_]?key/i,
  /authorization/i,
  /credential/i,
  /ciphertext/i,
  /decrypted/i,
  /secret/i,
  /audio/i,
  /provider[-_]?payload/i,
  /transcript/i
] as const;

export const redactedValue = "[REDACTED]";

export function maskProviderCredential(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function isSensitiveKey(key: string): boolean {
  return sensitiveKeyPatterns.some((pattern) => pattern.test(key));
}

export function redactRecord<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, isSensitiveKey(key) ? redactedValue : value])
  );
}
