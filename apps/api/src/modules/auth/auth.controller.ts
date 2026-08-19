import { Controller, Get, Headers, Query, Res, UnauthorizedException } from "@nestjs/common";

import { ApiConfigService } from "../config/config.service.js";
import { UsersService } from "../users/users.service.js";
import { AuthService, type AuthenticatedUser } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ApiConfigService,
    private readonly users: UsersService
  ) {}

  @Get("google")
  startGoogleLogin(@Res() response: RedirectResponse): void {
    const { googleClientId, googleCallbackUrl } = this.config.env;
    if (!googleClientId) throw new UnauthorizedException("Google auth is not configured");

    const state = this.authService.createStateToken();
    response.cookie("persuando_oauth_state", state, cookieOptions());

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", googleClientId);
    url.searchParams.set("redirect_uri", googleCallbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");

    response.redirect(url.toString());
  }

  @Get("google/callback")
  async completeGoogleLogin(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res() response: RedirectResponse
  ): Promise<void> {
    if (!code || !state) throw new UnauthorizedException("Missing Google OAuth callback parameters");
    if (parseCookie(cookieHeader).persuando_oauth_state !== state) {
      throw new UnauthorizedException("Invalid Google OAuth state");
    }

    const profile = await this.fetchGoogleProfile(code);
    const user = this.authService.fromGoogleProfile(profile);
    await this.users.upsertAuthenticatedUser(user);

    response.cookie("persuando_user", this.authService.createUserSessionToken(user), cookieOptions());
    response.clearCookie("persuando_oauth_state");
    response
      .status(200)
      .send(`<html><body><h1>Persuando login ok</h1><p>Signed in as ${escapeHtml(user.email)}.</p></body></html>`);
  }

  @Get("me")
  me(@Headers("cookie") cookieHeader: string | undefined): { authenticated: boolean; user?: AuthenticatedUser } {
    const token = parseCookie(cookieHeader).persuando_user;
    const user = token ? this.authService.verifyUserSessionToken(token) : undefined;
    return user ? { authenticated: true, user } : { authenticated: false };
  }

  private async fetchGoogleProfile(code: string): Promise<{ sub: string; email: string; name?: string }> {
    const { googleClientId, googleClientSecret, googleCallbackUrl } = this.config.env;
    if (!googleClientId || !googleClientSecret) throw new UnauthorizedException("Google auth is not configured");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: googleCallbackUrl
      })
    });

    if (!tokenResponse.ok) throw new UnauthorizedException("Google token exchange failed");
    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenPayload.access_token) throw new UnauthorizedException("Google token response missing access token");

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` }
    });

    if (!userInfoResponse.ok) throw new UnauthorizedException("Google userinfo fetch failed");
    return (await userInfoResponse.json()) as { sub: string; email: string; name?: string };
  }

}

interface RedirectResponse {
  cookie(name: string, value: string, options?: Record<string, unknown>): void;
  clearCookie(name: string): void;
  redirect(url: string): void;
  status(code: number): { send(body: string): void };
}

function cookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/"
  };
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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
