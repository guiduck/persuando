import { Injectable } from "@nestjs/common";
import type { Session } from "@persuando/contracts";

import { RetentionService } from "./retention.service.js";

@Injectable()
export class RetentionCleanupJob {
  readonly jobName = "retention-cleanup";

  constructor(private readonly retentionService: RetentionService) {}

  run<TSession extends Pick<Session, "status" | "deletedAt" | "endedAt" | "retentionExpiresAt">>(
    sessions: readonly TSession[],
    now = new Date()
  ): { cleaned: TSession[]; retained: TSession[] } {
    return this.retentionService.cleanupExpiredSessions(sessions, now);
  }
}
