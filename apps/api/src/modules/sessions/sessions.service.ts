import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CreateSessionRequest,
  Insight,
  InsightId,
  Session,
  SessionHistoryResponse,
  SessionId,
  Suggestion,
  SuggestionId,
  Summary,
  TranscriptSegment,
  TranscriptSegmentId,
  UserId,
  WorkspaceId
} from "@persuando/contracts";

import { DatabaseService } from "../database/database.service.js";
import { RetentionService } from "../retention/retention.service.js";

const STALE_OPEN_SESSION_MS = 2 * 60 * 60 * 1000;

export interface CreateSessionInput extends CreateSessionRequest {
  ownerUserId: string;
}

@Injectable()
export class SessionsService {
  readonly moduleName = "sessions";

  constructor(
    private readonly retentionService: RetentionService,
    private readonly database: DatabaseService
  ) {}

  async createSession(input: CreateSessionInput, now = new Date()): Promise<Session> {
    await ensureUser(this.database, input.ownerUserId);
    await this.endSupersededOpenSessions(input.ownerUserId, now);
    const session = this.retentionService.applyRetentionPolicy<Session>(
      {
        id: randomUUID() as SessionId,
        workspaceId: input.workspaceId as WorkspaceId,
        ownerUserId: input.ownerUserId as UserId,
        title: input.title,
        status: "created",
        startedAt: now.toISOString(),
        activeResponseClientIds: []
      },
      input.retentionMode,
      now
    );
    const created = await this.database.session.create({
      data: {
        id: session.id,
        workspaceId: input.workspaceId,
        ownerUserId: input.ownerUserId,
        title: input.title,
        status: session.status,
        startedAt: session.startedAt ? new Date(session.startedAt) : undefined,
        retentionExpiresAt: new Date(session.retentionExpiresAt)
      }
    });
    return toSession(created);
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const session = await this.database.session.findUnique({ where: { id: sessionId } });
    return session ? toSession(session) : undefined;
  }

  async getSessionHistory(sessionId: string): Promise<Omit<SessionHistoryResponse, "consentGrants"> | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;
    const [transcriptSegments, summaries, insights, suggestions] = await Promise.all([
      this.database.transcriptSegment.findMany({ where: { sessionId }, orderBy: { startMs: "asc" } }),
      this.database.summary.findMany({ where: { sessionId }, orderBy: { generatedAt: "asc" } }),
      this.database.insight.findMany({ where: { sessionId }, orderBy: { generatedAt: "asc" } }),
      this.database.suggestion.findMany({ where: { sessionId }, orderBy: { generatedAt: "asc" } })
    ]);
    return {
      session,
      transcriptSegments: transcriptSegments.map(toTranscriptSegment),
      summaries: summaries.map(toSummary),
      insights: insights.map(toInsight),
      suggestions: suggestions.map(toSuggestion)
    };
  }

  async listVisibleSessionsForUser(userId: string, now = new Date()): Promise<Session[]> {
    await this.endStaleOpenSessions(userId, now);
    const sessions = await this.database.session.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" }
    });
    return this.retentionService.filterVisibleSessions(sessions.map(toSession), now);
  }

  private async endStaleOpenSessions(userId: string, now: Date): Promise<void> {
    const sessions = await this.database.session.findMany({
      where: { ownerUserId: userId }
    });
    const staleOpenSessions = sessions.filter(
      (session) =>
        !session.deletedAt &&
        isOpenSessionStatus(session.status) &&
        now.getTime() - sessionSortTime(session) >= STALE_OPEN_SESSION_MS
    );

    for (const session of staleOpenSessions) {
      await this.database.session.update({
        where: { id: session.id },
        data: {
          status: "ended",
          endedAt: session.endedAt ? new Date(session.endedAt) : now
        }
      });
    }
  }

  private async endSupersededOpenSessions(userId: string, now: Date): Promise<void> {
    const sessions = await this.database.session.findMany({
      where: { ownerUserId: userId }
    });
    const openSessions = sessions
      .filter((session) => !session.deletedAt && isOpenSessionStatus(session.status))
      .sort((left, right) => sessionSortTime(right) - sessionSortTime(left));

    for (const session of openSessions) {
      await this.database.session.update({
        where: { id: session.id },
        data: {
          status: "ended",
          endedAt: session.endedAt ? new Date(session.endedAt) : now
        }
      });
    }
  }

  async markActive(sessionId: string): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session || session.deletedAt) return undefined;
    const updated = await this.database.session.update({
      where: { id: sessionId },
      data: { status: "active" }
    });
    return toSession(updated);
  }

  async updateSessionStatus(sessionId: string, status: Session["status"]): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session || session.deletedAt) return undefined;
    const updated = await this.database.session.update({
      where: { id: sessionId },
      data: { status }
    });
    return toSession(updated);
  }

  async endSession(sessionId: string, now = new Date()): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session || session.deletedAt) return undefined;
    const updated = await this.database.session.update({
      where: { id: sessionId },
      data: {
        status: "ended",
        endedAt: session.endedAt ? new Date(session.endedAt) : now
      }
    });
    return toSession(updated);
  }

  async manualDeleteSession(sessionId: string, now = new Date()): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;
    const deleted = this.retentionService.manualDeleteSession(session, now);
    const updated = await this.database.session.update({
      where: { id: sessionId },
      data: {
        status: deleted.status,
        endedAt: deleted.endedAt ? new Date(deleted.endedAt) : undefined,
        deletedAt: deleted.deletedAt ? new Date(deleted.deletedAt) : undefined
      }
    });
    return toSession(updated);
  }

  async cleanupExpiredSessions(now = new Date()): Promise<{ cleaned: Session[]; retainedCount: number }> {
    const sessions = (await this.database.session.findMany({
      where: { deletedAt: null }
    })).map(toSession);
    const result = this.retentionService.cleanupExpiredSessions(sessions, now);
    const cleaned = await Promise.all(
      result.cleaned.map((session) =>
        this.database.session.update({
          where: { id: session.id },
          data: {
            status: session.status,
            endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
            deletedAt: session.deletedAt ? new Date(session.deletedAt) : undefined
          }
        })
      )
    );
    return { cleaned: cleaned.map(toSession), retainedCount: result.retained.length };
  }
}

interface SessionRecord {
  id: string;
  createdAt?: Date | string;
  workspaceId: string;
  ownerUserId: string;
  title: string;
  status: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  retentionExpiresAt: Date | string;
  deletedAt: Date | string | null;
  activeCaptureClientId: string | null;
}

function toSession(record: SessionRecord): Session {
  return {
    id: record.id as SessionId,
    workspaceId: record.workspaceId as WorkspaceId,
    ownerUserId: record.ownerUserId as UserId,
    title: record.title,
    status: record.status as Session["status"],
    startedAt: toIso(record.startedAt),
    endedAt: toIso(record.endedAt),
    retentionExpiresAt: toIso(record.retentionExpiresAt)!,
    deletedAt: toIso(record.deletedAt),
    activeCaptureClientId: record.activeCaptureClientId ?? undefined,
    activeResponseClientIds: []
  };
}

interface TranscriptSegmentRecord {
  id: string;
  sessionId: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | { toNumber(): number };
  source: string;
  language: string;
  provisional: boolean;
}

function toTranscriptSegment(record: TranscriptSegmentRecord): TranscriptSegment {
  return {
    id: record.id as TranscriptSegmentId,
    sessionId: record.sessionId as SessionId,
    text: record.text,
    startMs: record.startMs,
    endMs: record.endMs,
    confidence: typeof record.confidence === "number" ? record.confidence : record.confidence.toNumber(),
    source: "microphone",
    language: record.language,
    provisional: record.provisional
  };
}

interface SummaryRecord {
  id: string;
  sessionId: string;
  content: string;
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toSummary(record: SummaryRecord): Summary {
  return {
    id: record.id,
    sessionId: record.sessionId as SessionId,
    content: record.content,
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)!
  };
}

interface InsightRecord {
  id: string;
  sessionId: string;
  insightType: string;
  content: string;
  confidence: number | { toNumber(): number };
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toInsight(record: InsightRecord): Insight {
  return {
    id: record.id as InsightId,
    sessionId: record.sessionId as SessionId,
    type: record.insightType as Insight["type"],
    content: record.content,
    confidence: typeof record.confidence === "number" ? record.confidence : record.confidence.toNumber(),
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)!
  };
}

interface SuggestionRecord {
  id: string;
  sessionId: string;
  category: string;
  content: string;
  urgency: string;
  sourceSegmentIds: string[];
  generatedAt: Date | string;
}

function toSuggestion(record: SuggestionRecord): Suggestion {
  return {
    id: record.id as SuggestionId,
    sessionId: record.sessionId as SessionId,
    category: record.category as Suggestion["category"],
    content: record.content,
    urgency: record.urgency as Suggestion["urgency"],
    sourceSegmentIds: record.sourceSegmentIds as TranscriptSegmentId[],
    generatedAt: toIso(record.generatedAt)!
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

function isOpenSessionStatus(status: string): boolean {
  return status === "created" || status === "active" || status === "paused";
}

function sessionSortTime(record: SessionRecord): number {
  return Date.parse(toIso(record.startedAt) ?? toIso(record.createdAt) ?? "1970-01-01T00:00:00.000Z");
}