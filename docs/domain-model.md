# Domain Model

The backend persistence model is represented in `prisma/schema.prisma` and mirrored by additive SQL
migrations in `apps/api/migrations/` while the MVP database layer matures. Application code should
use Prisma models for reads/writes; raw SQL should remain limited to migrations and the migration
runner.

## Entities

### `User`

- `id`: unique account identifier.
- key fields: email, display name, locale, created date.
- relationships: owns settings, provider credentials, workspaces/sessions, retained session artifacts, and consent grants.
- lifecycle/status: active, disabled, deleted.

### `UserSettings`

- `userId`: unique settings record and foreign key to the owning user.
- key fields: provider credential reference, primary language, response language, preferred programming language, transcription model, analysis model, microphone default, periodic screenshot default, code-practice context default, auto-scroll default, session timer minutes, and retention preference.
- relationships: belongs to one user.
- lifecycle/status: updated whenever the user changes default capture, AI, retention, or copilot preferences.

### `ConsentGrant`

- `id`: unique consent record.
- key fields: consent type, granted status, granted timestamp, revoked timestamp, version of consent text.
- relationships: belongs to one user and may apply to a session.
- lifecycle/status: granted, revoked, expired.

### `Session`

- `id`: unique live or historical session.
- key fields: workspace id, owner user id, title, status, started timestamp, ended timestamp, active capture client, active response clients, retention expiry timestamp, deleted timestamp.
- relationships: belongs to a workspace/user and contains capture events, transcript segments, summaries, insights, suggestions, and code copilot context.
- lifecycle/status: created, active, paused, revoked, error, ended, deleted.

### `CaptureDevice`

- `id`: local or server-known capture source identifier.
- key fields: device type, display name, platform, permission status.
- relationships: used by sessions and controlled by user settings.
- lifecycle/status: available, selected, disabled, unavailable.

### `CaptureEvent`

- `id`: unique capture event record.
- key fields: session id, event type, sequence, occurred timestamp, safe metadata.
- relationships: belongs to a session.
- lifecycle/status: persisted safe metadata only; raw audio and raw screenshots are not stored in this MVP ingestion path.

### `TranscriptSegment`

- `id`: unique transcript segment.
- key fields: text, start timestamp, end timestamp, confidence, source, language.
- relationships: belongs to a session and may reference a speaker.
- lifecycle/status: received, corrected, redacted, deleted.

### `Speaker`

- `id`: session-scoped speaker identifier.
- key fields: label, confidence, optional user-provided name.
- relationships: groups transcript segments within a session.
- lifecycle/status: unknown, inferred, renamed, merged.

### `Insight`

- `id`: unique generated insight.
- key fields: type, content, confidence, source context, generated timestamp.
- relationships: belongs to a session and may reference transcript segments or screen events.
- lifecycle/status: generated, dismissed, pinned, deleted.

### `Suggestion`

- `id`: unique suggested response or action.
- key fields: content, category, language, urgency, generated timestamp.
- relationships: belongs to a session and may reference transcript segments, insights, or code copilot context.
- lifecycle/status: generated, accepted, dismissed, revised.

### `ScreenCaptureEvent`

- `id`: unique permitted screen capture event.
- key fields: captured timestamp, source app or site, image reference, analysis status.
- relationships: belongs to a session and requires active screenshot and visual-analysis consent.
- lifecycle/status: captured, analyzed, redacted, deleted.

### `CodeCopilotContext`

- `id`: unique code-practice context record.
- key fields: programming language, explanation mode, problem context, generated guidance, status.
- relationships: belongs to a session and may produce `copilot.explanation` realtime output.
- lifecycle/status: inactive, active, paused, completed, discarded.

### `ProviderCredential`

- `id`: unique provider credential reference.
- key fields: provider name, encrypted credential ciphertext, encryption version, masked display value, validation status, last checked timestamp.
- relationships: belongs to a user and may be used by sessions according to settings and consent.
- lifecycle/status: unverified, valid, invalid, revoked, deleted.

### `AuditEvent`

- `id`: unique audit event.
- key fields: user id, optional session id, type, created timestamp, safe metadata.
- relationships: belongs to a user and may reference a session.
- lifecycle/status: immutable event log for consent, session, credential, and retention lifecycle actions.

### `Workspace`

- `id`: unique workspace or account workspace identifier.
- key fields: name, owner user id, active session ids, recent retained session ids.
- relationships: belongs to one user for MVP same-account access and contains sessions.
- lifecycle/status: active, archived, deleted.

## Invariants

- Capture events must not be processed unless the matching consent is granted and active.
- `capture.audio_chunk` is accepted only after the session is active through `capture.status`.
- Code copilot mode is off by default and only runs when explicitly enabled.
- Screenshot capture and visual analysis are separate permissions.
- Code copilot and screen/coding context capture require explicit active consent and visible active state.
- Provider credentials must be encrypted on the backend, decrypted only for authorized provider calls, and never stored in source files or logs.
- A session may have one or more Capture Mode clients and one or more Response Mode clients, but MVP assumes one active capture client.
- Response Mode access uses the same signed-in user account and workspace for MVP.
- Unexpected realtime failures must return safe generic messages, while provider failures return safe structured errors.
- Workspace session data is retained for 7 days by default unless the user manually deletes it sooner.
- Product behavior must not depend on invisibility, recording bypass, focus evasion, or proctoring evasion.

## Follow-Up Questions

- Which OpenAI-compatible transcription/generation models should be the production defaults after real-provider testing?
- Which production key-management service should replace the MVP env-key encryption approach when deployed?
- What storage, redaction, and size-limit policy should be used before broad screenshot/image context support?
