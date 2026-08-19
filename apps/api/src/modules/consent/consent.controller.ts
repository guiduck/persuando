import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Query, UnauthorizedException } from "@nestjs/common";
import type { ConsentGrantResponse, CreateConsentGrantRequest } from "@persuando/contracts";

import { AuditService } from "../audit/audit.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ConsentService } from "./consent.service.js";

@Controller("consent-grants")
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async createGrant(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Body() body: CreateConsentGrantRequest
  ): Promise<ConsentGrantResponse> {
    const ownerUserId = this.requireUserId(cookieHeader, fallbackUserId);
    const consentGrant = await this.consentService.createGrant({
      userId: ownerUserId,
      sessionId: body.sessionId,
      consentType: body.consentType,
      consentTextVersion: body.consentTextVersion
    });

    await this.auditService.createEvent({
      userId: ownerUserId,
      sessionId: body.sessionId,
      type: "consent.granted",
      metadata: {
        consentType: body.consentType,
        consentTextVersion: body.consentTextVersion
      }
    });

    return { consentGrant };
  }

  @Get()
  async listGrants(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Query("sessionId") sessionId?: string
  ) {
    return {
      consentGrants: await this.consentService.listGrants(this.requireUserId(cookieHeader, fallbackUserId), sessionId)
    };
  }

  @Delete(":grantId")
  async revokeGrant(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("grantId") grantId: string
  ): Promise<ConsentGrantResponse> {
    const ownerUserId = this.requireUserId(cookieHeader, fallbackUserId);
    const consentGrant = await this.consentService.revokeGrant(ownerUserId, grantId);
    if (!consentGrant) {
      throw new NotFoundException("Consent grant not found");
    }

    await this.auditService.createEvent({
      userId: ownerUserId,
      sessionId: consentGrant.sessionId,
      type: "consent.revoked",
      metadata: {
        consentType: consentGrant.consentType,
        consentGrantId: grantId
      }
    });

    return { consentGrant };
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
