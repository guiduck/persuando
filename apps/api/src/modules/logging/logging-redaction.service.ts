import { Injectable } from "@nestjs/common";
import { isSensitiveKey, redactedValue } from "@persuando/contracts";

@Injectable()
export class LoggingRedactionService {
  redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? redactedValue : this.redact(entry)
      ])
    );
  }
}
