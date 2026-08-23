## Command
speckit.specify

## Objective
Create the next focused Persuando specification for Windows Capture App release polish, UI polish, and production-readiness hardening after the first MVP implementation slice and initial VPS/installer smoke path.

## Current Context

The first MVP slice in `specs/001-persuando-mvp/` is implemented and validated locally:

- NestJS API with Prisma/PostgreSQL persistence.
- Google/local-dev auth, including production subdomain browser callback bridge from API OAuth callback to the Response App login completion route and a separate Electron Capture callback completion path using `/auth/google?clientType=capture`.
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

-
pm.cmd run build`
-
pm.cmd run typecheck`
-
pm.cmd run lint`
-
pm.cmd run format`
-
pm.cmd run test` with 108 passing tests
- Local integrated REST/WebSocket smoke for capture activation, audio upload, response fan-out, copilot context, and manual delete
- Regression coverage for active-session cleanup on new capture creation and periodic screenshot toggle startup during active capture
- Code Practice provider prompt now requires long Markdown teaching answers with detected-language code snippets in the step-by-step section, fenced code blocks, JavaScript fallback when unclear, and Response Mode renders headings, lists, inline code, and scrollable code blocks
- Realtime regression coverage confirms blank/missing Copilot programming language falls back to `javascript` instead of rejecting screen context during capture

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
- Define production auth hardening expectations for the current browser one-time login bridge and Electron Capture callback flow: short TTL, single use, no signed token in URLs, host-only cookies per subdomain, Capture login must not redirect into Response Mode, and Redis/PostgreSQL storage if the API runs more than one process.
- Add screen/context limits for size, consent text, visible active state, maximum retained visual-context count, redaction expectations, and retention/delete behavior.
- Define manual validation criteria for Code Practice outputs from screenshots: identify the visible prompt/enunciado when present, detect the selected programming language and fall back to JavaScript only when unclear, explain the chosen technique step by step with concrete code snippets inside the steps, include child-friendly intuition, include Big-O time and space complexity, provide pseudocode or final code only in allowed study/practice/review contexts, format the answer as Markdown with fenced code blocks, render code blocks readably in Response Mode, avoid live-assessment cheating behavior or claims, and verify Auto mode triggers from new screenshots without repeated spam.
- Preserve the new programming-language fallback in both Capture and API validation so missing user settings cannot break screenshot/code-practice context upload.

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

## Additional Source Context - 2026-08-22 Screenshot Debug Trace

Recent implementation fixed the runtime Capture preload mismatch for periodic screen context IPC and added optional `debugId` propagation for manual and periodic screenshots. The next spec should preserve this traceability requirement in manual smoke criteria: every screenshot should be debuggable with one `[screen:<debugId>]` across Capture renderer, Electron main, WebSocket `copilot.context`, API validation/persist/publish, and Response screen-context apply. Build validation for this update: `npm.cmd run build` passed.

## Next Spec Prompt - 2026-08-23 Visual Context Production Hardening

```text
/speckit-specify Specify production hardening for Persuando Code Practice visual context.

Objective:
Make real OpenAI-compatible visual generation reliably grounded in the current coding problem while controlling latency, payload size, retention, and cost.

Source request/context:
The 2026-08-23 fix removed an incorrect Tree Height hardcoded fallback and established a 30-screenshot FIFO window. Preserve truthful provider errors and the real-model-only generation path.

Project context:
Use README.md, docs/architecture.md, docs/domain-model.md, docs/handoff.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing Capture -> realtime API -> Response architecture.

Requirements:
- Preserve explicit consent and visible Code Practice state.
- Define screenshot compression, deduplication, durable storage, retention, and deletion behavior.
- Define an adaptive model-input policy that prioritizes recent/non-duplicate screenshots without silently using stale sessions.
- Keep every generation addressable in logs by session, model, context source, image count, latency, and safe provider error code without logging images, prompts, keys, or secrets.
- Add real-provider smoke criteria proving that the generated explanation matches the visible problem title, requested function, input/output behavior, and selected language.
- Never fabricate fallback tutoring content; provider failures must stay visible and retryable where appropriate.

Artifact considerations:
Prefer additive contracts and migrations. Document compatibility for existing text-only CodeCopilotContext rows and keep the current 30-item UI behavior until a replacement policy is approved.

Risks/assumptions:
Thirty full-screen data URLs can increase latency and cost. Older persisted rows may not contain recoverable image bytes. Real-provider tests require external credentials and must not commit secrets.

Expected output:
Produce a concise feature specification with acceptance criteria, failure states, observability requirements, migration/rollback considerations, and manual Electron-to-VPS smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Additional Source Context - 2026-08-23 Incremental Tutoring

The implemented baseline now performs two OpenAI-compatible calls for Code Practice: `visual_analysis` receives all current screenshots and extracts exact structured evidence; `answer` receives that analysis plus the last four completed explanations. Manual guidance is persisted in the existing CodeCopilotContext table, and the Response panel exposes `N/30` FIFO order. The next `/speckit-specify` must preserve this truthful two-phase behavior and define fixture-based quality gates for function signatures, provided node fields, method-only submissions, print/return semantics, output whitespace, current code, failed test evidence, correction of prior advice, OCR uncertainty, latency, and image/token cost. It must not introduce fabricated fallback content or automated code execution.
