# Architecture

## Stack

- Desktop Capture App: Electron, React, and TypeScript targeting Windows first.
- Response App: Next.js, React, and TypeScript as a web interface initially.
- Backend/API: Node.js with NestJS for the MVP.
- Realtime: native WebSocket for low-latency microphone audio upload and live session updates.
- Persistence: PostgreSQL for users, sessions, settings, consent grants, and retained session artifacts,
  with Prisma as the application ORM and SQL migrations as the current schema-change mechanism.
- Background work: Redis and BullMQ for transcription, summarization, insight generation, and future multimodal jobs.
- AI providers: user-configured provider credentials stored encrypted on the backend, starting with OpenAI-compatible transcription and language/model APIs.

## Boundaries

### Capture App

The Capture App owns local desktop behavior: Google login, tray/background mode, always-on-top floating toolbar, capture controls, device selection, microphone capture, visible code copilot controls, authorized periodic screenshot/context capture, global shortcuts, and live microphone audio upload after consent is active.

The current Capture implementation uses Electron main/preload/renderer boundaries. The main process
owns the dashboard window, transparent always-on-top toolbar window, close-to-tray behavior, tray
restore, tray command menu, and IPC state for toolbar visibility/listening/paused/error status. The
renderer owns the dashboard, settings, consent controls, microphone device discovery through
`enumerateDevices`, microphone capture through `MediaRecorder`, visible text context, and
user-requested screen context. It creates backend sessions, sends `capture.status` before audio
upload, and sends safe `capture.audio_chunk` metadata over native WebSocket; raw audio bytes are not
persisted by the backend ingestion path in this slice.

Closing the main window should minimize the app to the Windows tray instead of ending the process. The toolbar can be hidden or shown while a session is active. The MVP tray menu should expose status, show or hide toolbar, open settings/dashboard, start or stop audio capture, pause or resume capture, enable or stop visible code/practice context mode, and fully quit the app.

### Response App

The Response App owns the intelligence display for a session. It receives authorized context from the backend and shows transcripts, summaries, topic explanations, keyword definitions, suggested responses, questions, risks, and code-practice explanations. Response Mode may run on the same Capture App machine or on a second browser/device signed in to the same account.

The first Response App scaffold uses Next.js App Router on the Node.js runtime. Server Components
read the incoming browser cookie with `cookies()`, forward it to the NestJS API, and render
same-account workspace/session state without exposing provider credentials or backend secrets to the
client.

Session detail pages fetch retained session history through `/sessions/:sessionId`, including
transcript segments, summaries, insights, suggestions, and consent grant state. Deleted or expired
sessions remain inaccessible through the same workspace/session access guard and render as
unavailable in Response Mode.

The live session page also opens `/realtime` as a Response client, sends `response.subscribe` with
the last seen sequence, applies replayed and live events, sends `response.ack`, reconnects after
disconnects, and distinguishes retained history from insights/suggestions that arrive after join.
It presents scanning-focused panels for direct suggested answers, topic context, follow-ups,
provider errors, code-practice explanations, and manual delete state.

### Backend Realtime

The backend owns authentication, same-account workspace/session membership, event ingestion, native WebSocket fan-out, backend-orchestrated transcription, provider orchestration, encrypted provider credential storage/decryption for authorized calls, persistence, 7-day retention, manual delete, and retention policy enforcement. It must keep Capture Mode and Response Mode connected without assuming they run on the same device.

The API bootstrap attaches a native WebSocket server at `/realtime`. WebSocket clients authenticate
with the same Google session cookie used by REST requests, or local-dev fallback outside production.
The bridge connects into `RealtimeGateway`/`RealtimeService`, pushes new events to subscribed
clients, and preserves ack/replay semantics for reconnecting Response clients.

Application services use Prisma models for database reads/writes instead of hand-written SQL. Raw
SQL is reserved for migration files and the migration runner until the project explicitly migrates
schema management fully to Prisma migrations. Realtime connection maps remain in memory because
they represent active socket state, not durable product data.

Capture clients update session lifecycle through consent-gated `capture.status` events. `active` or
`resumed` marks a session active, `paused` marks it paused, `ended` ends it, and device/permission
failures move the session to error state with a safe message. `capture.audio_chunk` ingestion
requires a connected Capture Mode client, same-account session access, active session status, active
microphone capture and backend transmission consent, valid chunk metadata, monotonically increasing
per-session chunk sequence, and available buffer capacity. Accepted chunks persist only safe
metadata in `capture_events`; raw audio bytes are not logged or stored by this ingestion slice.

### AI Pipeline And Jobs

The AI pipeline processes authorized session context only. MVP processing starts with backend-orchestrated microphone transcription, incremental summaries, topic/keyword explanations, direct suggested responses to questions, and code/practice explanations from consented screen/coding context. Future processing may add robust system audio, diarization, automatic platform detection, and broader visual context automation only through later consent-gated specs.

Provider access is mediated through a backend adapter interface. Local development defaults to a
deterministic mock adapter. The OpenAI-compatible adapter supports transcription via
`/audio/transcriptions` and generation via `/chat/completions`, receives decrypted provider secrets
only from orchestration code, and maps provider failures to safe retryable/non-retryable errors
without returning secrets.

Retryable backend work is mediated through the Jobs module. BullMQ queues are defined for provider
credential validation, session assistance generation, and retention cleanup. Worker handlers call
the same backend-only credential, provider, settings, sessions, and Prisma persistence services used
by synchronous request flows. The API process does not automatically start queue workers; `dev:worker`
boots a Nest application context, runs migrations, and creates the BullMQ workers as a separate
process.

Provider processing re-checks transcription consent after a pending provider call returns and before
persisting transcripts or generating assistance. If the user revokes consent mid-flight, the backend
stops persistence/fan-out for that provider result instead of treating the revocation as a provider
failure.

Visible code copilot context uses the same realtime boundary. Capture Mode may send
`copilot.context` only after explicit code copilot, screen/coding context, and backend transmission
consent. The backend persists authorized context in `code_copilot_contexts`, generates
practice-oriented guidance through the provider adapter, publishes `copilot.explanation`, and stops
publishing output if copilot consent is revoked while provider processing is pending.

Realtime client errors are converted to safe client-facing messages. Provider errors publish
structured `provider.error` payloads; unexpected infrastructure/persistence failures are reported as
generic realtime failures so Prisma, secrets, raw payloads, and internal stack details are not
exposed to Capture or Response clients.

### User Settings And Consent

Settings and consent are core architecture concerns, not optional UI details. The system must store which capture modes are enabled, which providers may be used, which data may be retained, and which permissions have been granted or revoked.

## Operational Notes

- The MVP targets Windows first.
- Microphone capture, realtime chunk upload, and explicitly enabled periodic screenshot/context capture are in MVP scope.
- Robust system-audio capture, automatic LeetCode/HackerRank detection, stealth capture, and hidden capture behavior are deferred or forbidden according to the constitution.
- Provider credentials must not be committed to source code or logs. MVP credentials are encrypted on the backend and decrypted only for authorized backend provider calls.
- MVP workspace session data is retained for 7 days by default and can be manually deleted by the user.
- The product must not implement or promise invisibility, screen-share evasion, browser focus evasion, proctoring evasion, or recording bypass behavior.
