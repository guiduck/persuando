# Implementation Plan: Persuando MVP

**Spec**: `specs/001-persuando-mvp/spec.md`  
**Created**: 2026-05-20  
**Status**: Draft  
**Command**: `speckit.plan`

## Summary

Build the Persuando MVP as a TypeScript-first, two-mode system:

- **Capture Mode**: Windows Electron + React + TypeScript app for Google sign-in, focused settings,
  consent, microphone selection, always-on-top floating toolbar, tray/background controls, live
  microphone upload, visible periodic screenshot/context capture, and visible opt-in code/practice
  context.
- **Response Mode**: Next.js + React + TypeScript web app for same-account workspace access on the
  same machine or a second device, live session display, history, transcript, summaries, topic
  explanations, keyword definitions, insights, and suggested responses.
- **Backend**: NestJS Node.js service with Google auth integration, PostgreSQL persistence, native
  WebSocket realtime transport, Prisma ORM for application database access, encrypted provider
  credentials, session membership enforcement, provider orchestration, code copilot orchestration,
  and 7-day retention cleanup.
- **Background jobs**: Redis/BullMQ for retryable AI summarization, insight generation, suggestion
  generation, provider validation, and retention cleanup where async execution improves reliability.

The MVP includes microphone capture, meeting-assistant output, and visible opt-in code copilot
assistance. Robust system-audio capture, automatic app/site detection, stealth screen capture,
local/offline models, and non-Windows desktop apps remain deferred.

## Constitution Check

- **Consent-first capture**: every capture, transcription, screen/coding context input, code copilot
  action, backend transmission, provider call, and retention action checks active consent and exposes
  user-visible state.
- **Responsible use**: no invisibility, evasion, bypass, proctoring, or cheating capabilities or
  product copy are included.
- **Two-mode architecture**: Capture Mode, Response Mode, and backend ownership remain separate.
- **TypeScript-first MVP**: Electron, Next.js, NestJS, PostgreSQL, Redis/BullMQ, and WebSocket all
  fit the TypeScript-first path.
- **Narrow MVP**: plan includes code copilot because it is a core MVP feature, while still excluding
  stealth/evasion behavior and broader advanced context automation.
- **Privacy and credential safety**: provider keys are backend-encrypted and decrypted only during
  authorized backend provider calls.
- **Prototype workflow**: production UI should preserve `docs/reference-ui.md` intent and future
  prototype learnings; brittle prototype code should not be copied by default.
- **Spec Kit discipline**: this plan defines architecture, contracts, validation, operations, and
  closeout requirements, but not implementation tasks.

## Technical Decisions

### Backend Framework

**Decision**: Use **NestJS** for the backend.

**Why**:

- Clear module boundaries match Persuando's domains: auth, users, settings, consent, sessions,
  realtime, credentials, provider orchestration, retention, and AI outputs.
- Guards, interceptors, pipes, and dependency injection make consent, membership, validation, and
  logging controls easier to enforce consistently.
- First-class integration patterns exist for WebSocket gateways, BullMQ workers, validation, config,
  and testing.
- The extra structure is justified by privacy, realtime, credential, and policy enforcement
  requirements.

**Rejected for MVP**: Pure Fastify service. It is leaner and fast, but would require more custom
structure for policy enforcement, modular testing, jobs, and cross-cutting safety controls.

**Planning note**: If raw HTTP throughput becomes a bottleneck, NestJS can still use a Fastify HTTP
adapter later without changing the architectural ownership model.

### Realtime Transport

**Decision**: Use **native WebSocket** for MVP realtime transport.

**Why**:

- Supports bidirectional streaming needed for live microphone audio upload from Capture Mode.
- Supports binary audio frames from Capture Mode and JSON status/output events to Capture Mode and
  Response Mode over the same realtime channel family.
- Lower overhead than Socket.IO and better suited than SSE for upstream audio.
- Keeps the transport decision aligned with the user's "fastest we can make" direction.

**Pattern**:

- HTTP REST endpoints handle sign-in callbacks, settings, provider credential management, session
  creation, history fetch, manual delete, and provider validation requests.
- WebSocket handles live capture input, session state updates, transcript deltas, summary/insight/
  suggestion updates, presence, and connection health.
- Response Mode fetches current state and retained history over HTTP when joining, then subscribes
  to WebSocket events for live updates.

**Rejected for MVP**:

- **SSE**: good for server-to-client fan-out but not for live audio upload.
- **Socket.IO**: useful rooms/reconnect ergonomics, but its abstraction and overhead are not needed
  for the MVP if native WebSocket is implemented with explicit session routing.

### Credential Storage

**Decision**: Store user-owned provider credentials encrypted on the backend.

**Policy**:

- Persist only encrypted credential ciphertext and metadata in PostgreSQL.
- Use envelope encryption: an application-level key-encryption key protects per-credential data
  encryption keys or equivalent provider-secret material.
- Keep encryption keys in environment-specific secret management, not source code, logs, fixtures,
  tests, or migrations.
- Decrypt only inside backend provider-orchestration code and only for authorized calls with active
  provider-use consent.
- Never return full secrets to Capture Mode or Response Mode after save.
- Redact secrets from logs, errors, telemetry, validation responses, and provider payload records.

**Needs implementation design**:

- Exact key provider for local/dev/staging/production.
- Rotation procedure for encryption keys.
- How invalidated provider credentials are marked and retried.

### Persistence Access

**Decision**: Use **Prisma** for application database reads and writes.

**Policy**:

- Application services should use Prisma models instead of embedding SQL in controllers or domain
  services.
- SQL remains acceptable in migration files and the migration runner while the MVP uses additive SQL
  migrations.
- `prisma/schema.prisma` is the ORM model source for application access and should stay aligned with
  `apps/api/migrations/`.
- Future persistence tasks should move in-memory domain services to Prisma-backed storage as those
  tasks are implemented.
- Database-backed backend services/controllers should use Prisma by default. In-memory state is
  reserved for active realtime client/subscription state, bounded replay windows before durable
  event persistence, local mocks, and tests.

### Auth Provider

**Decision**: Use **Google login** as the real MVP authentication provider.

**Policy**:

- Local-dev auth may remain available for automated tests only.
- Production/user-facing MVP flows should authenticate through Google OAuth/OIDC.
- Same-account workspace/session membership is enforced from the authenticated Google-linked user.

### Retention

**Decision**: Keep MVP workspace session data for **7 days by default**, with user-accessible manual
delete.

**Policy**:

- Retained data includes transcript segments, summaries, insights, suggestions, session events
  needed for history, and safe provider payload metadata.
- Manual delete is authoritative: deleted sessions and generated artifacts must stop appearing in
  Response Mode history and must not be used as context for future outputs.
- Cleanup should be enforced by backend retention jobs plus query-level filtering for deleted or
  expired artifacts.
- Provider credentials are account settings, not session artifacts; deleting a session does not
  delete provider credentials unless the user explicitly revokes/deletes the credential.

## Architecture Boundaries

### Capture Mode

Owns:

- Windows desktop shell behavior.
- Main app window and tray/background lifecycle.
- Microphone device discovery and selected-device state.
- User-facing capture controls: start, pause, resume, end, revoke consent, quit.
- User-facing code copilot controls: enable, pause, resume, stop, revoke consent.
- Floating toolbar lifecycle: show, hide, restore, always-on-top, active timer/status, and compact
  controls.
- Active/paused/revoked/error/ended capture indicators.
- WebSocket upload of authorized microphone audio chunks.
- WebSocket or HTTP upload of authorized periodic screenshot/context and screen/coding context while
  matching consent is active.
- Shortcut configuration for start/stop listening, ask/respond, screenshot/context capture,
  show/hide toolbar, and dashboard/settings.
- Local handling of OS microphone permission state.

Does not own:

- Persistent provider credential decryption.
- Session membership decisions.
- AI provider orchestration.
- Retention enforcement beyond presenting user choices and sending authorized commands.
- Stealth screenshot, automatic app/site detection, or code copilot activation without consent.

### Response Mode

Owns:

- Same-account workspace/session selection.
- Live session display.
- Current state and 7-day retained history presentation.
- Transcript, summary, topic/keyword explanation, insight, and suggestion surfaces.
- Code-practice explanation, hint, tradeoff, and review surfaces.
- Loading, empty, reconnecting, paused, ended, deleted, and error states.

Does not own:

- Capture permissions or device control.
- Provider credential decryption.
- Realtime fan-out authorization.
- Retention cleanup.
- Generating new outputs without backend authorization.

### Backend

Owns:

- Authentication and same-account authorization.
- Workspace/session membership.
- Consent grant storage and enforcement.
- Settings persistence.
- Encrypted provider credential storage and decryption for authorized provider calls.
- Session lifecycle.
- Live event ingestion.
- WebSocket fan-out.
- Backend-orchestrated transcription.
- Summary, insight, and suggestion orchestration.
- Code copilot context validation and provider orchestration.
- PostgreSQL persistence.
- Retention enforcement and manual delete.
- Audit-safe logging and redaction.

## Data Flow

### Session Start

1. User signs in through Capture Mode.
2. Capture Mode requests account/session state from backend.
3. User configures provider, languages, capture defaults, and retention.
4. Backend stores provider credential encrypted and validates it without exposing the secret.
5. User grants consent for microphone capture, transcription, backend transmission, and provider use.
6. User may grant consent for code copilot and screen/coding context capture.
7. Backend creates or activates a session with consent snapshot and retention policy.
8. Capture Mode opens WebSocket and starts uploading microphone audio chunks after consent checks pass.

### Live Transcription

1. Capture Mode captures microphone audio from the selected device.
2. Capture Mode sends small, timestamped audio chunks over WebSocket.
3. Backend validates session membership, active capture state, and required consent.
4. Backend forwards authorized audio to the selected transcription provider or transcription adapter.
5. Backend persists transcript segments according to retention policy.
6. Backend broadcasts transcript deltas and state updates to authorized same-account Response clients.

### Summaries, Insights, And Suggestions

1. Backend groups new transcript segments into bounded context windows.
2. Backend queues or invokes summarization/insight/suggestion generation depending on latency needs.
3. Provider orchestration decrypts the user's credential only for the authorized provider call.
4. Backend persists generated outputs with source context references.
5. Backend broadcasts new outputs to Response Mode.
6. If Response Mode joined late, history is used as context, but new insights and suggestions are
   triggered by new events after join time.

### Periodic Screenshot/Context And Code Practice

1. User explicitly enables periodic screenshot/context capture or code/practice context in Capture
   Mode.
2. Capture Mode confirms active consent for screenshot/context capture, code/practice context where
   applicable, backend transmission, and provider use.
3. Capture Mode sends authorized context to the backend with visible active status.
4. Backend validates session membership, consent, retention policy, and responsible-use constraints.
5. Backend invokes the configured provider through backend-only credential decryption.
6. Backend persists outputs according to retention policy and broadcasts topic explanations, hints,
   tradeoffs, and review guidance to Response Mode.

### Late Response Join

1. Response Mode signs in as the same user.
2. Response Mode fetches active workspace/session list.
3. User opens an active session.
4. Response Mode fetches current session state, retained transcript history, and chat/output history
   permitted by retention.
5. Response Mode opens WebSocket subscription for live updates.
6. Backend generates future insights/suggestions from new events while allowing retained history as
   context.

### Manual Delete

1. User triggers delete for a retained workspace session.
2. Backend checks same-account ownership.
3. Backend marks session and artifacts deleted or performs hard deletion according to legal/product
   policy chosen during implementation.
4. Backend prevents deleted data from appearing in history or being used as AI context.
5. Backend broadcasts deleted/ended state to connected clients.

## Interface Contracts

These are planning-level contracts. Exact field names may change during implementation, but the
semantic boundaries should remain stable.

### Auth And Workspace

- `GET /api/workspaces/current`: returns same-account workspace summary, active sessions, and recent
  retained sessions.
- `GET /api/sessions/:sessionId`: returns current session state if the session belongs to the
  signed-in user.
- `POST /api/sessions`: creates a session with title, retention policy, language preferences, and
  required consent references.

### Settings And Credentials

- `GET /api/settings`: returns provider selection, language preferences, capture defaults, retention
  preference, and masked credential metadata.
- `PUT /api/settings`: updates non-secret settings.
- `POST /api/provider-credentials`: stores a provider credential encrypted on the backend and returns
  masked metadata.
- `POST /api/provider-credentials/:id/validate`: validates a credential without exposing the secret.
- `DELETE /api/provider-credentials/:id`: deletes/revokes a stored provider credential.

### Consent

- `POST /api/consent-grants`: grants consent for a specific consent type and optional session.
- `POST /api/consent-grants/:id/revoke`: revokes consent immediately.
- `GET /api/consent-grants`: returns consent state for settings and session controls.

Consent types for MVP:

- `microphone_capture`
- `audio_transcription`
- `backend_transmission`
- `external_ai_provider_usage`
- `session_retention`
- `code_copilot`
- `screen_coding_context_capture`

Deferred consent types remain modeled but inactive:

- `app_site_detection`

### WebSocket Channels

All WebSocket connections require authenticated user identity and session authorization.

Capture Mode sends:

- `capture.audio_chunk`: session ID, chunk sequence, client timestamp, audio codec/container,
  duration, binary payload reference or frame payload.
- `capture.status`: active, paused, resumed, ended, device unavailable, permission denied.
- `consent.revoked`: consent type and session ID when user revokes from Capture Mode.

Backend sends:

- `session.status`: created, active, paused, revoked, error, ended, deleted.
- `transcript.segment`: segment ID, text, timestamps, confidence, language, source.
- `summary.updated`: summary ID, content, source segment range, generated timestamp.
- `insight.created`: insight ID, type, content, source context, confidence.
- `suggestion.created`: suggestion ID, category, content, urgency, source context.
- `provider.error`: safe error code, retryability, user-facing message.
- `retention.deleted`: session/artifact deletion state.
- `copilot.context`: authorized coding context metadata and payload reference.
- `copilot.explanation`: explanation, hints, tradeoffs, or review guidance.

Response Mode sends:

- `response.subscribe`: session ID.
- `response.unsubscribe`: session ID.
- `response.ack`: last received event sequence for reconnect recovery.

### Persistence Model

PostgreSQL tables or equivalent persisted models:

- `users`
- `user_settings`
- `provider_credentials`
- `consent_grants`
- `sessions`
- `session_clients`
- `capture_devices`
- `capture_events`
- `transcript_segments`
- `summaries`
- `insights`
- `suggestions`
- `retention_policies`
- `audit_events`
- `code_copilot_contexts`
- `screen_capture_events`

Provider payload storage should default to minimal metadata. Any retained provider request/response
body requires explicit justification, redaction, and retention controls.

## AI Provider Orchestration

### Transcription

- MVP uses OpenAI-compatible transcription APIs through a backend provider adapter.
- Capture Mode uploads live audio chunks to backend; backend handles provider calls.
- Provider adapters must expose safe errors: invalid key, rate limited, quota exceeded, timeout,
  unsupported audio format, provider unavailable, and unknown provider failure.
- Partial transcripts may be broadcast as provisional only if the UI labels them clearly.

### Summaries, Insights, Suggestions

- Generated outputs use retained transcript/context permitted by session retention and consent.
- Suggestion generation should be bounded to recent context plus concise history summary to control
  latency and cost.
- AI output must be framed as suggestions, explanations, summaries, topic/keyword definitions,
  risks, questions, or follow-ups.
- The default behavior should generate useful explanations and suggested answers automatically from
  new events rather than requiring repeated prompt-button clicks.
- The provider adapter must stop processing when consent is revoked before the provider call starts.
  If consent is revoked during an in-flight call, the backend must discard or suppress unauthorized
  outputs when technically possible and report the revocation state to clients.

### Code Copilot

- Copilot output must be framed as study/practice guidance, explanations, hints, tradeoffs, and
  review notes.
- Copilot must not promise stealth operation, interview cheating, proctoring bypass, focus-detection
  bypass, or platform-rule evasion.
- Copilot processing must stop when code copilot or screen/coding context consent is revoked.

## Validation Strategy

### Unit Validation

- Consent checks block capture, transcription, provider use, backend transmission, and retention when
  consent is missing, revoked, or expired.
- Consent checks block code copilot and screen/coding context processing when consent is missing,
  revoked, or expired.
- Provider credential encryption/decryption only occurs through backend provider orchestration.
- Secret redaction removes provider keys from logs, errors, payloads, and validation responses.
- Session membership rejects cross-account access.
- Retention logic hides or deletes expired/manual-deleted sessions.

### Contract Validation

- REST settings, credentials, consent, sessions, and delete endpoints follow the planned contracts.
- WebSocket event schemas are validated for Capture Mode upload, Response Mode subscription, and
  backend fan-out.
- Late-join history returns current state plus retained context, then live updates continue from the
  WebSocket event stream.

### Integration Validation

- Start session with all consent granted.
- Attempt capture with missing consent and verify block.
- Revoke consent during active capture and verify stop/fan-out.
- Upload audio chunks and receive transcript deltas.
- Enable code copilot with consent and receive practice explanations.
- Revoke code copilot consent and verify processing stops.
- Join Response Mode late and verify history/context behavior.
- Provider key invalid/expired/rate-limited flow.
- Manual delete removes history from Response Mode and future AI context.
- 7-day retention cleanup excludes expired sessions.

### UI Validation

- Capture Mode displays active, paused, revoked, error, ended, and tray states.
- Response Mode displays loading, empty, live, reconnecting, paused, ended, deleted, and error states.
- Settings masks provider credentials after save.
- MVP copy does not mention invisibility, evasion, bypass, proctoring, or cheating.
- Code copilot and screen/coding context controls cannot be activated without consent or represented
  as stealth/evasion features.

### Operational Validation

- WebSocket reconnect resumes from last acknowledged event where possible.
- Backpressure behavior is defined for audio upload when provider latency spikes.
- Background jobs retry transient provider failures without duplicating user-visible outputs.
- Retention cleanup is idempotent.
- Logs, metrics, and audit events do not contain secrets or raw provider keys.

## Security, Privacy, And Compliance Notes

- Use TLS for all HTTP and WebSocket traffic outside local development.
- Enforce same-account access at HTTP and WebSocket layers.
- Treat transcript, summary, insight, suggestion, and provider payload data as sensitive session
  data.
- Use structured audit events for consent grant, consent revocation, session start/end, provider
  credential create/delete, manual delete, and retention cleanup.
- Never log raw audio, full transcript payloads by default, provider credentials, or decrypted
  secrets.
- Prefer short, user-facing safe error messages and private diagnostic codes.

## Deployment And Configuration Impacts

Required environment/configuration categories:

- Database URL.
- Redis URL for BullMQ jobs.
- Authentication/session secrets.
- Backend credential encryption key or key-management service configuration.
- Allowed origins for Capture Mode and Response Mode.
- WebSocket endpoint URL.
- Provider adapter configuration.
- Retention cleanup schedule.
- Log redaction configuration.

Local development should include a safe mock provider path so consent, session, realtime, and UI
flows can be validated without real provider usage.

## Migration And Compatibility Impacts

- Initial implementation will introduce first persistence schema for users, settings, provider
  credentials, consent grants, sessions, realtime events, transcripts, summaries, insights,
  suggestions, retention policies, and audit events.
- Schema should be additive and migration-driven from the start.
- Prisma schema changes and SQL migrations must remain aligned until the project chooses a single
  migration authority.
- Credential encryption format must include version metadata for future rotation.
- WebSocket event versions should be included to allow additive event evolution.
- Future advanced context features should reuse consent, retention, session, and provider
  orchestration primitives rather than bypassing them.

## Prototype And UI Guidance

- Before production UI build-out, create or validate a navigable prototype from `docs/`,
  `docs/lovable-prompt-base.md`, `docs/reference-ui.md`, and `references/lovable-template/`.
- Capture App should be quiet, operational, and status-forward.
- Settings and consent must be primary surfaces, not hidden preferences.
- Response App should optimize for live scanning: current status, transcript, summary, insights, and
  suggestions visible without heavy navigation.
- Production implementation should preserve prototype workflow decisions but replace prototype-only
  data with authenticated sessions, realtime events, persisted settings, and provider-backed AI
  processing.

## Risks And Mitigations

- **Realtime latency**: use native WebSocket, small audio chunks, bounded AI context windows, and
  backpressure handling.
- **Credential exposure**: envelope encryption, strict redaction, backend-only decryption, and
  provider-call scoped access.
- **Consent drift**: centralize consent enforcement in backend guards/services and mirror state in
  Capture/Response UI.
- **Provider instability**: safe errors, retries for transient failures, provider validation, and
  visible degraded states.
- **Session history confusion**: Response Mode clearly separates retained history/current context
  from new live events.
- **Scope creep**: keep automatic app/site detection, stealth capture, robust system audio, and
  broader visual context automation deferred.

## Open Planning Items For Tasks

- Choose exact Google auth library/session implementation.
- Choose exact provider adapter package/API after checking current provider documentation.
- Define exact audio codec/container and chunk sizing.
- Define exact code copilot screen/coding context payload shape and upload strategy.
- Define exact PostgreSQL schema and indexes.
- Define encryption key-management mechanism per environment.
- Define exact WebSocket reconnect and event replay window.
- Define exact retention cleanup schedule and deletion mode.
- Define testing harnesses for desktop, web, backend, WebSocket, jobs, and provider mocks.

## Documentation Closeout Requirements

The implementation task breakdown must include updates to:

- `docs/architecture.md` for selected NestJS/WebSocket/encrypted-credential architecture.
- `docs/domain-model.md` for backend-encrypted credentials, same-account workspaces, 7-day
  retention, manual delete, and live audio upload.
- `docs/reference-ui.md` after prototype or UI decisions are made.
- `docs/handoff.md` after each implementation phase.
- `docs/roadmap.md` when phase status changes.
- `docs/next-spec-prompt.md` with the next Spec Kit command after tasks are generated or
  implementation completes.

## Plan Review Checklist

- Backend framework decision is explicit: NestJS.
- Realtime decision is explicit: native WebSocket.
- Provider credentials are backend-encrypted with backend-only decryption.
- Consent and retention enforcement are cross-boundary requirements.
- Same-account Response Mode access is preserved.
- Late-join history behavior is preserved.
- 7-day retention with manual delete is preserved.
- Forbidden advanced context features remain deferred while visible consent-gated code copilot stays
  in MVP.
- No implementation task breakdown is included.
