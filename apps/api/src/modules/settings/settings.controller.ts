import { Body, Controller, Get, Headers, Put, UnauthorizedException } from "@nestjs/common";
import type { SettingsResponse, UpdateSettingsRequest } from "@persuando/contracts";

import { AuthService } from "../auth/auth.service.js";
import { CredentialsService } from "../credentials/credentials.service.js";
import { SettingsService } from "./settings.service.js";

@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
    private readonly credentialsService: CredentialsService
  ) {}

  @Get()
  async getSettings(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined
  ): Promise<SettingsResponse> {
    return this.toResponse(this.requireUserId(cookieHeader, fallbackUserId));
  }

  @Put()
  async updateSettings(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-user-id") fallbackUserId: string | undefined,
    @Body() body: UpdateSettingsRequest
  ): Promise<SettingsResponse> {
    const userId = this.requireUserId(cookieHeader, fallbackUserId);
    await this.settingsService.updateSettings(userId, body);
    return this.toResponse(userId);
  }

  private async toResponse(userId: string): Promise<SettingsResponse> {
    const settings = await this.settingsService.getSettings(userId);
    const providerCredential = settings.providerCredentialId
      ? await this.credentialsService.getCredentialMetadata(userId, settings.providerCredentialId)
      : undefined;

    return {
      settings,
      providerCredential
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
