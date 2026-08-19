import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Session, UserId, Workspace, WorkspaceId } from "@persuando/contracts";

import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class WorkspacesService {
  readonly moduleName = "workspaces";

  constructor(private readonly database: DatabaseService) {}

  async getOrCreateCurrentWorkspace(userId: string): Promise<Workspace> {
    await ensureUser(this.database, userId);
    const existing = await this.database.workspace.findFirst({
      where: {
        ownerUserId: userId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
    if (existing) return toWorkspace(existing, [], []);

    const workspace = await this.database.workspace.create({
      data: {
        id: randomUUID(),
        ownerUserId: userId,
        name: "Personal workspace"
      }
    });
    return toWorkspace(workspace, [], []);
  }

  async buildWorkspaceState(userId: string, sessions: readonly Session[]): Promise<Workspace> {
    const workspace = await this.getOrCreateCurrentWorkspace(userId);
    const activeSessionIds = sessions
      .filter((session) => session.status === "active" || session.status === "paused" || session.status === "created")
      .map((session) => session.id);
    const recentSessionIds = sessions
      .filter((session) => session.status === "ended" || session.status === "revoked" || session.status === "error")
      .map((session) => session.id);

    return {
      ...workspace,
      activeSessionIds,
      recentSessionIds
    };
  }
}

interface WorkspaceRecord {
  id: string;
  ownerUserId: string;
  name: string;
}

function toWorkspace(record: WorkspaceRecord, activeSessionIds: Workspace["activeSessionIds"], recentSessionIds: Workspace["recentSessionIds"]): Workspace {
  return {
    id: record.id as WorkspaceId,
    ownerUserId: record.ownerUserId as UserId,
    name: record.name,
    activeSessionIds,
    recentSessionIds
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
