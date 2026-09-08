import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homePage = await readFile("apps/response/src/app/workspace-realtime-home.tsx", "utf8");
const sessionPage = await readFile("apps/response/src/app/sessions/[sessionId]/session-realtime-client.tsx", "utf8");
const sessionRoute = await readFile("apps/response/src/app/sessions/[sessionId]/page.tsx", "utf8");
const sessionLoader = await readFile("apps/response/src/app/sessions/[sessionId]/session-history-loader.tsx", "utf8");
const sortableLayout = await readFile("apps/response/src/app/sessions/[sessionId]/sortable-session-layout.tsx", "utf8");
const systemDesignReference = await readFile("apps/response/public/system-design-reference.md", "utf8");
const standalonePreparation = await readFile("apps/response/scripts/prepare-standalone.mjs", "utf8");
const loadingPage = await readFile("apps/response/src/app/sessions/[sessionId]/loading.tsx", "utf8");
const errorPage = await readFile("apps/response/src/app/sessions/[sessionId]/error.tsx", "utf8");
const globalCss = await readFile("apps/response/src/app/globals.css", "utf8");
const responsePackage = JSON.parse(await readFile("apps/response/package.json", "utf8"));

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

test("Response production scripts start the prepared Next standalone bundle", () => {
  assert.equal(responsePackage.scripts.build, "next build && node scripts/prepare-standalone.mjs");
  assert.equal(responsePackage.scripts.start, "node .next/standalone/apps/response/server.js");
  assert.match(standalonePreparation, /standaloneRoot/);
  assert.match(standalonePreparation, /resolve\(responseRoot, "public"\)/);
  assert.match(standalonePreparation, /resolve\(responseRoot, "\.next", "static"\)/);
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
  assert.match(sessionPage, /screenContexts\.slice\(-screenContextLimit\)/);
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
  assert.match(globalCss, /\.markdown-content blockquote/);
  assert.match(globalCss, /font-weight: 700/);
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

test("Response separates Code Practice and System Design while retaining workflow compatibility", () => {
  assert.match(sessionPage, /CodePracticeWorkflow/);
  assert.match(sessionPage, /Code Problem/);
  assert.match(sessionPage, /System Design/);
  assert.match(sessionPage, /system_design/);
  assert.match(sessionPage, /Repository/);
  assert.match(sessionPage, /codePracticeWorkflow/);
  assert.match(sessionPage, /loadCodePracticeWorkflow/);
  assert.match(sessionPage, /persuando:\$\{sessionId\}:code-practice-workflow/);
  assert.match(sessionPage, /Generation skipped because a request is already in flight/);
  assert.match(sessionPage, /waiting for screenshots|updated context|analyzing/);
  assert.match(sessionPage, /panelModes\.systemDesign/);
  assert.match(sessionPage, /requestGeneration\("system_design"/);
  assert.match(sessionPage, /previous\.contextId === newestContextId/);
  assert.match(sessionPage, /event\.type === "generation\.completed"/);
  assert.match(sessionPage, /consumePendingMode\(pendingManualModes, event\.payload\.mode\)/);
  assert.doesNotMatch(sessionPage, /onWorkflowChange\("design_system"\)/);
});

test("Response exposes per-session Portuguese and English model modes", () => {
  assert.match(sessionPage, /Model response language/);
  assert.match(sessionPage, /Português/);
  assert.match(sessionPage, /English/);
  assert.match(sessionPage, /responseLanguage/);
  assert.match(sessionPage, /interview-response-language:v1/);
});

test("Response hydrates retained visual guidance and renders paired practice steps", () => {
  assert.match(sessionPage, /history\.generatedGuidance/);
  assert.match(sessionPage, /toCopilotExplanationFromHistory/);
  assert.match(sessionPage, /PracticeStepCards/);
  assert.match(sessionPage, /code-test-grid/);
  assert.match(globalCss, /grid-template-columns: repeat\(2/);
});

test("Response renders Mermaid diagrams through a strict lazy-loaded renderer", () => {
  assert.match(sessionPage, /import\("mermaid"\)/);
  assert.match(sessionPage, /securityLevel: "strict"/);
  assert.match(sessionPage, /System Design architecture diagram/);
  assert.match(sessionPage, /mermaid-fallback/);
});

test("System Design pairs every Mermaid diagram with its explanatory legend", () => {
  assert.match(sessionPage, /SystemDesignExplanationContent/);
  assert.match(sessionPage, /extractSystemDesignDiagramLegend/);
  assert.match(sessionPage, /Legenda do diagrama\|Diagram legend/);
  assert.match(sessionPage, /system-design-diagram-legend-grid/);
  assert.match(sessionPage, /Diagrama da arquitetura e sua legenda/);
  assert.match(sessionPage, /paired\.chart/);
  assert.match(sessionPage, /paired\.legend/);
  assert.match(sessionPage, /paired\.after \? <SystemDesignExplanationContent content=\{paired\.after\} \/>/);
  assert.match(sessionPage, /if \(!paired\) return <MarkdownContent content=\{content\} \/>/);
  assert.match(globalCss, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 320px\), 1fr\)\)/);
  assert.match(globalCss, /\.system-design-legend-column/);
});

test("System Design diagrams open in an accessible near-fullscreen dialog with the legend below", () => {
  assert.match(sessionPage, /SystemDesignDiagramWithLegend/);
  assert.match(sessionPage, /SystemDesignDiagramDialog/);
  assert.match(sessionPage, /aria-label="Ampliar diagrama da arquitetura"/);
  assert.match(sessionPage, /aria-haspopup="dialog"/);
  assert.match(sessionPage, /dialog\.showModal\(\)/);
  assert.match(sessionPage, /Explore o diagrama em tamanho maior e consulte a legenda completa logo abaixo/);
  assert.match(globalCss, /\.system-design-diagram-dialog/);
  assert.match(globalCss, /height: calc\(100vh - 24px\)/);
  assert.match(globalCss, /width: max\(100%, 1400px\)/);
});

test("System Design keeps waiting after the three-minute slow notice and sends a bounded visual context", () => {
  assert.match(sessionPage, /MAX_SYSTEM_DESIGN_SCREEN_CONTEXTS = 6/);
  assert.match(sessionPage, /GENERATION_SLOW_NOTICE_MS = 180_000/);
  assert.match(sessionPage, /GENERATION_TIMEOUT_MS = 600_000/);
  assert.match(sessionPage, /Generation is taking longer than usual, but it is still running/);
  assert.match(sessionPage, /mode === "system_design" \? MAX_SYSTEM_DESIGN_SCREEN_CONTEXTS : MAX_SCREEN_CONTEXTS/);
});

test("System Design exposes an accessible Markdown cheat sheet before generated explanations", () => {
  assert.match(sessionPage, /SystemDesignReferenceLauncher/);
  assert.ok(sessionPage.indexOf('visualMode === "system_design" ? <SystemDesignReferenceLauncher') < sessionPage.indexOf('<div className="artifact-list">', sessionPage.indexOf("function CopilotPanel")));
  assert.match(sessionPage, /<dialog/);
  assert.match(sessionPage, /dialog\.showModal\(\)/);
  assert.match(sessionPage, /aria-haspopup="dialog"/);
  assert.match(sessionPage, /aria-labelledby="system-design-reference-title"/);
  assert.match(sessionPage, /aria-describedby="system-design-reference-description"/);
  assert.match(sessionPage, /fetch\("\/system-design-reference\.md"/);
  assert.match(sessionPage, /skipHtml/);
  assert.match(sessionPage, /SystemDesignConceptHeading/);
  assert.match(sessionPage, /SystemDesignReferenceListItem/);
  assert.match(globalCss, /\.system-design-reference-markdown \.system-design-reference-concept/);
  assert.match(globalCss, /\.system-design-reference-markdown \.system-design-reference-positive/);
  assert.match(globalCss, /\.system-design-reference-markdown \.system-design-reference-negative/);
});

test("System Design cheat sheet covers common concepts, trade-offs, and interview speech", () => {
  for (const concept of [
    "Load balancer",
    "Escalamento vertical vs. horizontal",
    "Cache",
    "CDN",
    "SQL vs. NoSQL",
    "Sharding",
    "Hashing consistente",
    "Resharding",
    "Replicação",
    "Índices de banco de dados",
    "Filas e event streams",
    "Rate limiting",
    "Consistência, disponibilidade e CAP",
    "Object storage"
  ]) {
    assert.match(systemDesignReference, new RegExp(concept.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(systemDesignReference, /### ✅ Pontos positivos/);
  assert.match(systemDesignReference, /### ⚠️ Trade-offs e custos/);
  assert.match(systemDesignReference, /> \*\*Fala para entrevista:\*\*/);
});

test("Response offers an explicit sortable layout editing mode", () => {
  assert.match(sessionPage, /Edit layout/);
  assert.match(sessionPage, /Done arranging/);
  assert.match(sessionPage, /Reset layout/);
  assert.match(sessionPage, /Arrange your session/);
  assert.match(sessionPage, /SortableSessionLayout/);
  assert.match(sessionPage, /aria-pressed=\{layoutEditing\}/);
  assert.match(sessionPage, /aria-live="polite"/);
  assert.match(globalCss, /\.layout-card-dragging/);
  assert.match(globalCss, /touch-action: none/);
});

test("Response sortable cards support pointer, touch-friendly drag handles, and keyboard movement", () => {
  assert.equal(responsePackage.dependencies["@dnd-kit/core"], "^6.3.1");
  assert.equal(responsePackage.dependencies["@dnd-kit/sortable"], "^10.0.0");
  assert.equal(responsePackage.dependencies["@dnd-kit/utilities"], "^3.2.2");
  assert.match(sortableLayout, /PointerSensor/);
  assert.match(sortableLayout, /KeyboardSensor/);
  assert.match(sortableLayout, /sortableKeyboardCoordinates/);
  assert.match(sortableLayout, /activationConstraint: \{ distance: 8 \}/);
  assert.match(sortableLayout, /Drag .* to a new position/);
  assert.match(sortableLayout, /Move .* earlier/);
  assert.match(sortableLayout, /Move .* later/);
  assert.match(sortableLayout, /arrayMove/);
});

test("Response persists a normalized card order per assistant mode", () => {
  assert.match(sessionPage, /loadLayoutOrder\(assistantMode\)/);
  assert.match(sessionPage, /saveLayoutOrder\(assistantMode, layoutOrder\)/);
  assert.match(sessionPage, /normalizeLayoutOrder/);
  assert.match(sessionPage, /defaultLayoutOrder/);
  assert.match(sessionPage, /response-layout:\$\{assistantMode\}:v1/);
  assert.match(sessionPage, /"systemDesign", "state"/);
});
