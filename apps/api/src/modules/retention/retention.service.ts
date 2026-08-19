import { Injectable } from "@nestjs/common";
import { SESSION_RETENTION_DAYS, type RetentionMode, type Session } from "@persuando/contracts";

@Injectable()
export class RetentionService {
  readonly moduleName = "retention";

  applyRetentionPolicy<TSession extends Pick<Session, "retentionExpiresAt">>(
    session: Omit<TSession, "retentionExpiresAt">,
    retentionMode: RetentionMode,
    now = new Date()
  ): TSession {
    return {
      ...session,
      retentionExpiresAt: this.calculateRetentionExpiresAt(retentionMode, now)
    } as TSession;
  }

  calculateRetentionExpiresAt(retentionMode: RetentionMode, now = new Date()): string {
    if (retentionMode === "manual_deleted") {
      return now.toISOString();
    }

    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + SESSION_RETENTION_DAYS);
    return expiresAt.toISOString();
  }

  filterVisibleSessions<TSession extends Pick<Session, "deletedAt" | "retentionExpiresAt">>(
    sessions: readonly TSession[],
    now = new Date()
  ): TSession[] {
    return sessions.filter((session) => !session.deletedAt && Date.parse(session.retentionExpiresAt) > now.getTime());
  }

  manualDeleteSession<TSession extends Pick<Session, "status" | "deletedAt" | "endedAt">>(
    session: TSession,
    now = new Date()
  ): TSession {
    const deletedAt = session.deletedAt ?? now.toISOString();
    return {
      ...session,
      status: "deleted",
      endedAt: session.endedAt ?? deletedAt,
      deletedAt
    };
  }

  cleanupExpiredSessions<TSession extends Pick<Session, "status" | "deletedAt" | "endedAt" | "retentionExpiresAt">>(
    sessions: readonly TSession[],
    now = new Date()
  ): { cleaned: TSession[]; retained: TSession[] } {
    const cleaned: TSession[] = [];
    const retained: TSession[] = [];

    for (const session of sessions) {
      if (session.deletedAt || Date.parse(session.retentionExpiresAt) > now.getTime()) {
        retained.push(session);
        continue;
      }

      cleaned.push(this.manualDeleteSession(session, now));
    }

    return { cleaned, retained };
  }
}
