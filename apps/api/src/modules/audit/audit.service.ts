import { Injectable } from "@nestjs/common";
import { redactRecord, type AuditEvent, type SessionId, type UserId } from "@persuando/contracts";

import { DatabaseService } from "../database/database.service.js";

export type AuditEventType = AuditEvent["type"];

export interface CreateAuditEventInput {
  userId: string;
  sessionId?: string;
  type: AuditEventType;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class AuditService {
  readonly moduleName = "audit";

  constructor(private readonly database: DatabaseService) {}

  async createEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
    const metadata = input.metadata ? (redactRecord(input.metadata) as AuditEvent["metadata"]) : undefined;
    const event = {
      id: crypto.randomUUID(),
      userId: input.userId as UserId,
      sessionId: input.sessionId as SessionId | undefined,
      type: input.type,
      createdAt: new Date().toISOString(),
      metadata
    };
    await ensureUser(this.database, input.userId);
    await this.database.auditEvent.create({
      data: {
        id: event.id,
        userId: input.userId,
        sessionId: input.sessionId,
        eventType: input.type,
        safeMetadata: metadata ?? {}
      }
    });
    return event;
  }
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
