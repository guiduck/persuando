import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, UnauthorizedException } from "@nestjs/common";
import type { CreateSessionRequest, ManualDeleteSessionResponse, SessionHistoryResponse, SessionResponse } from "@persuando/contracts";

import { AuthService, type AuthenticatedUser } from "../auth/auth.service.js";
import { ConsentService } from "../consent/consent.service.js";
import { WorkspacesService } from "../workspaces/workspaces.service.js";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { SessionsService } from "./sessions.service.js";

@Controller("sessions")
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly consentService: ConsentService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async createSession(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Body() body: CreateSessionRequest
  ): Promise<SessionResponse> {
    const user = this.requireUser(cookieHeader, fallbackUserId);
    const workspace = await this.workspacesService.getOrCreateCurrentWorkspace(user.id);
    this.workspaceAccessService.assertWorkspaceAccess(user, workspace);
    if (body.workspaceId !== workspace.id) {
      throw new NotFoundException("Workspace not found");
    }

    const session = await this.sessionsService.createSession({
      ...body,
      ownerUserId: user.id
    });
    return {
      session,
      consentGrants: await this.consentService.listGrants(user.id, session.id)
    };
  }

  @Get(":sessionId")
  async getSession(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("sessionId") sessionId: string
  ): Promise<SessionHistoryResponse> {
    const user = this.requireUser(cookieHeader, fallbackUserId);
    const history = await this.sessionsService.getSessionHistory(sessionId);
    this.workspaceAccessService.assertSessionAccess(user, history?.session);
    return {
      ...history!,
      consentGrants: await this.consentService.listGrants(user.id, sessionId)
    };
  }

  @Delete(":sessionId")
  async deleteSession(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("sessionId") sessionId: string
  ): Promise<ManualDeleteSessionResponse> {
    const user = this.requireUser(cookieHeader, fallbackUserId);
    const session = await this.sessionsService.getSession(sessionId);
    this.workspaceAccessService.assertSessionAccess(user, session);
    const deleted = await this.sessionsService.manualDeleteSession(sessionId);
    if (!deleted?.deletedAt) throw new NotFoundException("Session not found");
    return {
      sessionId,
      deletedAt: deleted.deletedAt
    };
  }

  private requireUser(cookieHeader: string | undefined, fallbackUserId: string | undefined): AuthenticatedUser {
    if (fallbackUserId) {
      return {
        id: fallbackUserId,
        email: `${fallbackUserId}@local.persuando.dev`,
        displayName: fallbackUserId,
        provider: fallbackUserId.startsWith("google:") ? "google" : "local-dev"
      };
    }

    const token = parseCookie(cookieHeader).persuando_user;
    const user = token ? this.authService.verifyUserSessionToken(token) : undefined;
    if (!user) throw new UnauthorizedException("Missing user identity");
    return user;
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
