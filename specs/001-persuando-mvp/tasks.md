# Tasks: Persuando MVP

**Spec**: `specs/001-persuando-mvp/spec.md`  
**Plan**: `specs/001-persuando-mvp/plan.md`  
**Created**: 2026-05-20  
**Status**: Draft  
**Command**: `speckit.tasks`

## Task Rules

- Execute tasks in dependency order unless a later task is explicitly marked parallel.
- Write tests/contracts before implementation when a task defines security, consent, retention,
  realtime, provider, or public interface behavior.
- Keep forbidden advanced context deferred: no robust system-audio capture, automatic app/site
  detection, stealth capture, local/offline models, native Rust/C#/native-module integrations, or
  non-Windows desktop apps. Code copilot is in MVP only as visible, consent-gated study/practice
  assistance.
- Do not report implementation complete until validation and documentation closeout tasks are done.

## Phase 0 - Project Foundation

- [x] T001 Create the TypeScript workspace structure for `apps/capture`, `apps/response`,
  `apps/api`, `packages/contracts`, and `packages/config`.
- [x] T002 Configure package manager scripts for lint, typecheck, test, build, dev, and format across
  the workspace.
- [x] T003 Add base TypeScript, lint, formatting, environment, and test configuration shared by all
  packages.
- [x] T004 Create initial environment templates for database, Redis, auth/session secrets,
  credential encryption, allowed origins, WebSocket URL, provider adapter, retention cleanup, and log
  redaction.
- [x] T005 Add a local development mock provider mode for transcription, summaries, insights, and
  suggestions so consent/realtime/UI flows can run without a real provider key.
- [x] T006 Define shared error-code, status, and redaction conventions in `packages/contracts`.

## Phase 1 - Contracts And Data Model

- [x] T007 Define shared contract types for users, workspaces, settings, provider credential
  metadata, consent grants, sessions, capture events, transcript segments, summaries, insights,
  suggestions, retention policies, and audit events.
- [x] T008 Define REST contract schemas for settings, provider credentials, provider validation,
  consent grants/revocation, session creation, session fetch, workspace current state, and manual
  delete.
- [x] T009 Define WebSocket event schemas for `capture.audio_chunk`, `capture.status`,
  `consent.revoked`, `response.subscribe`, `response.unsubscribe`, `response.ack`,
  `session.status`, `transcript.segment`, `summary.updated`, `insight.created`,
  `suggestion.created`, `provider.error`, and `retention.deleted`.
- [x] T010 Add contract tests that reject missing consent, cross-account session access, unmasked
  provider secrets, malformed WebSocket events, and deleted/expired session access.
- [x] T011 Design the PostgreSQL migration set for users, workspaces, settings, encrypted provider
  credentials, consent grants, sessions, session clients, capture devices, capture events, transcript
  segments, summaries, insights, suggestions, retention policies, and audit events.
- [x] T012 Add migration tests for required constraints, ownership relations, retention expiry,
  deleted timestamps, credential encryption metadata, and event ordering/indexes.

## Phase 2 - Backend Core

- [x] T013 Scaffold the NestJS backend app with modules for auth, users, workspaces, settings,
  credentials, consent, sessions, realtime, providers, retention, audit, and health.
- [x] T014 Implement configuration loading and validation for database, Redis, auth, encryption,
  CORS/origins, provider adapter, WebSocket, and retention cleanup settings.
- [x] T015 Implement PostgreSQL connection, migration runner integration, and test database setup.
- [x] T015a Add Prisma ORM schema/client integration for application persistence access while
  retaining SQL migrations as the current schema-change mechanism.
- [x] T015b Migrate database-backed backend services/controllers to Prisma for audit, credentials,
  consent, settings, workspaces, and sessions, leaving only realtime connection state in memory.
- [x] T016 Implement safe logging and redaction middleware/interceptors that remove provider keys,
  decrypted secrets, raw audio, raw provider payloads, and sensitive transcript payloads from logs.
- [x] T017 Implement Google auth/session identity abstraction for same-account access, with a
  local-dev auth mode suitable for automated tests.
- [x] T018 Implement workspace and session membership guards for HTTP and WebSocket access.
- [x] T019 Implement audit events for consent grant, consent revocation, session start/end, provider
  credential create/delete, manual delete, and retention cleanup.

## Phase 3 - Backend Consent, Settings, Credentials, Retention

- [x] T020 Add unit tests for consent enforcement across capture, transcription, backend
  transmission, external provider use, retention, and revoked/expired consent.
- [x] T021 Implement consent grant, consent lookup, and consent revocation services and REST
  endpoints.
- [x] T022 Add unit tests for backend provider credential encryption, masking, backend-only
  decryption, secret redaction, and invalid credential state.
- [x] T023 Implement encrypted provider credential storage with encryption version metadata and
  backend-only decrypt access in provider orchestration code.
- [x] T024 Implement provider credential create, validate, metadata fetch, and delete/revoke
  endpoints.
- [x] T025 Implement user settings endpoints for provider selection, language preferences, capture
  defaults, and 7-day retention preference.
- [x] T026 Add unit and integration tests for 7-day retention filtering and manual delete.
- [x] T027 Implement retention policy application, manual session delete, deleted-session filtering,
  and idempotent retention cleanup job skeleton.

## Phase 4 - Backend Sessions, Realtime, Provider Orchestration

- [x] T028 Add contract tests for session create/fetch/list behavior, same-account workspace access,
  late-join history, and cross-account denial.
- [x] T029 Implement workspace current-state and session create/fetch endpoints.
- [x] T030 Add WebSocket gateway tests for authentication, session authorization, subscribe,
  unsubscribe, ack, reconnect, invalid event rejection, and cross-account denial.
- [x] T031 Implement native WebSocket gateway with explicit session routing and event versioning.
- [x] T032 Add integration tests for live microphone audio upload with consent checks and
  backpressure behavior.
- [x] T033 Implement `capture.audio_chunk` ingestion, chunk sequencing, active-session validation,
  and safe rejection when consent/session state is invalid.
- [x] T034 Implement provider adapter interface for OpenAI-compatible transcription and generation,
  with mock adapter for local development and tests.
- [x] T035 Implement backend-orchestrated transcription flow from audio chunk ingestion to transcript
  segment persistence and WebSocket fan-out.
- [x] T036 Implement summary, insight, and suggestion orchestration using bounded context windows and
  retained history as context.
- [x] T037 Add BullMQ queues/workers for retryable provider validation, summarization, insight
  generation, suggestion generation, and retention cleanup where async execution is useful.
- [x] T038 Add integration tests for provider failure modes: invalid key, revoked key, rate limit,
  quota exceeded, timeout, unsupported audio format, provider unavailable, and safe unknown error.
- [x] T039 Add integration tests for consent revocation during active capture and during provider
  processing.
- [x] T039a Add integration tests for code copilot consent, screen/coding context upload, copilot
  provider output, and revocation stop behavior.

## Phase 5 - Response App

- [x] T040 Scaffold the Next.js Response App using App Router, Node.js runtime defaults, shared
  contracts, and authenticated same-account workspace access.
- [x] T041 Implement workspace/session list view showing active sessions and recent retained
  sessions for the signed-in user.
- [x] T042 Implement session history fetch for current state, retained transcript, summaries,
  insights, suggestions, deleted/expired handling, and loading/empty/error states.
- [x] T043 Implement WebSocket subscription client for session status, transcript segments,
  summaries, insights, suggestions, provider errors, retention delete, reconnect, and ack.
- [x] T044 Implement live session UI optimized for scanning: status, transcript, current summary,
  insights, suggested responses, and follow-up actions.
- [x] T045 Implement late-join behavior that displays retained history as context and only shows new
  insights/suggestions for new events after join time.
- [x] T045a Implement topic/keyword explanation, direct suggested-answer, and code-practice
  explanation surfaces in Response Mode.
- [x] T046 Implement manual delete UI flow for retained workspace sessions with confirmation and
  deleted-state handling.
- [x] T047 Add UI tests for loading, empty, live, reconnecting, paused, ended, deleted, provider
  error, and cross-account denied states.
- [x] T048 Add responsible-use copy checks for Response Mode to ensure no invisibility, evasion,
  bypass, proctoring, or cheating claims appear.

## Phase 6 - Capture App

- [x] T049 Scaffold the Windows-first Electron + React + TypeScript Capture App with shared
  contracts, environment configuration, main process, renderer process, and local dev launch script.
- [x] T050 Implement sign-in/session identity flow compatible with backend same-account access.
- [x] T051 Implement focused settings UI for OpenAI-compatible API key entry, provider validation,
  transcription model selection, analysis model selection, primary language, response language,
  preferred programming language, capture defaults, consent status, shortcuts, and 7-day retention.
- [x] T052 Implement provider key masking after save and safe validation-error display.
- [x] T053 Implement microphone device discovery, selected-device state, and OS permission error
  states.
- [x] T054 Implement consent UI for microphone capture, transcription, backend transmission,
  external AI provider usage, periodic screenshot/context capture, code/practice context, and
  retention.
- [x] T055 Implement floating toolbar controls for assistant/session mode, dashboard/home,
  ask/respond, start listening, pause, resume, end, timer/status, hide/show, and revoke consent.
- [x] T056 Implement live microphone audio chunk upload over native WebSocket after consent checks.
- [x] T056a Implement visible, consent-gated periodic screenshot/context and code/practice context
  capture and upload.
- [x] T057 Implement Capture App status handling for active, paused, revoked, error, ended,
  reconnecting, provider error, and device unavailable states.
- [x] T058 Implement Windows tray/background behavior: close-to-tray, status, show or hide floating
  toolbar, open dashboard/settings, start or stop audio capture, pause or resume capture, end
  session, and quit.
- [x] T059 Add UI tests for settings, consent, provider validation, microphone permission denied,
  active/paused/revoked/error/ended capture states, and tray lifecycle.
- [x] T060 Add responsible-use copy checks for Capture Mode and ensure code copilot cannot activate
  without consent and automatic app/site detection or stealth/evasion controls cannot activate.

## Phase 7 - End-To-End And Operational Validation

- [x] T061 Add end-to-end test: first-time user signs in, saves encrypted provider credential, grants
  consent, starts microphone capture, sees transcript and suggestions in Response Mode, pauses,
  resumes, and ends the session.
- [x] T062 Add end-to-end test: missing consent blocks capture and provider processing.
- [x] T063 Add end-to-end test: consent revocation during active capture stops upload,
  transcription, provider processing, and Response Mode live state.
- [x] T064 Add end-to-end test: late Response Mode join receives current state/history and then new
  live events.
- [x] T064a Add end-to-end test: user enables code copilot with explicit consent and receives
  practice-oriented explanations in Response Mode.
- [x] T065 Add end-to-end test: manual delete removes retained session data from Response Mode and
  future AI context.
- [x] T066 Add retention cleanup integration test for 7-day expiry and idempotent repeated cleanup.
- [x] T067 Add WebSocket reconnect/resume test using `response.ack` and event replay window.
- [x] T068 Add backpressure and provider-latency test for audio upload and user-visible degraded
  states.
- [x] T069 Add log/telemetry audit test confirming provider keys, decrypted secrets, raw audio, and
  sensitive provider payloads are redacted.
- [x] T070 Run full workspace lint, typecheck, unit tests, contract tests, integration tests,
  end-to-end tests, and production builds.

## Phase 8 - Prototype And Manual Smoke

- [x] T071 Create or update a navigable prototype/reference flow from `docs/`,
  `docs/lovable-prompt-base.md`, `docs/reference-ui.md`, and `references/lovable-template/`.
- [x] T072 Validate prototype or reference UI against production UI: Capture settings, consent, tray
  status, Response live session, history, manual delete, loading, empty, paused, ended, deleted, and
  error states.
- [x] T073 Manually smoke test Capture Mode on Windows: sign in, settings, provider validation,
  microphone permission, close-to-tray, start/pause/resume/end capture, revoke consent, and quit.
- [x] T074 Manually smoke test Response Mode in a browser/second device scenario: same-account
  workspace list, active session join, late join, reconnect, history, live updates, and manual delete.
- [x] T075 Manually smoke test degraded provider/realtime behavior: invalid key, provider timeout,
  WebSocket disconnect, device unavailable, and retention-deleted session.

## Phase 9 - Documentation Closeout

- [x] T076 Update `docs/architecture.md` with final implemented module boundaries, WebSocket flow,
  encryption approach, provider orchestration, retention cleanup, and operational notes.
- [x] T077 Update `docs/domain-model.md` with final schema names, key fields, lifecycle states,
  invariants, and any resolved open questions.
- [x] T078 Update `docs/reference-ui.md` with validated Capture Mode and Response Mode UI decisions,
  prototype links/screenshots if available, and production notes.
- [x] T079 Update `docs/handoff.md` with implementation status, validation results, known issues,
  environment notes, and next recommended action.
- [x] T080 Update `docs/roadmap.md` to reflect the implementation phase status and any changed gates.
- [x] T081 Update `docs/next-spec-prompt.md` with the next appropriate Spec Kit prompt after task
  completion.
- [x] T082 Confirm `README.md` no longer conflicts with Persuando-specific docs or note remaining
  boilerplate explicitly in `docs/handoff.md`.
- [x] T083 Final constitution check: verify consent, responsible-use, privacy, architecture,
  prototype, docs, and Spec Kit closeout requirements are satisfied.

## Dependency Notes

- T001-T006 must complete before feature implementation.
- T007-T012 should complete before backend, Capture App, or Response App consumes contracts.
- T020-T027 should complete before provider orchestration or live capture can be considered safe.
- T028-T039 should complete before Response/Capture live UI is wired to real backend flows.
- T040-T048 and T049-T060 may proceed in parallel after shared contracts and backend endpoints are
  stable enough for integration.
- T061-T070 require backend, Capture App, and Response App integration.
- T071-T075 should run before production UI hardening is considered complete.
- T076-T083 are mandatory closeout tasks and gate completion.

## Scope Guard

These tasks intentionally exclude robust system-audio capture, automatic app/site detection, stealth
capture, local/offline models, native Rust/C#/native-module integrations, non-Windows desktop apps,
invisibility, screen-share evasion, recording bypass, browser-focus evasion, proctoring evasion,
platform-rule evasion, and cheating workflows. They include code copilot only as visible,
consent-gated study/practice assistance.
