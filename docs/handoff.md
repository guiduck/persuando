# Handoff

## Current Status

- `current_phase`: MVP implementation closeout for `specs/001-persuando-mvp`.
- `current_focus`: the first end-to-end MVP slice is implemented and validated; recent runtime fixes focused on reliable periodic screen context startup, active-session reconciliation, safer Code Practice image-context tutoring quality, automatic screenshot-triggered Code Practice generation in Response Mode, Markdown/code-block rendering for longer teaching answers, VPS domain deployment, production subdomain Google OAuth bridge login, and Windows Capture packaging scripts.
- `summary`: Persuando now has a NestJS API, Prisma-backed PostgreSQL persistence, Google/local-dev auth, encrypted provider credentials, consent grant/revoke, settings, retention/manual delete, workspace/session REST endpoints, native `/realtime` WebSocket fan-out, consent-gated microphone chunk ingestion, mock/OpenAI-compatible provider adapters, BullMQ worker boundaries, live Response Mode, and a Windows-first Electron Capture Mode scaffold with dashboard, settings, floating toolbar, tray menu, microphone upload, visible text/screen context, and code-practice guidance.

## Implemented Scope

- Backend: NestJS modules for config, auth, users, workspaces, sessions, consent, credentials, providers, realtime, jobs, retention, logging, audit, and health.
- Persistence: Prisma application data access with PostgreSQL schema mirrored by SQL migrations. Raw SQL is limited to migrations and the migration runner.
- Auth: Google OAuth smoke path plus local-dev fallback for tests and scripted local smoke. Production subdomain login now redirects from the API callback to the Response App `/auth/complete` route through a short-lived one-time bridge code so `persuando.gfig.space` receives its own host-only session cookie.
- Credentials: user provider keys are encrypted on the backend, masked in responses, and decrypted only inside backend provider orchestration.
- Consent: microphone capture, transcription, backend transmission, external provider use, session retention, code copilot, and screen/coding context are explicit and revocable.
- Realtime: native WebSocket `/realtime` supports Capture and Response clients, subscribe/unsubscribe, ack/replay, session status, audio chunks, transcript, summary, insight, suggestion, provider error, retention delete, copilot context, and copilot explanation events.
- AI processing: local dev defaults to deterministic mock provider output. OpenAI-compatible transcription/generation adapters exist behind config.
- Jobs: BullMQ queues and worker handlers exist for provider credential validation, session assistance generation, and retention cleanup.
- Response App: Next.js App Router workspace/session pages show retained history, live updates, reconnect/ack/replay behavior, topic/direct-answer/follow-up/code-practice surfaces, provider errors, and manual delete.
- Capture App: Electron/Vite/React dashboard and floating toolbar support provider settings, models, languages, consent, microphone selection, start/pause/resume/end, timer/status, hide/show, tray menu actions, text context, user-requested screen context, periodic screen context, visible screenshot capture errors, and WebSocket upload.

## Latest Validation

- `npm.cmd run build` passed.
- `node --test apps/api/test/auth.test.mjs` passed with 5 auth tests, including single-use login bridge coverage.
- `npm.cmd run --workspace @persuando/response build` passed and includes the dynamic `/auth/complete` route.
- `npm.cmd run capture:pack:win` passed and generated `release/capture/win-unpacked/Persuando Capture.exe`.
- `npm.cmd run capture:dist:win` passed and generated `release/capture/Persuando-Capture-Setup-0.1.0.exe`.
- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run format` passed.
- `npm.cmd run test` passed with 108 passing tests, including provider coverage that Code Practice requests Markdown, detected-language snippets, fenced code blocks, and a JavaScript fallback when the language is unclear.
- Local Docker-backed API smoke passed against `http://localhost:4000/health`.
- Local integrated WebSocket smoke passed: create workspace/session, grant consent, start capture, upload audio chunk, receive `transcript.segment`, `summary.updated`, `insight.created`, `suggestion.created`, send `copilot.context`, receive `copilot.explanation`, and manually delete the session.
- Degraded realtime smoke passed: invalid realtime persistence input returns the safe client message `Realtime request failed` instead of leaking Prisma internals.
- Regression validation passed: creating a new Capture session ends older open sessions; workspace listing now also reconciles abandoned open sessions older than two hours; periodic screenshot diagnostics show whether the setting and screen/code consents are enabled before capture starts.
- Capture periodic screen context diagnostics now log the start settings, renderer timer, Electron screenshot bridge, WebSocket `copilot.context` send, backend access/consent/persist/fan-out, and Response realtime apply path so failures can be isolated by stage. Code Practice provider prompting now asks for concrete programming coaching with problem restatement, detected programming language, child-friendly intuition, technique, code-backed step-by-step guidance, Big-O, edge cases, Markdown headings/lists, fenced code blocks, and pseudocode/code only when allowed for study/practice/review. The OpenAI-compatible adapter now requests a larger Code Practice token budget, rejects too-short or code-free Code Practice outputs with a structured JavaScript fallback, and Response Mode can auto-request Code Practice when new screen contexts arrive while that panel is in Auto mode. Response Mode now renders Code Practice output as safe Markdown subsets with semantic headings, lists, inline code, and scrollable code blocks instead of one flat paragraph.

## How To Run Locally

1. Start Postgres and Redis:
   `docker compose up -d`
2. Start the API:
   `npm.cmd run dev:api`
3. Start the worker in another terminal:
   `npm.cmd run dev:worker`
4. Start Response Mode in another terminal:
   `npm.cmd run dev:response`
   Then open `http://localhost:3100`.
5. Start the Capture App dev UI or packaged Electron flow:
   `npm.cmd run dev:capture`
   or
   `npm.cmd run --workspace @persuando/capture start`

## Known Issues And Follow-Up

- If periodic screenshots do not start, check the Capture debug log first. periodicScreenshotCaptureDefault=false means the feature toggle is off even if consent grants exist; enable Periodic screen context default before starting capture again.
- The Capture UI is functional but visually minimal; a follow-up UI polish/spec should refine layout, density, keyboard shortcuts, and tray ergonomics.
- Screen context currently sends an in-memory data URL through the realtime event and keeps only the latest 30 screen contexts in the Response UI. A production hardening spec should add backend image size limits, redaction, storage policy, deletion behavior, and an explicit study/practice confirmation before richer code-solution output.
- Windows Capture can now be run against the VPS with `npm.cmd run capture:start:vps`, packaged as `release/capture/win-unpacked/Persuando Capture.exe`, or built as `release/capture/Persuando-Capture-Setup-0.1.0.exe`. Production distribution still needs app icon, publisher/signing decisions, update strategy, and release-channel policy.
- The login bridge code is currently in API process memory. This is fine for the current single PM2 API process, but must move to Redis/PostgreSQL before clustering or running multiple API instances.
- The local integrated smoke uses the mock provider by default. Real OpenAI-compatible provider validation should be tested after setting `PROVIDER_ADAPTER=openai-compatible` and a valid user key.
- Robust system-audio capture, automatic app/site detection, hidden capture, proctoring/focus evasion, local/offline models, and non-Windows desktop targets remain out of scope.

## Recommended Next Spec Kit Step

Run `/speckit-specify` for the next focused feature. Recommended prompt: use `docs/next-spec-prompt.md` to specify the Windows packaged Capture App, UI polish, and production hardening slice, including toolbar/tray polish, installer/dev distribution, visible permission education, production auth bridge hardening, screen context hardening, and manual end-to-end browser/Electron smoke.
