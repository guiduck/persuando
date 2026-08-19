import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import type {
  CreateProviderCredentialRequest,
  ProviderCredentialResponse,
  ProviderValidationResponse
} from "@persuando/contracts";

import { AuditService } from "../audit/audit.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CredentialsService } from "./credentials.service.js";

@Controller("provider-credentials")
export class CredentialsController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService
  ) {}

  @Post()
  async createCredential(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Body() body: CreateProviderCredentialRequest
  ): Promise<ProviderCredentialResponse> {
    const userId = this.requireUserId(cookieHeader, fallbackUserId);
    const credential = await this.credentialsService.createCredential({
      userId,
      providerName: body.providerName,
      secret: body.secret
    });

    await this.auditService.createEvent({
      userId,
      type: "provider_credential.created",
      metadata: {
        credentialId: credential.id,
        providerName: credential.providerName,
        validationStatus: credential.validationStatus
      }
    });

    return { credential };
  }

  @Get(":credentialId")
  async getCredential(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("credentialId") credentialId: string
  ): Promise<ProviderCredentialResponse> {
    return {
      credential: await this.credentialsService.getCredentialMetadata(this.requireUserId(cookieHeader, fallbackUserId), credentialId)
    };
  }

  @Post(":credentialId/validate")
  async validateCredential(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("credentialId") credentialId: string
  ): Promise<ProviderValidationResponse> {
    return this.credentialsService.validateCredential(this.requireUserId(cookieHeader, fallbackUserId), credentialId);
  }

  @Delete(":credentialId")
  async deleteCredential(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Param("credentialId") credentialId: string
  ): Promise<ProviderCredentialResponse> {
    const userId = this.requireUserId(cookieHeader, fallbackUserId);
    const credential = await this.credentialsService.deleteCredential(userId, credentialId);

    await this.auditService.createEvent({
      userId,
      type: "provider_credential.deleted",
      metadata: {
        credentialId: credential.id,
        providerName: credential.providerName
      }
    });

    return { credential };
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
