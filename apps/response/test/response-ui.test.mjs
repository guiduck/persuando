import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homePage = await readFile("apps/response/src/app/workspace-realtime-home.tsx", "utf8");
const sessionPage = await readFile("apps/response/src/app/sessions/[sessionId]/session-realtime-client.tsx", "utf8");
const sessionRoute = await readFile("apps/response/src/app/sessions/[sessionId]/page.tsx", "utf8");
const sessionLoader = await readFile("apps/response/src/app/sessions/[sessionId]/session-history-loader.tsx", "utf8");
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
  assert.match(sessionPage, /Latest generation failed/);
  assert.match(sessionPage, /previous successful explanation/);
  assert.match(sessionPage, /Screen context/);
  assert.match(sessionPage, /copilot\.explanation/);
});

test("Response session UI retains, displays, and sends up to 30 screen contexts", () => {
  assert.match(sessionPage, /MAX_SCREEN_CONTEXTS = 30/);
  assert.match(sessionPage, /history\.screenContexts \?\? \[\]/);
  assert.match(sessionPage, /screenContexts\.slice\(-MAX_SCREEN_CONTEXTS\)/);
  assert.ok(sessionPage.includes("newestFirstContexts.map((context, index)"));
  assert.ok(sessionPage.includes('scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" })'));
  assert.ok(sessionPage.includes('if (event.type === "copilot.context") return true'));
  assert.match(sessionPage, /contexts\.length}\/\{MAX_SCREEN_CONTEXTS} newest to oldest/);
  assert.match(sessionPage, /newest/);
  assert.doesNotMatch(sessionPage, /contexts\.slice\(-3\)/);
});

test("Response session receives its realtime endpoint from server runtime configuration", () => {
  assert.match(sessionRoute, /process\.env\.WEBSOCKET_URL/);
  assert.match(sessionRoute, /process\.env\.NEXT_PUBLIC_WEBSOCKET_URL/);
  assert.match(sessionLoader, /realtimeEndpoint=\{realtimeEndpoint\}/);
  assert.match(sessionPage, /Realtime socket error/);
  assert.doesNotMatch(sessionPage, /process\.env\.NEXT_PUBLIC_WEBSOCKET_URL/);
});

test("Response app copy avoids forbidden responsible-use claims", () => {
  const combined = `${homePage}\n${sessionPage}\n${loadingPage}\n${errorPage}`.toLowerCase();
  for (const forbidden of ["stealth", "invisible", "proctor", "bypass", "evade", "cheat"]) {
    assert.doesNotMatch(combined, new RegExp(forbidden));
  }
});

test("Response Code Practice renders safe highlighted Markdown", () => {
  assert.match(sessionPage, /react-markdown/);
  assert.match(sessionPage, /rehype-highlight/);
  assert.match(sessionPage, /skipHtml/);
  assert.match(sessionPage, /MarkdownPre/);
  assert.match(sessionPage, /code-block/);
  assert.match(sessionPage, /figcaption/);
  assert.doesNotMatch(sessionPage, /dangerouslySetInnerHTML/);
});

test("Response session can highlight and restore panels accessibly", () => {
  assert.match(sessionPage, /HighlightPanelButton/);
  assert.match(sessionPage, /highlightedPanel/);
  assert.match(sessionPage, /Escape/);
  assert.match(sessionPage, /aria-label=\{label\}/);
  assert.match(sessionPage, /title=\{label\}/);
  for (const expected of ["Transcript", "Summary", "What to say", "Topics", "Insights", "Follow-ups", "Screen context", "State"]) {
    assert.match(sessionPage, new RegExp(expected.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Response Code Practice exposes Code Problem, Repository, and Design System workflows", () => {
  assert.match(sessionPage, /CodePracticeWorkflow/);
  assert.match(sessionPage, /Code Problem/);
  assert.match(sessionPage, /Design System/);
  assert.match(sessionPage, /design_system/);
  assert.match(sessionPage, /Repository/);
  assert.match(sessionPage, /codePracticeWorkflow/);
  assert.match(sessionPage, /loadCodePracticeWorkflow/);
  assert.match(sessionPage, /persuando:\$\{sessionId\}:code-practice-workflow/);
  assert.match(sessionPage, /Generation skipped because a request is already in flight/);
  assert.match(sessionPage, /waiting for screenshots|updated context|analyzing/);
});