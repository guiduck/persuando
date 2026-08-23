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
