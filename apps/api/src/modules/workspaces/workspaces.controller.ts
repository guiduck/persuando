import { Controller, Get, Headers, UnauthorizedException } from "@nestjs/common";
import type { GetCurrentWorkspaceResponse } from "@persuando/contracts";

import { AuthService } from "../auth/auth.service.js";
import { SessionsService } from "../sessions/sessions.service.js";
import { WorkspacesService } from "./workspaces.service.js";

@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly sessionsService: SessionsService,
    private readonly authService: AuthService
  ) {}

  @Get("current")
  async getCurrentWorkspace(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined
  ): Promise<GetCurrentWorkspaceResponse> {
    const userId = this.requireUserId(cookieHeader, fallbackUserId);
    const sessions = await this.sessionsService.listVisibleSessionsForUser(userId);
    const workspace = await this.workspacesService.buildWorkspaceState(userId, sessions);
    return {
      workspace,
      activeSessions: sessions.filter((session) => workspace.activeSessionIds.includes(session.id)),
      recentSessions: sessions.filter((session) => workspace.recentSessionIds.includes(session.id))
    };
  }

  private requireUserId(cookieHeader: string | undefined, fallbackUserId: string | undefined): string {
    if (fallbackUserId) return fallbackUserId;
    const token = parseCookie(cookieHeader).persuando_user;
    const user = token ? this.authService.verifyUserSessionToken(token) : undefined;
    if (!user) throw new UnauthorizedException("Missing user identity");
    return user.id;
  }
}

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader?.split(";") ?? []) {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(valueParts.join("="));
  }
  return cookies;
}
