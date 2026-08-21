import assert from "node:assert/strict";
import test from "node:test";

import { authCookieOptions, responseAuthCompleteUrl } from "../dist/src/modules/auth/auth.controller.js";
import { AuthService } from "../dist/src/modules/auth/auth.service.js";

test("AuthService maps Google profile to same-account identity", () => {
  const service = new AuthService();
  const user = service.fromGoogleProfile({
    sub: "google-user-123",
    email: "person@example.com",
    name: "Person Example"
  });

  assert.deepEqual(user, {
    id: "google:google-user-123",
    email: "person@example.com",
    displayName: "Person Example",
    provider: "google"
  });
  assert.equal(service.isSameAccount(user, "google:google-user-123"), true);
  assert.equal(service.isSameAccount(user, "google:other"), false);
});

test("AuthService exposes local-dev user for automated tests only", () => {
  const service = new AuthService();
  const user = service.localDevUser("dev-user-42");

  assert.equal(user.id, "dev-user-42");
  assert.equal(user.provider, "local-dev");
  assert.match(user.email, /local\.persuando\.dev$/);
});

test("AuthService login bridge codes are single-use", () => {
  const service = new AuthService();
  const code = service.createLoginBridgeCode("signed-session-token");

  assert.equal(service.consumeLoginBridgeCode(code), "signed-session-token");
  assert.equal(service.consumeLoginBridgeCode(code), undefined);
});

test("Auth callback builds secure host-only cookies for HTTPS API callbacks", () => {
  const options = authCookieOptions("https://api-persuando.gfig.space/auth/google/callback");

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.secure, true);
  assert.equal(options.path, "/");
  assert.equal("domain" in options, false);
});

test("Auth callback redirects to the Response App login completion route", () => {
  const redirectUrl = responseAuthCompleteUrl(["https://persuando.gfig.space", "app://persuando-capture"], "bridge-code-123");

  assert.equal(redirectUrl, "https://persuando.gfig.space/auth/complete?code=bridge-code-123");
});
