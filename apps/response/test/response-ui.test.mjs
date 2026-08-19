import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homePage = await readFile("apps/response/src/app/workspace-realtime-home.tsx", "utf8");
const sessionPage = await readFile("apps/response/src/app/sessions/[sessionId]/session-realtime-client.tsx", "utf8");
const loadingPage = await readFile("apps/response/src/app/sessions/[sessionId]/loading.tsx", "utf8");
const errorPage = await readFile("apps/response/src/app/sessions/[sessionId]/error.tsx", "utf8");

test("Response session UI covers required live and retained states", () => {
  const combined = `${homePage}\n${sessionPage}\n${loadingPage}\n${errorPage}`.toLowerCase();
  for (const expected of [
    "loading history",
    "no retained transcript yet",
    "live",
    "reconnecting",
    "paused",
    "ended",
    "deleted",
    "providererror",
    "session unavailable"
  ]) {
    assert.match(combined.replaceAll(/\s+/g, ""), new RegExp(expected.replaceAll(/\s+/g, "")));
  }
});

test("Response session UI includes topic, direct answer, and code-practice surfaces", () => {
  assert.match(sessionPage, /What to say/);
  assert.match(sessionPage, /Topics/);
  assert.match(sessionPage, /Code practice/);
  assert.match(sessionPage, /Screen context/);
  assert.match(sessionPage, /copilot\.explanation/);
});

test("Response app copy avoids forbidden responsible-use claims", () => {
  const combined = `${homePage}\n${sessionPage}\n${loadingPage}\n${errorPage}`.toLowerCase();
  for (const forbidden of ["stealth", "invisible", "proctor", "bypass", "evade", "cheat"]) {
    assert.doesNotMatch(combined, new RegExp(forbidden));
  }
});
