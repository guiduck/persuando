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

- First integrated MVP slice implemented and validated locally. Runtime fixes now keep Response polling from ending active captures and allow periodic screenshot capture to start when enabled during an active session. Code Practice prompting is constrained to study/practice/review tutoring with detected-language pseudocode/snippets, code-backed step-by-step guidance, Big-O, responsible-use boundaries, Markdown headings/lists, fenced code blocks, longer OpenAI-compatible generation settings, quality fallback for short or code-free outputs, and Response Mode Auto triggering from new screen context. Response Mode renders Code Practice answers with semantic Markdown sections, inline code, and scrollable code blocks so longer explanations are readable in the live session view. Not production-ready for end users until Windows packaging/signing, UI polish, extended real-provider smoke, explicit visual-context quality gates, richer syntax-highlighting polish, deployment hardening, and screen-context hardening are completed.

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
