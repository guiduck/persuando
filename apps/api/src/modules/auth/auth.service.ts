import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  provider: "google" | "local-dev";
}

export interface GoogleOAuthProfile {
  sub: string;
  email: string;
  name?: string;
}

interface LoginBridgeCode {
  sessionToken: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly sessionSecret = process.env.AUTH_SESSION_SECRET ?? "local-test-secret";
  private readonly loginBridgeCodes = new Map<string, LoginBridgeCode>();

  getAuthProviderSummary(): string {
    return "google-primary-local-dev-test-fallback";
  }

  fromGoogleProfile(profile: GoogleOAuthProfile): AuthenticatedUser {
    return {
      id: `google:${profile.sub}`,
      email: profile.email,
      displayName: profile.name ?? profile.email,
      provider: "google"
    };
  }

  localDevUser(userId = "dev-user-1"): AuthenticatedUser {
    return {
      id: userId,
      email: `${userId}@local.persuando.dev`,
      displayName: "Local Dev User",
      provider: "local-dev"
    };
  }

  isSameAccount(user: AuthenticatedUser, ownerUserId: string): boolean {
    return user.id === ownerUserId;
  }

  createStateToken(): string {
    return randomBytes(24).toString("base64url");
  }

  createLoginBridgeCode(sessionToken: string): string {
    const code = randomBytes(32).toString("base64url");
    this.loginBridgeCodes.set(code, {
      sessionToken,
      expiresAt: Date.now() + 2 * 60 * 1000
    });
    return code;
  }

  consumeLoginBridgeCode(code: string): string | undefined {
    const ticket = this.loginBridgeCodes.get(code);
    this.loginBridgeCodes.delete(code);
    if (!ticket || ticket.expiresAt < Date.now()) return undefined;
    return ticket.sessionToken;
  }

  createUserSessionToken(user: AuthenticatedUser): string {
    const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  verifyUserSessionToken(token: string): AuthenticatedUser | undefined {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !this.isValidSignature(payload, signature)) return undefined;

    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthenticatedUser;
      if (!parsed.id || !parsed.email || !parsed.displayName || parsed.provider !== "google") return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.sessionSecret).update(payload).digest("base64url");
  }

  private isValidSignature(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
