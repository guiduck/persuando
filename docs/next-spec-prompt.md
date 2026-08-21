## Command
speckit.specify

## Objective
Create the next focused Persuando specification for Windows Capture App release polish, UI polish, and production-readiness hardening after the first MVP implementation slice and initial VPS/installer smoke path.

## Current Context

The first MVP slice in `specs/001-persuando-mvp/` is implemented and validated locally:

- NestJS API with Prisma/PostgreSQL persistence.
- Google/local-dev auth, including production subdomain callback bridge from API OAuth callback to the Response App login completion route.
- Backend-encrypted provider credentials.
- Consent grant/revoke.
- Settings.
- 7-day retention and manual delete.
- Native `/realtime` WebSocket.
- Consent-gated microphone chunk ingestion.
- Transcript, summary, insight, suggestion, and code-practice guidance fan-out.
- BullMQ worker boundaries.
- Next.js Response Mode.
- Electron/Vite/React Capture Mode with dashboard, settings, floating toolbar, tray menu, microphone capture, visible context controls, user-requested screen context, periodic screen context, and responsible Code Practice tutoring from recent visual context.

Validation completed:

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run format`
- `npm.cmd run test` with 108 passing tests
- Local integrated REST/WebSocket smoke for capture activation, audio upload, response fan-out, copilot context, and manual delete
- Regression coverage for active-session cleanup on new capture creation and periodic screenshot toggle startup during active capture
- Code Practice provider prompt now requires long Markdown teaching answers with detected-language code snippets in the step-by-step section, fenced code blocks, JavaScript fallback when unclear, and Response Mode renders headings, lists, inline code, and scrollable code blocks

## Feature To Specify

Define the next production-readiness slice for:

1. Windows Capture App release polish beyond the current Electron Builder smoke installer.
2. Floating toolbar and tray UX polish.
3. Manual end-to-end Electron/browser smoke workflow.
4. Real OpenAI-compatible provider smoke workflow.
5. Screen/context capture hardening before broader use.
7. Optional VPS production deployment hardening from `docs/vps-deployment.md`, including ports, PM2/systemd or containerization, HTTPS/domain setup, production URL configuration, and durable auth bridge storage before multiple API instances.
6. Code Practice visual-context quality gates for study/practice/review explanations, including manual smoke criteria for automatic screenshot-triggered generation behavior, detected-language snippets, Markdown/code-block readability, and future syntax-highlighting polish in Response Mode.

## Requirements To Cover

- Refine the current runnable Windows artifacts (`release/capture/win-unpacked/Persuando Capture.exe` and `release/capture/Persuando-Capture-Setup-0.1.0.exe`) into a safer release flow with icon, signing/publisher decisions, update policy, and installer smoke checks.
- Preserve close-to-tray behavior and visible toolbar show/hide.
- Keep capture status visible for idle, active, paused, reconnecting, error, revoked, and ended states.
- Make settings, provider key entry, model selection, consent toggles, microphone selection, and shortcut references easier to test manually.
- Add manual smoke documentation for: Google sign-in, provider key save/validate, consent grant/revoke, start capture, pause/resume, hide/show toolbar, Response Mode live session, context capture, provider error, and manual delete.
- Define real-provider testing expectations without committing keys or secrets.
- Define production auth hardening expectations for the current one-time login bridge: short TTL, single use, no signed token in URLs, host-only cookies per subdomain, and Redis/PostgreSQL storage if the API runs more than one process.
- Add screen/context limits for size, consent text, visible active state, maximum retained visual-context count, redaction expectations, and retention/delete behavior.
- Define manual validation criteria for Code Practice outputs from screenshots: identify the visible prompt/enunciado when present, detect the selected programming language and fall back to JavaScript only when unclear, explain the chosen technique step by step with concrete code snippets inside the steps, include child-friendly intuition, include Big-O time and space complexity, provide pseudocode or final code only in allowed study/practice/review contexts, format the answer as Markdown with fenced code blocks, render code blocks readably in Response Mode, avoid live-assessment cheating behavior or claims, and verify Auto mode triggers from new screenshots without repeated spam.

## Non-Goals

- Do not add stealth, invisibility, recording bypass, screen-share bypass, browser focus evasion, proctoring evasion, platform-rule evasion, or cheating-oriented features.
- Do not add robust system-audio capture in this slice.
- Do not add automatic app/site detection in this slice.
- Do not add local/offline models in this slice.
- Do not choose a production deployment provider unless required by the spec.

## Source Context

Use:

- `.specify/memory/constitution.md`
- `docs/overview.md`
- `docs/vision.md`
- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/reference-ui.md`
- `docs/prototype-mvp-flow.md`
- `docs/roadmap.md`
- `docs/handoff.md`
- `specs/001-persuando-mvp/spec.md`
- `specs/001-persuando-mvp/plan.md`
- `specs/001-persuando-mvp/tasks.md`

## Output Expectations

- Produce a concise Spec Kit feature specification.
- Preserve the current two-mode architecture.
- Keep consent, privacy, responsible use, and documentation closeout enforceable.
- Do not create implementation tasks until `/speckit-tasks` is invoked.
