# Roadmap

This file describes the stable product direction. For current execution status, see
`docs/handoff.md`.

## Phase 1. Foundation

Goal:

- Establish product definition, safety boundaries, two-mode architecture, user settings, consent model, and TypeScript-first stack.

Status:

- Complete. Initial product docs, constitution, and `specs/001-persuando-mvp/` define the MVP
  direction, architecture plan, task breakdown, and implementation evidence.
- The product/UI direction is toolbar-first: a floating Capture toolbar, Windows tray show/hide,
  simple dashboard/settings, realtime audio chunk upload, consented user-requested screen/context
  capture, and Response Mode focused on transcripts, summaries, explanations, and direct suggested
  responses.

Gate:

- `docs/overview.md`, `docs/vision.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/handoff.md`, and the initial `docs/next-spec-prompt.md` were complete enough to run `/speckit-specify`.
- First MVP specification exists and preserves the documented consent, responsible-use, two-mode
  architecture, and narrow MVP boundaries.
- First MVP plan exists and selects NestJS, native WebSocket, backend-encrypted provider
  credentials, 7-day workspace session retention, and manual delete while keeping advanced context
  deferred.
- First MVP task breakdown exists with validation, prototype/manual smoke, documentation closeout,
  roadmap, handoff, and next-spec prompt tasks.
- Build and test validation pass for the implemented MVP slice, including active-session reconciliation and periodic screenshot startup regressions.
- Local integrated WebSocket smoke passes for session setup, consent, capture activation, audio
  upload, transcript/summary/insight/suggestion fan-out, copilot context/explanation, and manual
  delete.
- Application database access uses Prisma models, with raw SQL limited to migration files and the
  migration runner unless a future plan explicitly changes that boundary.
- Response Mode and Capture Mode now both exist as runnable applications, with the remaining work
  focused on packaging, UI polish, provider hardening, visual-context limits, and production deployment.

## Phase 2. Prototype

Goal:

- Build a navigable prototype based on `docs/` and `references/lovable-template/`.
- Validate the floating Capture toolbar, tray show/hide behavior, simple dashboard/settings,
  consent flows, and Response Mode explanations/suggested responses before production UI
  implementation.
- Current implementation has moved into the production MVP track for backend, Response App, and the
  first Capture App scaffold. Prototype/manual smoke remains pending and should validate the
  toolbar/tray/live-response loop before UI polish hardening.

Status:

- Implemented as `docs/prototype-mvp-flow.md` and reflected in production MVP surfaces. External
  Lovable export remains optional/future; the production apps now serve as the functional prototype
  for toolbar, tray, settings, consent, capture, response, and retention flows.

Gate:

- Prototype demonstrates account/session setup, floating toolbar, tray show/hide, settings, consent
  toggles, capture status, realtime transcript, automatic explanations, suggested responses, and
  response-mode session output.

## Phase 3. Production MVP

Goal:

- Build the scalable MVP based on the validated docs and prototype.
- Include Windows Electron Capture App, floating toolbar, Google login, tray/background behavior,
  settings, user API key entry, transcription model selection, microphone capture, consented
  periodic screenshot/context capture, realtime transcription, backend session streaming,
  code-practice explanations, and web/same-machine Response Mode.
- Use same-account Response Mode access, encrypted backend provider credentials, 7-day workspace
  session retention, and manual session deletion.
- Use NestJS and native WebSocket unless a later approved plan amendment changes those decisions.

Status:

- First integrated MVP slice implemented and validated locally. Runtime fixes now keep Response polling from ending active captures and allow periodic screenshot capture to start when enabled during an active session. Code Practice prompting is constrained to study/practice/review tutoring with detected-language pseudocode/snippets, code-backed step-by-step guidance, Big-O, responsible-use boundaries, Markdown headings/lists, fenced code blocks, longer OpenAI-compatible generation settings, explicit errors for malformed or empty provider outputs, and Response Mode Auto triggering from new screen context. Copilot context now defaults blank or missing programming language to JavaScript on both Capture and API paths so screenshot context does not stop active capture when user settings are incomplete. Response Mode renders Code Practice answers with semantic Markdown sections, inline code, and scrollable code blocks so longer explanations are readable in the live session view. Windows Capture now has a local VPS run script plus Electron Builder outputs for an unpacked `.exe` and NSIS installer. The production-style Google OAuth flow now bridges browser login from the API callback back to the Response App so separate API/frontend subdomains can each hold the right host-only login cookie, while Electron Capture uses a separate `clientType=capture` callback completion path that stays on the API host. Not production-ready for end users until app icon, publisher/signing, update policy, UI polish, extended real-provider smoke, explicit visual-context quality gates, richer syntax-highlighting polish, deployment hardening, durable multi-instance auth bridge storage, continued browser/Electron auth smoke, and screen-context hardening are completed.

Gate:

- A user can run Capture Mode on Windows, hide/show the floating toolbar from the tray, capture
  microphone audio with consent, optionally send consented periodic screenshots/context, and view
  live transcript summaries, topic explanations, and suggested responses from Response Mode on the
  same machine or another browser/device.

## Phase 4. Advanced Context

Goal:

- Add robust system-audio capture, advanced diarization, broader visual context analysis, automatic LeetCode/HackerRank detection for practice sessions, local/offline models, and non-Windows desktop apps.

Status:

- Deferred beyond MVP.

Gate:

- Advanced capture modes remain off by default, require explicit consent, and preserve the product boundary against invisibility, recording bypass, focus evasion, and proctoring evasion.

## Non-Goals

- Do not build or market Persuando as an invisible app.
- Do not bypass screen sharing, recording, browser focus detection, proctoring tools, or platform rules.
- Do not make code copilot mode active without explicit consent and visible active state. Do not auto-generate copy-paste coding answers from live assessment, proctored, interview, contest, or platform-challenge screenshots.

## Update - 2026-08-22 Screenshot Debug Trace

Phase 3 Production MVP advanced by fixing the runtime Electron preload mismatch that prevented active-session periodic screen context commands from reaching the renderer in packaged/dev runtime. Periodic and manual screenshots now carry optional realtime `debugId` values and consistent `[screen:<debugId>]` logs across Capture, Electron main, API ingest/persist/fan-out, and Response apply. Gate remaining: manual Electron Capture against the VPS must verify screenshots render in Response Mode and that the same debug ID is visible end to end. Non-goal: this update does not add durable image storage, redaction, or broader visual-context policy changes.

## Update - 2026-08-23 Code Practice Visual Grounding

Phase 3 Production MVP now sends the latest 30 visual contexts to real Code Practice generation in FIFO order, restores persisted contexts after refresh, and displays the full 30-item window. The incorrect keyword-based Tree Height fallback was removed: provider content is preserved, while malformed or empty responses surface as `PROVIDER_RESPONSE_INVALID` with request/response timing and image-count logs. The remaining gate is a new-session VPS smoke against the configured OpenAI-compatible model. Deferred work includes image compression/deduplication, durable object storage, historical-image recovery, and adaptive context selection for latency and cost; this change does not add a new provider or alter secrets.

## Update - 2026-08-23 Incremental Code Practice Tutoring

Phase 3 now includes a two-pass real-provider Code Practice flow: structured visual extraction across all 30 FIFO screenshots, followed by a grounded tutoring response that receives up to four persisted prior explanations. Manual guidance is stored without a schema migration, remains available despite intervening periodic captures, and must diagnose the latest code/test failure while honoring the exact platform signature and output contract. The Response panel exposes the actual screenshot count/order. Remaining gate: real-provider VPS evaluation for accuracy, OCR uncertainty, latency, and cost. Deferred: semantic screenshot deduplication, model routing, automated execution of generated code, and durable image-object storage.

## Update - 2026-08-23 Capture Toolbar Tooltips And Screenshot Shortcut

Phase 3 Capture ergonomics now include explanatory hover tooltips and accessible labels for every floating-toolbar action. The screenshot camera remains visible and `CommandOrControl+E` globally invokes the existing manual screen-context flow while listening. Remaining gate: packaged Windows smoke for tooltip visibility, active/inactive session behavior, and accelerator conflicts. Deferred and unchanged: configurable shortcuts, multi-shortcut profiles, and any consent or capture-policy changes.

## Update - 2026-08-23 Response Realtime Runtime Configuration And GPT-5.6

Phase 3 now resolves the Response WebSocket endpoint from the server process at request time and reports actionable browser connection failures, eliminating dependence on a value compiled into the client bundle. The screen-context panel renders newest-first while preserving chronological model input. Capture exposes current GPT-5.6 quality/balance/efficiency options, and the provider adapter uses GPT-5-compatible completion controls. Remaining gate: redeploy with the VPS environment loaded, verify a live Response subscription, and run real-provider quality/latency/cost smoke. Deferred: automatic model capability discovery, provider-specific routing/fallback, and changing the persisted FIFO policy.
## Update - 2026-08-23 Code Practice Provider Reliability

Phase 3 now propagates the selected programming language into both Code Practice provider phases and merges browser-requested screenshots with the latest persisted/cache session context before applying the 30-image limit. Visual-analysis JSON parsing accepts common provider fencing and performs one bounded parse-failure retry with generation/phase diagnostics; answer generation keeps the larger token budget and never fabricates fallback guidance. Periodic captures remain scheduled every five seconds and no longer overlap while a prior capture is in flight. Remaining gate: deploy all affected runtimes and prove a real JavaScript screenshot/test-failure flow against the VPS, including context freshness, valid structured output, and acceptable latency. Deferred: automatic provider capability discovery, semantic image deduplication, parallel two-phase generation, and silent model fallback.
## Update - 2026-08-23 Screenshot Delivery Latency

Phase 3 now routes manual screenshot commands to the renderer that actually owns the active session, compresses native captures as JPEG quality 70, and fans validated realtime contexts out before database persistence completes. The five-second periodic cadence is unchanged and independent of the minute-based session timer. Remaining gate: packaged Windows-to-VPS smoke must measure Capture-to-Response `transportLatencyMs`, prove newest-first arrival under periodic plus manual capture, and verify code text remains readable. Deferred: durable object storage, adaptive image quality, configurable screenshot cadence, and enforcement of automatic session timeout.
## Update - 2026-08-23 Immediate Screenshot UI And Provider Recovery

Phase 3 now makes newly received screenshots visible immediately: `copilot.context` bypasses generation-result filters and the newest-first panel returns to its top whenever a new context arrives. OpenAI-compatible chat calls perform one bounded retry for transient network/408/429/5xx failures and log safe attempt diagnostics. Public Code Practice answers must include a complete fenced solution in the Capture-selected language; one repair call is allowed before an explicit invalid-response error. Remaining gate: deploy API and Response and measure shortcut/tick-to-browser latency plus real-provider retry and solution quality. Deferred: provider-error attribution per generation mode, adaptive screenshot deduplication/compression, and configurable retry policy.
## Update - 2026-08-23 Multi-Exercise Context Segmentation

Phase 3 Code Practice now segments screenshot history by exercise and grounds each answer in the newest identifiable challenge. Stale screenshots and guidance from earlier exercises remain available as chronology but cannot define the active contract, attempt, or tests. Exact public challenges may use a labeled standard-contract assumption when the newest capture is partial. Big-O explanations must be implementation-specific. Remaining gate: real-provider evaluation that switches challenges within one session and verifies title/signature/output isolation plus complete selected-language code.

## Update - 2026-08-23 Exclusive Assistant Modes And Async Screenshot Durability

Phase 3 now has one persisted active mode per user. Conversation exclusively owns microphone transcription and conversation artifacts; Code Practice exclusively owns coding visual tutoring; Exam Study exclusively owns didactic public-exam question solving. The backend enforces the selection instead of relying on UI state.

Screenshot fan-out and hot context now precede durability: Response can render and submit a new image to the model immediately, while image rows flush to PostgreSQL in two-second background batches with retry and shutdown flush. This also centralizes visual generation in Response and removes duplicate Ctrl+E/Auto provider calls. Remaining gates are packaged VPS smoke, multi-instance/shared-hot-state design, operation-specific provider-error attribution, transcription cooldown, and measured latency/cost budgets. Deferred: external question-bank search and web research; Exam Study currently solves questions visible in captured context.
