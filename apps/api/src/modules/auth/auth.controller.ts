import { Body, Controller, Get, Headers, Post, Query, Res, UnauthorizedException } from "@nestjs/common";

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
  startGoogleLogin(@Query("clientType") clientType: string | undefined, @Res() response: RedirectResponse): void {
    const { googleClientId, googleCallbackUrl } = this.config.env;
    if (!googleClientId) throw new UnauthorizedException("Google auth is not configured");

    const state = this.authService.createStateToken();
    const options = authCookieOptions(googleCallbackUrl);
    response.cookie("persuando_oauth_state", state, options);
    if (clientType === "capture") {
      response.cookie("persuando_oauth_client", "capture", options);
    }

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
    const callbackCookies = parseCookie(cookieHeader);
    if (callbackCookies.persuando_oauth_state !== state) {
      throw new UnauthorizedException("Invalid Google OAuth state");
    }
    const shouldCompleteInCapture = callbackCookies.persuando_oauth_client === "capture";

    const profile = await this.fetchGoogleProfile(code);
    const user = this.authService.fromGoogleProfile(profile);
    await this.users.upsertAuthenticatedUser(user);

    const sessionToken = this.authService.createUserSessionToken(user);
    const options = authCookieOptions(this.config.env.googleCallbackUrl);
    response.cookie("persuando_user", sessionToken, options);
    response.clearCookie("persuando_oauth_state", options);
    response.clearCookie("persuando_oauth_client", options);
    if (shouldCompleteInCapture) {
      response.send(captureAuthCompleteHtml(user));
      return;
    }

    response.redirect(responseAuthCompleteUrl(this.config.env.allowedOrigins, this.authService.createLoginBridgeCode(sessionToken)));
  }

  @Post("bridge/consume")
  consumeLoginBridge(@Body("code") code: string | undefined): { sessionToken: string } {
    if (!code) throw new UnauthorizedException("Missing login bridge code");

    const sessionToken = this.authService.consumeLoginBridgeCode(code);
    if (!sessionToken) throw new UnauthorizedException("Invalid or expired login bridge code");

    return { sessionToken };
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
  clearCookie(name: string, options?: Record<string, unknown>): void;
  redirect(url: string): void;
  send(body: string): void;
}

export function authCookieOptions(googleCallbackUrl: string): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: googleCallbackUrl.startsWith("https://"),
    path: "/"
  };
}

export function responseAuthCompleteUrl(allowedOrigins: readonly string[], bridgeCode: string): string {
  const url = new URL("/auth/complete", responseAppRedirectUrl(allowedOrigins));
  url.searchParams.set("code", bridgeCode);
  return url.toString();
}

export function responseAppRedirectUrl(allowedOrigins: readonly string[]): string {
  return allowedOrigins.find((origin) => origin.startsWith("http://") || origin.startsWith("https://")) ?? "http://localhost:3000";
}

export function captureAuthCompleteHtml(user: AuthenticatedUser): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Persuando login ok</title>
  </head>
  <body>
    <h1>Persuando login ok</h1>
    <p>Signed in as ${escapeHtml(user.email)}.</p>
    <p>You can close this window and return to Persuando Capture.</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
