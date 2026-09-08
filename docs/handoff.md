# Handoff

## Current Status

- `current_phase`: MVP implementation closeout for `specs/001-persuando-mvp`.
- `current_focus`: the first end-to-end MVP slice is implemented and validated; recent runtime fixes focused on reliable periodic screen context startup, active-session reconciliation, safer Code Practice image-context tutoring quality, automatic screenshot-triggered Code Practice generation in Response Mode, Markdown/code-block rendering for longer teaching answers, VPS domain deployment, production subdomain Google OAuth bridge login, Electron-specific Google sign-in completion, default Code Practice programming-language fallback, and Windows Capture packaging scripts.
- `summary`: Persuando now has a NestJS API, Prisma-backed PostgreSQL persistence, Google/local-dev auth, encrypted provider credentials, consent grant/revoke, settings, retention/manual delete, workspace/session REST endpoints, native `/realtime` WebSocket fan-out, consent-gated microphone chunk ingestion, mock/OpenAI-compatible provider adapters, BullMQ worker boundaries, live Response Mode, and a Windows-first Electron Capture Mode scaffold with dashboard, settings, floating toolbar, tray menu, microphone upload, visible text/screen context, and code-practice guidance.

## Implemented Scope

- Backend: NestJS modules for config, auth, users, workspaces, sessions, consent, credentials, providers, realtime, jobs, retention, logging, audit, and health.
- Persistence: Prisma application data access with PostgreSQL schema mirrored by SQL migrations. Raw SQL is limited to migrations and the migration runner.
- Auth: Google OAuth smoke path plus local-dev fallback for tests and scripted local smoke. Production subdomain browser login redirects from the API callback to the Response App `/auth/complete` route through a short-lived one-time bridge code so `persuando.gfig.space` receives its own host-only session cookie. Electron Capture login calls `/auth/google?clientType=capture` and completes on the API callback page so Capture can read the API-host cookie instead of being sent into Response Mode.
- Credentials: user provider keys are encrypted on the backend, masked in responses, and decrypted only inside backend provider orchestration.
- Consent: microphone capture, transcription, backend transmission, external provider use, session retention, code copilot, and screen/coding context are explicit and revocable.
- Realtime: native WebSocket `/realtime` supports Capture and Response clients, subscribe/unsubscribe, ack/replay, session status, audio chunks, transcript, summary, insight, suggestion, provider error, retention delete, copilot context, and copilot explanation events.
- AI processing: local dev defaults to deterministic mock provider output. OpenAI-compatible transcription/generation adapters exist behind config.
- Jobs: BullMQ queues and worker handlers exist for provider credential validation, session assistance generation, and retention cleanup.
- Response App: Next.js App Router workspace/session pages show retained history, live updates, reconnect/ack/replay behavior, topic/direct-answer/follow-up/code-practice surfaces, provider errors, and manual delete.
- Capture App: Electron/Vite/React dashboard and floating toolbar support provider settings, models, languages, consent, microphone selection, start/pause/resume/end, timer/status, hide/show, tray menu actions, text context, user-requested screen context, periodic screen context, visible screenshot capture errors, and WebSocket upload.

## Latest Validation

-
pm.cmd run build` passed.
-
ode --test apps/api/test/realtime.test.mjs` passed with 20 realtime tests, including the fallback that stores missing/blank Copilot programming language as `javascript` instead of rejecting screen context during capture.
-
ode --test apps/api/test/auth.test.mjs` passed with 6 auth tests, including single-use login bridge coverage and API-local Capture auth completion coverage.
-
pm.cmd run --workspace @persuando/response build` passed and includes the dynamic `/auth/complete` route.
-
pm.cmd run capture:pack:win` passed and generated `release/capture/win-unpacked/Persuando Capture.exe`.
-
pm.cmd run capture:dist:win` passed and generated `release/capture/Persuando-Capture-Setup-0.1.0.exe`.
-
pm.cmd run typecheck` passed.
-
pm.cmd run lint` passed.
-
pm.cmd run format` passed.
-
pm.cmd run test` passed with 108 passing tests, including provider coverage that Code Practice requests Markdown, detected-language snippets, fenced code blocks, and a JavaScript fallback when the language is unclear.
- Local Docker-backed API smoke passed against `http://localhost:4000/health`.
- Local integrated WebSocket smoke passed: create workspace/session, grant consent, start capture, upload audio chunk, receive `transcript.segment`, `summary.updated`, `insight.created`, `suggestion.created`, send `copilot.context`, receive `copilot.explanation`, and manually delete the session.
- Degraded realtime smoke passed: invalid realtime persistence input returns the safe client message `Realtime request failed` instead of leaking Prisma internals.
- Regression validation passed: creating a new Capture session ends older open sessions; workspace listing now also reconciles abandoned open sessions older than two hours; periodic screenshot diagnostics show whether the setting and screen/code consents are enabled before capture starts.
- Capture periodic screen context diagnostics now log the start settings, renderer timer, Electron screenshot bridge, WebSocket `copilot.context` send, backend access/consent/persist/fan-out, and Response realtime apply path so failures can be isolated by stage. Code Practice provider prompting now asks for concrete programming coaching with problem restatement, detected programming language, child-friendly intuition, technique, code-backed step-by-step guidance, Big-O, edge cases, Markdown headings/lists, fenced code blocks, and pseudocode/code only when allowed for study/practice/review. The OpenAI-compatible adapter now requests a larger Code Practice token budget, preserves genuine provider output and reports malformed or empty provider responses as explicit errors without fabricated guidance, and Response Mode can auto-request Code Practice when new screen contexts arrive while that panel is in Auto mode. Response Mode now renders Code Practice output as safe Markdown subsets with semantic headings, lists, inline code, and scrollable code blocks instead of one flat paragraph.
- Capture and backend Copilot context handling now default a blank or missing programming language to `javascript`; the Capture start/send logs and backend receive logs include the normalized language so this failure can be diagnosed quickly.

## How To Run Locally

1. Start Postgres and Redis:
   `docker compose up -d`
2. Start the API:

pm.cmd run dev:api`
3. Start the worker in another terminal:

pm.cmd run dev:worker`
4. Start Response Mode in another terminal:

pm.cmd run dev:response`
   Then open `http://localhost:3100`.
5. Start the Capture App dev UI or packaged Electron flow:

pm.cmd run dev:capture`
   or

pm.cmd run --workspace @persuando/capture start`

## Known Issues And Follow-Up

- If periodic screenshots do not start, check the Capture debug log first. periodicScreenshotCaptureDefault=false means the feature toggle is off even if consent grants exist; enable Periodic screen context default before starting capture again.
- The Capture UI is functional but visually minimal; a follow-up UI polish/spec should refine layout, density, keyboard shortcuts, and tray ergonomics.
- Screen context currently sends an in-memory data URL through the realtime event and keeps only the latest 30 screen contexts in the Response UI. A production hardening spec should add backend image size limits, redaction, storage policy, deletion behavior, and an explicit study/practice confirmation before richer code-solution output.
- Windows Capture can now be run against the VPS with
pm.cmd run capture:start:vps`, packaged as `release/capture/win-unpacked/Persuando Capture.exe`, or built as `release/capture/Persuando-Capture-Setup-0.1.0.exe`. Production distribution still needs app icon, publisher/signing decisions, update strategy, and release-channel policy.
- If local Capture points to the VPS API, backend fixes like the Copilot programming-language fallback must be deployed and PM2 services restarted on the VPS before local Electron smoke testing.
- The login bridge code is currently in API process memory. This is fine for the current single PM2 API process, but must move to Redis/PostgreSQL before clustering or running multiple API instances. Browser and Capture OAuth entry points must remain separate: browser login uses `/auth/google`; Capture uses `/auth/google?clientType=capture`.
- The local integrated smoke uses the mock provider by default. Real OpenAI-compatible provider validation should be tested after setting `PROVIDER_ADAPTER=openai-compatible` and a valid user key.
- Robust system-audio capture, automatic app/site detection, hidden capture, proctoring/focus evasion, local/offline models, and non-Windows desktop targets remain out of scope.

## Recommended Next Spec Kit Step

Run `/speckit-specify` for the next focused feature. Recommended prompt: use `docs/next-spec-prompt.md` to specify the Windows packaged Capture App, UI polish, and production hardening slice, including toolbar/tray polish, installer/dev distribution, visible permission education, production auth bridge hardening, screen context hardening, and manual end-to-end browser/Electron smoke.

## Implementation Update - 2026-08-22 Screenshot Debug Trace

- Current status: periodic screenshot flow was corrected and instrumented end to end for Capture renderer, Electron preload/main, realtime `copilot.context`, API ingest/persist/publish, and Response apply.
- Recent change: aligned runtime `apps/capture/preload.cjs` with `apps/capture/src/preload.ts` by exposing `startPeriodicScreenContext` and `stopPeriodicScreenContext`; added optional `debugId` to `CopilotContextEvent` and propagated `manual-<timestamp>-<random>` / `periodic-<timestamp>-<random>` through screenshot capture and realtime logs.
- Latest validation: `npm.cmd run build` passed (`tsc -b`).
- Remaining work: manual VPS smoke still needs to confirm a single `[screen:<debugId>]` appears from Capture through API logs and Response console while screenshots render in Screen context.
- Recommended next Spec Kit step: keep the next `/speckit-specify` focused on production hardening, including durable screenshot storage/limits, visual-context retention/deletion behavior, and an explicit manual Electron-to-VPS smoke checklist for debug trace IDs.

## Implementation Update - 2026-08-23 Code Practice Visual Grounding

- Current status: Code Practice manual generation now uses current visual context end to end and never substitutes hardcoded Tree Height guidance for provider failures.
- Decision: retain, display, persist, hydrate, validate, and send at most 30 screenshots in FIFO order. The latest screenshots are authoritative when older screenshots conflict. The OpenAI-compatible adapter either returns the provider content or raises `PROVIDER_RESPONSE_INVALID` for malformed/empty output.
- Observability: generation logs include session, task/mode, model, context source, screenshot count, image count, response content length, duration, completion, and safe failure code. Secrets and image data are not logged.
- Validation: `npm.cmd run build` passed; `npm.cmd run test` passed 114/114; `npm.cmd run typecheck` passed; `npm.cmd run lint` passed. `npm.cmd run format` remains blocked only by the pre-existing generated file `release/capture/win-unpacked/vk_swiftshader_icd.json` missing a final newline.
- Remaining work: deploy API and Response together, then run a real-provider Electron-to-VPS smoke with a new session. Screenshots persisted before this fix may have lost their image bytes and cannot be reconstructed. Monitor cost, payload size, and latency when sending 30 full-screen data URLs.
- Recommended next Spec Kit step: specify production visual-context storage and model-input selection, including compression/deduplication, durable deletion, latency/cost budgets, and real-provider quality assertions tied to the visible problem statement.

## Implementation Update - 2026-08-23 Incremental Code Practice Tutoring

- Current status: real Code Practice generation now uses two provider phases. `visual_analysis` reads all current screenshots oldest-to-newest into structured facts; `answer` uses those facts plus recent session guidance to diagnose the student's latest attempt.
- Decision: persist each manual explanation in the existing `CodeCopilotContext.generatedGuidance` column and send the last four completed explanations, oldest-to-newest, as fallible history. No schema migration or secret change was required.
- Quality rules: verify exact function signature, provided fields/types, method-only scaffolding, print-versus-return behavior, separators/newlines, current code, visible expected/actual results, and prior advice before producing an updated solution. The newest visual evidence is authoritative.
- UI/observability: Screen context now displays `N/30 oldest to newest` and marks the newest screenshot. Provider logs distinguish `phase=visual_analysis` and `phase=answer`, with image count, previous-guidance count, content length, and duration.
- Validation: `npm.cmd run build` passed; `npm.cmd run test` passed 115/115; focused provider/realtime/Response tests passed 37/37; `npm.cmd run typecheck` passed. The regression confirms previous guidance survives fifteen intervening periodic screenshots.
- Remaining work: deploy API and Response together and run a real-provider smoke with a new session containing the statement, method signature, one wrong attempt, and its failed test result. Two sequential calls intentionally trade additional latency/cost for grounding quality; production evaluation should measure both phases.
- Recommended next Spec Kit step: specify a real-provider visual-tutoring evaluation suite with fixtures for exact platform contracts, iterative failed attempts, OCR uncertainty, context deduplication, latency, and token/image cost budgets.

## Implementation Update - 2026-08-23 Capture Toolbar Tooltips And Screenshot Shortcut

- Current status: every floating-toolbar action exposes an explanatory native tooltip and accessible label, including disabled actions.
- Decision: keep the camera action permanently visible and register `CommandOrControl+E` in Electron. It dispatches the existing `capture-context` command only while a session is listening; otherwise it reveals the toolbar and logs the ignored request.
- Lifecycle: the shortcut is registered after the Capture windows are created and all global shortcuts are unregistered during `will-quit`.
- Validation: the focused Capture test passed 6/6; the Capture production bundle passed; `npm.cmd run build` passed; `npm.cmd run test` passed 116/116; and `npm.cmd run lint` passed.
- Remaining work: manually confirm native tooltip timing and global shortcut behavior in packaged Windows Electron, including shortcut-registration conflicts with other applications.
- Recommended next Spec Kit step: keep the existing visual-context production-hardening spec as the next major slice; include packaged-toolbar accelerator conflict and discoverability checks in its Electron smoke criteria.

## Implementation Update - 2026-08-23 Response Realtime And Model Selection

- Current status: Response session pages receive the WebSocket endpoint from server runtime configuration, expose the actual endpoint when connection/retry fails, and keep generation disabled until the subscription is live.
- Decision: render the 30-item screen-context window newest-to-oldest for usability while retaining and sending it oldest-to-newest for chronological model grounding. Capture model choices now include `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`; GPT-5 requests use `max_completion_tokens` and omit legacy temperature controls.
- Latest validation: `npm.cmd run build` passed; `npm.cmd run test` passed 119/119; `npm.cmd run lint` passed; the focused provider/Capture/Response tests passed 23/23; and the Response production build passed.
- Remaining work: redeploy API, Response, and Capture artifacts; load `.env.local` before the Next build and PM2 restart; then confirm browser console reports `Realtime socket opened` and perform a real-provider generation with the selected GPT-5.6 model.
- Recommended next Spec Kit step: keep visual-context production hardening next, adding model capability/routing validation, latency and cost budgets for the two-call visual flow, and deployment checks that prove the runtime WebSocket endpoint is not localhost.
## Implementation Update - 2026-08-23 Code Practice Provider Reliability

- Current status: manual Code Practice generation now merges requested Response contexts with the latest persisted/cache session history before selecting the newest 30 screenshots, so a recently received shortcut capture is not discarded merely because the browser list is behind.
- Decision: the Capture programming language is an explicit selection and is authoritative in both visual-analysis and answer prompts. Visual JSON accepts strict, fenced, or embedded objects and retries once only when parsing fails; HTTP, auth, quota, and network failures remain visible and are never replaced with fabricated tutoring.
- Observability: each manual generation has a `generationId`; request/response logs include phase, attempt, model, language, HTTP status, finish reason, content length, duration, context source, and safe error code without logging prompts, images, or credentials.
- Validation: `npm.cmd run build` passed; focused provider/realtime/Capture/Response tests passed 49/49; `npm.cmd run test` passed 122/122; and `npm.cmd run lint` passed.
- Remaining work: deploy API, Response, and the rebuilt Capture app, then run a real-provider VPS smoke that captures a JavaScript editor/test failure and correlates one generation ID through `visual_analysis` and `answer`. Measure the two-call latency with the selected production model.
- Recommended next Spec Kit step: specify provider capability validation, structured-output reliability, bounded retry policy, context freshness guarantees, and fixture-based visual tutoring quality checks.
## Implementation Update - 2026-08-23 Screenshot Delivery Latency

- Current status: the five-second periodic interval remains unchanged, while manual `Ctrl+E` and tray captures are now broadcast to both Electron renderers so the renderer that owns the active capture session responds immediately.
- Decision: native 1440x900 screenshots use JPEG quality 70 instead of PNG, and API realtime fan-out occurs after access/consent validation but before the large image payload finishes persisting to PostgreSQL. Response logs `transportLatencyMs` from Capture event creation to browser receipt.
- Settings clarification: `sessionTimerMinutes=30` means a 30-minute session setting and does not control screenshot cadence. It is currently persisted but not yet enforced as automatic session termination.
- Validation: `npm.cmd run build` passed; focused Capture/API/Response tests passed 36/36; `npm.cmd run test` passed 123/123; the Capture production bundle passed; and `npm.cmd run lint` passed.
- Remaining work: deploy API and Response, rebuild/restart the Windows Capture artifact, then correlate `[screen:<debugId>]` and `transportLatencyMs` during a new session. Confirm JPEG OCR quality on small editor text.
- Recommended next Spec Kit step: preserve the provider-reliability prompt and add measurable Capture-to-Response latency, payload-size, persistence-failure, and screenshot readability acceptance criteria.
## Implementation Update - 2026-08-23 Immediate Screenshot UI And Provider Recovery

- Current status: Response accepts every `copilot.context` event independently of generation panel modes and automatically returns the screen-context scroller to the newest item as soon as state is applied.
- Recent decision: OpenAI-compatible chat requests retry one transient network, 408, 429, or 5xx failure with a 500 ms delay. Logs expose attempt count, retry decision, HTTP status, and safe network cause code.
- Code Practice quality: the Capture-selected language now overrides unknown/conflicting visual inference. Public practice output must contain a non-empty fenced solution in that language; one answer-repair attempt is allowed, then the API returns `PROVIDER_RESPONSE_INVALID` rather than presenting an incomplete answer.
- Latest validation: `npm.cmd run build` passed; `npm.cmd run test` passed 125/125, including the explicit transient-recovery regression; `npm.cmd run lint` passed; and the Response production build passed.
- Remaining work: deploy API and Response, rebuild/restart Capture locally, and perform a real-provider VPS smoke. Correlate `[screen:<debugId>]`, `transportLatencyMs`, `generationId`, provider phase, and retry attempt.
- Recommended next Spec Kit step: specify measurable screenshot delivery latency and provider reliability/quality evaluation, including payload limits, OCR quality, error attribution by generation mode, and bounded retry budgets.
## Implementation Update - 2026-08-23 Multi-Exercise Context Segmentation

- Current status: visual analysis groups screenshots by exercise and selects the newest identifiable challenge as active. Screenshots and previous guidance from another title, URL, signature, or behavior are excluded from the active contract and attempt.
- Decision: an exact public practice challenge may use its established standard contract when the latest screenshot is partial, with assumptions labeled. The tutor must not withhold the selected-language solution solely because the final screenshot omits the stub.
- Explanation quality: Big-O must define the actual input variables and connect the final bound to the implementation's traversals, loops, recursion depth, and data structures rather than reciting a generic definition.
- Validation: `npm.cmd run test` passed 125/125, including prompt contract assertions; the prior full build, lint, and Response production build remain green.
- Remaining work: deploy API and Response, then test two different HackerRank exercises in one session and verify the second answer ignores stale first-exercise code while still using recent screenshots from the second.
- Recommended next Spec Kit step: add multi-exercise visual fixtures and measurable active-problem classification accuracy to the provider reliability evaluation.

## Implementation Update - 2026-08-23 Exclusive Modes And Hot Screenshot Persistence

- Current status: users can select exactly one persisted assistant mode: Conversation, Code Practice, or Exam Study. The API rejects generation from inactive modes.
- Recent decision: Conversation alone captures/transcribes microphone audio. Code Practice and Exam Study use screenshots; Exam Study identifies the newest active public-exam question, subject/topic, alternatives, and teaches the solution step by step in simple language.
- Realtime/persistence: validated image contexts fan out and enter API hot state immediately. Response sends its current 30-image state with visual generation requests. Image rows persist from a two-second background queue with retry and shutdown flush, so PostgreSQL is no longer on the screenshot display/model-context critical path.
- Rate-limit effect: screenshot ingest no longer performs direct image generation. Response owns visual generation, removing the former Ctrl+E plus Auto duplicate request.
- Latest validation: `npm.cmd run build` passed; `npm.cmd run test` passed 125/125 after migration, mode-routing, hot-state, and asynchronous-persistence test updates.
- Remaining work: run packaged Electron-to-VPS smoke for all three modes; measure screenshot transport latency and provider latency; add operation-specific provider-error UI attribution and a transcription 429 cooldown.
- Deployment: apply migration `0003_user_settings_assistant_mode.sql` through the normal API migration runner, then restart API, worker, and Response with their existing environment.

## Implementation Update - 2026-08-23 Visual Mode Audio Isolation

- Fixed Capture startup in Code Practice and Exam Study: visual-only sessions no longer pass an empty `MediaStream` to `AudioContext.createMediaStreamSource`.
- The audio meter now starts only when Conversation mode actually enables microphone capture, with an additional missing-audio-track guard.
- Validation: Capture tests passed 10/10, the Capture production build passed, `npm.cmd run build` passed, the full suite passed 126/126, and lint passed. No API contract, database migration, secret, or deployment environment changed. Rebuild the Windows Capture artifact before testing this fix.

## Implementation Update - 2026-08-25 Code Practice Exercise And Repository Workflows

- Current status: Code Practice now supports explicit `exercise` and `repository` workflows from Response Mode through WebSocket contracts, realtime orchestration, provider prompts, persisted guidance metadata, and Copilot explanation events.
- Decision: keep `exercise` as the backward-compatible default. Repository mode is additive, prompt-level behavior for visible repository/debugging context; it uses bounded incremental history and does not claim repository search beyond screenshots or visible text. No database migration or secret change was required.
- UI/behavior: Response Mode stores the workflow selection per session in browser local storage, sends it with manual/Auto Code Practice generation, prevents duplicate in-flight requests, renders safe Markdown with `highlight.js` syntax highlighting, and lets users focus/collapse session panels with accessible header controls and `Escape`.
- Observability: API/provider logs include `workflow`, `incrementalHistory`, `generationId`, image counts, phase, model, language, and `repositorySearch=false` without logging images, prompts, provider keys, or secrets.
- Validation: `npm.cmd run build` passed; `node --test packages/contracts/test/contracts.test.mjs apps/api/test/providers.test.mjs apps/api/test/realtime.test.mjs apps/response/test/response-ui.test.mjs` passed; `npm.cmd run test` passed 133/133; `npm.cmd run --workspace @persuando/response build` passed.
- Remaining work: run packaged Electron-to-VPS real-provider smoke in both workflows, measure repository-mode latency/cost, and decide whether workflow preference should become server-persisted rather than browser-local per session.
- Recommended next Spec Kit step: specify repository-mode evaluation and production hardening with fixtures for visible editor/test/diff evidence, stale-context rejection, no invented files/commands, workflow persistence, payload budgets, and real-provider smoke.

## Implementation Update - 2026-08-30 Code Practice Interview-Style Workflows

- Current status: Code Practice now supports three explicit study workflows: `exercise` for code problems, `repository` for visible repository/debugging work, and `design_system` for component/design-system work.
- Recent decision: all workflows are framed as simulated technical-assessment preparation for study. The provider prompts now require interview-style walkthroughs, including what to explain aloud, why the chosen approach was selected, step-by-step construction, corrected false-start pitfalls, and clean complete final code or patch sections when evidence is sufficient.
- Behavior: `exercise` remains the backward-compatible default. `design_system` is additive in the WebSocket contract, realtime validation, Response selector, provider prompt routing, persisted guidance metadata, logs, and tests. Repository/design-system workflows receive bounded incremental history.
- Latest validation: `npm.cmd run build` passed; focused `node --test packages/contracts/test/contracts.test.mjs apps/api/test/providers.test.mjs apps/api/test/realtime.test.mjs apps/response/test/response-ui.test.mjs` passed 56/56 after rebuild.
- Remaining work: run full test suite and Response production build after this closeout; perform real-provider Electron-to-VPS smoke for Code Problem, Repository, and Design System; decide whether workflow preference should be server-persisted across devices.
- Recommended next Spec Kit step: specify evaluation fixtures for interview-style Code Practice answers, including complete final code, step-by-step commentary, corrected pitfalls, design-system accessibility/token checks, stale-context rejection, and no invented repository/design evidence.

## Implementation Update - 2026-08-31 Code Practice Conversational Interview Script

- Current status: Code Practice code-problem output now emphasizes a speakable simulated-interview script. The answer starts with what the student understood and the goal, shows the complete solved code near the beginning, then walks through the solution conversationally instead of as disconnected topic notes.
- Decision: `Fala para entrevista` blockquotes are the most visually prominent reading path. Each construction step should include the current doubt, the next coding move, and the reason for that move. Google guidance is limited to short search terms suitable for interview preparation or allowed clarification.
- UI/quality: Response Markdown now styles blockquotes so the spoken lines stand out while keeping fenced code blocks and existing safe Markdown rendering. The provider repair prompt also requires the new conversational anchors when a selected-language solution is missing.
- Validation: `npm.cmd run build` passed; focused `node --test apps/api/test/providers.test.mjs apps/response/test/response-ui.test.mjs` passed 25/25; `npm.cmd run test` passed 134/134; `npm.cmd run --workspace @persuando/response build` passed.
- Remaining work: run real-provider Electron-to-VPS smoke for Code Problem, Repository, and Design System, checking whether the generated Portuguese script is easy to read aloud while coding and whether the Google search terms remain concise.
- Recommended next Spec Kit step: specify evaluation fixtures for conversational Code Practice answers, including visible `Fala para entrevista` prominence, current-doubt progression, final-code placement, corrected false starts, and concise interview-appropriate search terms.

## Implementation Update - 2026-09-06 Independent Interview Practice And History

- Current status: Response has independent Code Practice and System Design panels. Matching requests are deduplicated per mode, but the two modes can generate concurrently. Each has Manual/Auto behavior and restores retained output into the correct panel.
- Code Practice quality: the provider now requires a child-simple interpretation, expected input/output, three to five clarifying questions, explicit assumptions, a complete optimal reference, a complete minimum solution, and structured incremental steps. Each step contains a coherent code unit, a matching example test that it passes, expected result, rationale, and `Fala para entrevista`. Big-O is connected to concrete code operations; the final checklist was removed.
- Incremental behavior: visual analysis records problem, attempt, and stage fingerprints. Unchanged relevant facts emit `generation.completed` without repeated guidance. A minimum solution advances toward optimization, an optimal solution closes the exercise, and a new problem fingerprint restarts it.
- System Design quality: a dedicated prompt requires clarifying questions, assumptions, minimum architecture, staged evolution with interview speech, trade-offs, operational concerns, and at least one valid fenced Mermaid diagram. Response renders Mermaid lazily with strict security and a source fallback.
- Simulation boundary: Capture now requires `simulation_only_use` acceptance. The selected application mode is authoritative; company/platform branding, timers, and realistic test UI are simulation scenery, while screenshot text remains untrusted evidence. The former prompt downgrade to concepts/pseudocode based on screenshot appearance was removed.
- Persistence/contracts: both modes use the existing `code_copilot_contexts` table and safe `generatedGuidance` session-history contract. Stored metadata distinguishes mode, response language, workflow, structured practice steps, and private visual analysis. No schema migration is required; existing retention and manual deletion apply.
- UI: the live session exposes Portuguese/English model-response selection. Code/test pairs are side by side on wide screens and stacked responsively.
- Validation: `npm.cmd run typecheck` passed; `npm.cmd run lint` passed; `npm.cmd run test` passed 141/141 including the production TypeScript build and the new incremental/optimal-stage provider cases; `npm.cmd run --workspace @persuando/response build` passed; and `npm.cmd run --workspace @persuando/capture build` passed. `npm.cmd run format` still stops on the pre-existing packaged artifact `release/capture/win-unpacked/vk_swiftshader_icd.json` because it has no final newline; this change did not modify that release file.
- Remaining work: perform a real-provider packaged Electron-to-VPS smoke in both languages, score Code Practice and System Design output fixtures, and attribute concurrent provider errors to their originating panel instead of the current shared error surface.
- Recommended next Spec Kit step: specify real-provider evaluation and concurrent-mode reliability for retained interview-practice guidance.

## Implementation Update - 2026-09-06 Customizable Response Layout

- Current status: the live Response page now exposes `Edit layout`, `Done arranging`, and `Reset layout`. Every visible card participates in one sortable grid and can be repositioned through a dedicated drag handle or explicit earlier/later buttons.
- Accessibility and interaction: sorting supports pointer, touch, and keyboard sensors; drag activation has a small movement threshold; controls use 44 px touch targets, movement is announced through an ARIA live region, and `Escape` exits editing.
- Persistence decision: card order is normalized and stored in versioned browser local storage per assistant mode. It follows the user across sessions in the same browser but does not sync across devices. Newly introduced cards are appended automatically and stale/duplicate keys are discarded.
- Architecture impact: the feature composes the existing Response panels in a sortable client wrapper and adds `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`. It changes no REST/WebSocket contract, database schema, retained guidance, consent, or deletion behavior.
- Validation: `npm.cmd run --workspace @persuando/response typecheck` passed; `node --test apps/response/test/response-ui.test.mjs` passed 14/14; `npm.cmd run --workspace @persuando/response build` passed; `npm.cmd run lint` passed; the full `npm.cmd run test` passed 144/144; and `git diff --check` passed. `npm.cmd run format` still stops only on the pre-existing packaged artifact `release/capture/win-unpacked/vk_swiftshader_icd.json` because it has no final newline; this implementation did not modify that file.
- Remaining work: manual responsive/browser smoke for pointer dragging and keyboard sorting; optional future cross-device preference sync, card visibility, custom card sizing, undo, and multi-column placement controls.
- Recommended next Spec Kit step: specify durable cross-device Response workspace personalization while preserving the current migration-free local fallback.

## Implementation Update - 2026-09-07 System Design Concept Reference

- Current status: the System Design panel now places a `Guia rápido de conceitos` action before generated explanations. It opens a responsive native dialog backed by `apps/response/public/system-design-reference.md` and reuses the safe Markdown renderer.
- Content: the reference explains load balancers, vertical/horizontal scaling, cache, CDN, SQL/NoSQL, sharding, consistent hashing, resharding, replication, indexes, queues/event streams, rate limiting, CAP/consistency, and object storage. Every concept includes usage guidance, labeled benefits, labeled risks/costs, and an example of what to say in an interview.
- Visual/accessibility decision: concept names are blue, positive points are green with check labels, and negative trade-offs are red with warning labels. The design does not depend on color alone. The native dialog provides modal focus behavior and `Escape` closing; the trigger has dialog relationships, the close control has an accessible name, and loading/error/retry states are explicit.
- Architecture impact: content is a static public Markdown asset fetched only when opened with browser caching. No REST/WebSocket contract, provider prompt, session data, schema, retention rule, or backend service changed.
- Validation: `npm.cmd run --workspace @persuando/response typecheck` passed; `node --test apps/response/test/response-ui.test.mjs` passed 16/16; `npm.cmd run --workspace @persuando/response build` passed; `npm.cmd run lint` passed; the full `npm.cmd run test` passed 146/146; and `git diff --check` passed. `npm.cmd run format` remains blocked only by the pre-existing packaged artifact `release/capture/win-unpacked/vk_swiftshader_icd.json`, which is missing a final newline and was not modified by this implementation.
- Remaining work: manual responsive browser smoke for mouse, keyboard focus return, `Escape`, backdrop close, scroll, and contrast; future content search, table of contents, language selection, and product-owned editorial review are deferred.
- Recommended next Spec Kit step: specify a curated multilingual System Design learning reference with search/navigation and measurable content-quality governance.

## Implementation Update - 2026-09-07 System Design Diagram Legend

- Current status: the first Mermaid architecture diagram in every new System Design answer must be followed immediately by `## Legenda do diagrama` in Portuguese or `## Diagram legend` in English. The legend uses non-empty Markdown bullets that repeat important visible component/connection labels and explain responsibilities plus incoming/outgoing request or data flow.
- Presentation decision: Response extracts this adjacent pair and renders the strict Mermaid diagram and its safe-Markdown legend side by side as one labeled artifact. The responsive auto-fit grid stacks both columns on narrow screens. Historical or malformed answers without the exact structure retain the ordinary Markdown/Mermaid rendering instead of losing content.
- Provider decision: System Design output validation now treats the diagram and legend as one required teaching artifact. The first diagram must own the immediately following legend; a missing or displaced legend invokes the existing one-time provider repair and then a safe invalid-response error if repair still fails.
- Architecture impact: the structured pair remains inside the already persisted Markdown answer. No REST/WebSocket contract, database schema, migration, retention rule, or generation-concurrency behavior changed.
- Validation: `npm.cmd run build` passed; focused provider tests passed 22/22; Response typecheck passed; focused Response tests passed 17/17; `npm.cmd run --workspace @persuando/response build` passed; `npm.cmd run lint` passed; the full `npm.cmd run test` passed 148/148; and `git diff --check` passed. `npm.cmd run format` still reports only the pre-existing packaged artifact `release/capture/win-unpacked/vk_swiftshader_icd.json`, which has no final newline and was not modified by this implementation.
- Remaining work: manually smoke the paired artifact with real Portuguese and English provider responses at desktop and narrow widths, including Mermaid render failure and a retained legacy answer. Semantic agreement between arbitrary diagram nodes/arrows and prose is prompt-governed; the current validator guarantees structure and non-empty bullets, not complete graph-level equivalence.
- Recommended next Spec Kit step: specify measurable semantic-quality evaluation for System Design Mermaid diagrams and their legends, including graph/prose agreement fixtures and accessible responsive visual acceptance criteria.

## Implementation Update - 2026-09-07 Ordered System Design Decision Cycle

- Current status: System Design now begins with three to five grouped clarification questions that collectively scope nine concerns in order, then constructs the answer through fixed numbered sections for Requirements, Access patterns, horizontal/vertical Scale, Data, High-level design, Bottlenecks, Consistency, Failures, and Trade-offs. Every stage contains its own ordered Problem, Solution, Trade-off, and interview-speech elements.
- Diagram decision: an assumption-based `Diagrama inicial`/`Initial diagram` appears before stage 1 and an evolved `Diagrama final`/`Final diagram` appears after stage 9. Every Mermaid block must still own an immediately adjacent non-empty legend, and Response recursively renders both diagram/legend pairs side by side with narrow-screen stacking.
- Simulation boundary: both visual-analysis and answer prompts keep application-selected simulation state authoritative and now explicitly name Microsoft, Amazon, and any other recognizable branding as high-fidelity simulation scenery that must not cause a live-interview inference or restricted answer.
- Validation/repair: the provider validator checks the two diagrams, every adjacent legend, ordered stage boundaries, and the Problem -> Solution -> Trade-off -> interview-speech sequence inside each individual stage. One malformed answer receives the existing bounded repair attempt.
- Architecture and deployment impact: visual-analysis fields remain private serialized metadata and the complete answer remains persisted Markdown in the existing `code_copilot_contexts` flow. No public REST/WebSocket contract, database schema, migration, retention rule, secret, or deployment environment changed. VPS deployment requires rebuilding/restarting API and Response, but no migration command.
- Validation: `npm.cmd run build` passed; focused provider tests passed 23/23; Response typecheck passed; focused Response tests passed 17/17; `npm.cmd run --workspace @persuando/response build` passed; `npm.cmd run lint` passed; the full `npm.cmd run test` passed 149/149; and `git diff --check` passed. `npm.cmd run format` continues to report only the pre-existing packaged artifact `release/capture/win-unpacked/vk_swiftshader_icd.json`, which has no final newline and was not modified by this implementation.
- Remaining work: run a real-provider Portuguese/English smoke for vague and detailed prompts, confirm the initial diagram evolves materially into the final one, and score whether grouped questions genuinely cover all nine areas without becoming repetitive.
- Recommended next Spec Kit step: specify measurable staged System Design quality evaluation and optional in-card navigation/progress affordances for the nine-section answer.

