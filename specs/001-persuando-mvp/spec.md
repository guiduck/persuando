# Feature Specification: Persuando MVP

**Feature Branch**: `001-persuando-mvp`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: `docs/next-spec-prompt.md` as the `speckit.specify` prompt before closeout advanced it to
`speckit.plan`

## Summary

Persuando MVP enables a user to run a consent-based meeting and practice assistant through a
Windows desktop Capture App with a compact floating toolbar and a separate or same-machine Response
Mode. The MVP focuses on the core live assistance loop: sign in with Google, configure provider and
session settings, grant explicit consent, capture microphone audio, optionally enable visible
periodic screenshot/context capture and code/practice context, stream authorized session events
through the backend, and show live transcripts, incremental summaries, topic explanations, keyword
definitions, direct suggested responses, and code-practice explanations.

This specification preserves Persuando's two-mode architecture and responsible-use boundary. It does
not include robust system-audio capture, automatic coding-platform detection, local/offline models,
non-Windows desktop apps, or any invisibility/evasion capability. Code copilot is included in the MVP
only as a visible, consent-gated study/practice feature.

## Goals

- Let a user run Capture Mode on Windows through a compact floating toolbar and keep it available
  from the tray.
- Let a user configure provider credentials, language preferences, capture defaults, and retention.
- Require explicit, revocable consent for microphone capture, transcription, backend transmission,
  external AI provider use, code copilot mode, and any screen/coding context sent for copilot.
- Stream authorized microphone transcription from Capture Mode to the backend in real time.
- Let one or more authenticated Response App clients view the active session on another browser or
  device through the same signed-in user account.
- Display live transcript segments, incremental summary, topic/keyword explanations, meeting
  insights, and direct suggested responses.
- Provide visible, opt-in code copilot assistance for study, coding practice, preparation, and
  review.

## Non-Goals

- Building or marketing Persuando as invisible, undetectable, or hidden.
- Bypassing screen sharing, recording, browser focus detection, proctoring tools, or platform rules.
- Cheating in interviews, assessments, or coding challenges.
- Robust system-audio capture.
- Stealth screenshot capture, invisible visual analysis, automatic app/site detection, or screen
  context processing without explicit consent and visible active state.
- Advanced diarization.
- Local/offline AI models.
- Native desktop apps beyond the Windows Electron Capture App.
- Choosing Fastify vs NestJS inside the feature spec; the planning artifact owns that decision.
- Defining implementation tasks, schemas, or detailed service architecture.

## User Stories And Tests

### User Story 1 - Start A Consented Toolbar Capture Session (Priority: P1)

As a user in a meeting, I want to sign in to the Windows Capture App, use a small floating toolbar,
choose my microphone, grant required consent, and start capture so that Persuando can transcribe
authorized audio without forcing a large window to stay open.

**Why this priority**: Without a consented capture session, no other MVP workflow can produce value.

**Independent Test**: From a fresh signed-in Capture App state, the user can show the floating
toolbar, select a microphone, grant consent for microphone capture, transcription, backend
transmission, and provider use, start capture, see active-capture status and timer in the toolbar,
pause capture, revoke consent, hide/show the toolbar from the tray, and end the session.

**Acceptance Scenarios**:

1. Given the user is signed in and no capture is active, when they start microphone capture, then the
   app requests or confirms every required consent before audio is captured or transmitted.
2. Given capture is active, when the user pauses capture from the app or tray, then microphone
   capture stops and the session status changes to paused.
3. Given capture is active, when the user revokes a required consent, then capture and related
   processing stop immediately and the user sees the revoked state.
4. Given the user closes the Capture App window, when the app is configured to run in background,
   then it remains available in the Windows tray instead of ending the process.
5. Given the toolbar is hidden while capture is active, when the user clicks the Windows tray icon,
   then the toolbar can be restored without interrupting the active session.

---

### User Story 2 - Configure Settings And Provider Access (Priority: P1)

As a user, I want to configure provider credentials, languages, capture defaults, and retention
preferences so that session assistance respects my account, privacy, and output preferences.

**Why this priority**: The MVP depends on user-controlled provider access, explicit retention, and
language preferences before capture and AI processing can be trusted.

**Independent Test**: The user can open settings, enter a user-owned provider key, select a provider,
test the provider connection, choose primary and response languages, set capture defaults, choose a
retention preference, save settings, and see validation errors without exposing secrets.

**Acceptance Scenarios**:

1. Given the user enters a provider key, when they save settings or test the connection, then the key
   is never displayed in full after save and is never written to logs.
2. Given provider validation fails, when the user tests the connection, then the UI shows a safe,
   actionable error without exposing the credential or raw provider payload.
3. Given the user changes retention preference, when a new session starts, then the session uses the
   selected retention behavior.
4. Given the user changes response language, when suggestions are generated, then suggestions prefer
   that language where provider output is available.

---

### User Story 3 - View Live Assistance In Response Mode (Priority: P1)

As a user on the same machine, another browser, or another device, I want to open Response Mode for
my active session so that I can follow the transcript, summary, explanations, and suggested
responses while the meeting continues.

**Why this priority**: Response Mode is the primary user-facing value surface for live assistance.

**Independent Test**: With an active Capture Mode session, an authenticated Response Mode client can
join the session, receive live transcript updates, see incremental summary updates, view topic and
keyword explanations, view direct suggested responses to questions, and observe active, paused,
ended, and error states.

**Acceptance Scenarios**:

1. Given a session is active, when the Response App joins the session, then it displays session
   status and live transcript segments as they arrive.
2. Given transcript content has accumulated, when summary processing succeeds, then the Response App
   displays an incremental summary connected to the current session.
3. Given enough meeting context exists, when suggestion processing succeeds, then the Response App
   displays concise suggested responses, topic explanations, keyword definitions, questions, risks,
   or follow-up actions.
4. Given Capture Mode pauses or ends the session, when the backend broadcasts the state, then the
   Response App updates its status without implying capture is still active.

---

### User Story 4 - Preserve Safety Boundaries During Session Use (Priority: P1)

As a user and product owner, I want Persuando to make active capture and AI processing clear and
controllable so that the product remains consent-based and responsible.

**Why this priority**: The constitution requires safety and responsible-use boundaries to be
first-class requirements, not follow-up polish.

**Independent Test**: Every active sensitive capability has visible status, can be paused or stopped,
and cannot run without active consent. Deferred capabilities are not available as hidden MVP modes.

**Acceptance Scenarios**:

1. Given microphone capture is active, when the user views Capture Mode or tray controls, then active
   capture status is visible.
2. Given external provider processing is enabled, when the user views consent or settings, then the
   provider-use consent is visible and revocable.
3. Given code copilot or screen/coding context capture options are visible in any MVP UI, then they
   are off until the user explicitly grants consent and their active state is visible.
4. Given a user attempts to start a sensitive capability without required consent, then the system
   blocks activation and explains which consent is required.

---

### User Story 5 - Use Visible Code Copilot For Practice (Priority: P1)

As a user practicing a coding exercise or technical interview, I want to explicitly enable code
copilot mode so that Persuando can explain the problem, summarize relevant context, and suggest
study/practice guidance without hiding capture or bypassing platform rules.

**Why this priority**: The MVP is incomplete without the copilot path; it is a first-class use case
alongside meeting assistance.

**Independent Test**: The user can enable code copilot mode only after granting consent for code
copilot, screen/coding context capture, backend transmission, and external provider use; the active
state is visible; the Response App shows explanations and practice guidance; revoking consent stops
copilot processing.

**Acceptance Scenarios**:

1. Given code copilot is off, when the user enables it, then the app requests every required consent
   before any screen/coding context is captured or transmitted.
2. Given code copilot is active, when the user views Capture Mode or tray controls, then copilot
   active status is visible and can be paused or stopped.
3. Given code copilot context is received, when provider processing succeeds, then Response Mode
   displays explanations, hints, tradeoffs, and practice-oriented guidance.
4. Given the user revokes code copilot or screen/coding context consent, then copilot capture and AI
   processing stop immediately.

## Functional Requirements

### Capture Mode

- **FR-001**: The system MUST provide a Windows-first desktop Capture App experience.
- **FR-001a**: The Capture App MUST provide a compact floating toolbar as the primary live capture
  surface.
- **FR-001b**: The floating toolbar MUST support visible controls for dashboard/home, ask/respond,
  start listening, pause/resume, stop/end session, current assistant/session mode, and recording
  timer/status.
- **FR-001c**: The floating toolbar MUST be hideable and restorable from the Windows tray without
  ending an active session.
- **FR-002**: The Capture App MUST support authenticated user sign-in before starting a session.
- **FR-002a**: The MVP MUST support Google login as the real auth provider from the start.
- **FR-003**: The Capture App MUST let the user create or connect to an active session.
- **FR-004**: The Capture App MUST let the user select an available microphone capture device.
- **FR-005**: The Capture App MUST request or confirm consent before microphone capture starts.
- **FR-006**: The Capture App MUST request or confirm consent before audio transcription starts.
- **FR-007**: The Capture App MUST request or confirm consent before transmitting session events to
  the backend.
- **FR-008**: The Capture App MUST request or confirm consent before external AI provider usage.
- **FR-009**: The Capture App MUST show clear active, paused, revoked, error, and ended capture
  states.
- **FR-010**: The Capture App MUST allow the user to pause, resume, and end microphone capture.
- **FR-011**: The Capture App MUST allow the user to revoke consent for active sensitive modes.
- **FR-012**: Closing the Capture App main window SHOULD minimize the app to the Windows tray
  instead of quitting.
- **FR-013**: The Windows tray controls MUST expose current status, show or hide toolbar, open
  dashboard/settings, start or stop audio capture, pause or resume capture, end session, and quit.
- **FR-014**: The Capture App MUST NOT capture screenshots, perform visual analysis, detect apps or
  sites, or activate code copilot mode without explicit consent and visible active state.
- **FR-014a**: The Capture App MUST support opt-in code copilot mode for study, practice,
  preparation, and review.
- **FR-014b**: The Capture App MUST support authorized periodic screenshot/context capture only
  while matching consent is active and the active state is visible.

### Settings And Consent

- **FR-015**: The system MUST provide settings for provider selection and user-owned provider API key
  entry.
- **FR-016**: The system MUST provide a provider connection test that reports success or safe failure.
- **FR-017**: The system MUST provide settings for primary language, response language, and preferred
  programming language.
- **FR-017a**: The system MUST provide transcription model selection and, where supported, analysis
  model selection for the configured provider.
- **FR-018**: The system MUST provide capture defaults for microphone capture and deferred advanced
  capture modes.
- **FR-019**: The system MUST provide explicit retention preferences before retained session data is
  stored beyond the active session.
- **FR-020**: The system MUST store consent grant status separately enough to distinguish granted,
  revoked, expired, and missing consent.
- **FR-020a**: The system MUST provide configurable shortcuts for start/stop listening, ask/respond,
  capture screenshot/context, show/hide toolbar, and open dashboard/settings.
- **FR-020b**: The system SHOULD provide auto-scroll and optional session timer settings for live
  Response Mode use.
- **FR-021**: The system MUST avoid displaying saved provider credentials in full.
- **FR-022**: The system MUST NOT write provider credentials, secrets, or full user API keys to logs.
- **FR-022a**: The system MUST store user-owned provider credentials encrypted on the backend for
  the user's account.
- **FR-022b**: Only backend provider-orchestration code MAY decrypt provider credentials, and only
  when needed for an authorized provider call.

### Backend Session And Realtime Behavior

- **FR-023**: The backend MUST authenticate users before allowing session creation, event ingestion,
  or Response App session access.
- **FR-024**: The backend MUST enforce session membership before broadcasting session events.
- **FR-025**: The backend MUST accept authorized Capture Mode events for the active session.
- **FR-026**: The backend MUST reject capture, transcription, provider, or retention actions that do
  not have the required active consent.
- **FR-027**: The backend MUST fan out session status and transcript updates to authorized Response
  App clients in real time.
- **FR-028**: The backend MUST support one active Capture Mode client per MVP session.
- **FR-029**: The backend SHOULD support one or more Response App clients observing the active
  session.
- **FR-030**: The backend MUST apply the selected retention preference to transcript segments,
  summaries, insights, suggestions, and provider payload records.
- **FR-030a**: The backend MUST support live, low-latency microphone audio upload from Capture Mode
  for backend-orchestrated transcription.
- **FR-030b**: The backend MUST retain MVP workspace session data for 7 days by default unless the
  user manually deletes it sooner.
- **FR-030c**: The backend MUST provide a user-accessible delete action for retained workspace
  session data.
- **FR-030d**: The backend MUST reject code copilot, screen/coding context, or visual-context
  processing unless matching consent grants are active.

### Response Mode

- **FR-031**: The system MUST provide an authenticated web Response App.
- **FR-032**: The Response App MUST let the same signed-in user join an authorized active session
  from another browser or device.
- **FR-033**: The Response App MUST display live session status.
- **FR-034**: The Response App MUST display live transcript segments.
- **FR-035**: The Response App MUST display incremental summaries when available.
- **FR-036**: The Response App MUST display meeting insights when available.
- **FR-037**: The Response App MUST display suggested responses, questions, risks, or follow-up
  actions when available.
- **FR-037b**: The Response App MUST display topic extraction, keyword definitions, and
  plain-language explanations when available.
- **FR-037c**: The Response App SHOULD automatically generate useful explanations and suggestions
  from new events instead of relying on repeated prompt-button clicks.
- **FR-037a**: The Response App MUST display code-practice explanations, hints, tradeoffs, and review
  guidance when code copilot mode is active and provider output is available.
- **FR-038**: The Response App MUST show loading, empty, paused, ended, and error states.
- **FR-039**: The Response App MUST avoid implying that capture or provider processing is active
  after the session is paused, ended, or consent is revoked.
- **FR-039a**: When joining an in-progress session, the Response App MUST receive current session
  state plus retained transcript and chat history permitted by the retention setting.
- **FR-039b**: When joining an in-progress session, new insights and suggested responses SHOULD be
  generated from new events after join time while using retained history as context.

### Responsible Use And Deferred Scope

- **FR-040**: The product MUST NOT include features or language that promise invisibility,
  undetectability, screen-share evasion, recording bypass, focus-detection bypass, proctoring
  evasion, platform-rule evasion, or cheating.
- **FR-041**: Code copilot mode MUST remain off by default and require explicit opt-in consent before
  activation.
- **FR-042**: Any visible reference to screenshot, visual-analysis, app-detection, or code copilot
  capabilities MUST avoid invisibility, evasion, bypass, proctoring, platform-rule evasion, or
  cheating claims.

## Key Entities

- **User**: Owns settings, provider credentials, consent grants, and sessions.
- **UserSettings**: Stores language preferences, capture defaults, provider selection, and retention
  preference.
- **ConsentGrant**: Records whether a specific sensitive capability is granted, revoked, expired, or
  missing.
- **ProviderCredential**: References a user-owned provider credential encrypted on the backend for
  the user's account, without exposing the secret value in logs or UI.
- **Session**: Represents a live or historical Capture Mode / Response Mode session.
- **CaptureDevice**: Represents a selectable local microphone device and its permission status.
- **TranscriptSegment**: Represents a received or processed unit of session transcript.
- **Insight**: Represents generated meeting context such as risks, objections, or notable points.
- **Suggestion**: Represents generated response suggestions, questions, or follow-up actions.
- **SessionRetentionPolicy**: Represents the user's selected retention behavior for session data and
  generated artifacts.
- **CodeCopilotContext**: Represents authorized coding-practice context, explanation mode, selected
  programming language, captured prompt/problem context, and generated study guidance for a session.
- **ScreenCaptureEvent**: Represents authorized screen/coding context captured while code copilot
  consent is active.

## Edge Cases

- User starts capture before granting all required consent.
- User revokes consent while audio capture, transcription, or provider processing is in progress.
- Microphone permission is denied by the OS or the selected device becomes unavailable.
- Provider key is missing, invalid, revoked, rate-limited, or out of quota.
- Provider response is slow, partial, malformed, or unavailable.
- Realtime connection drops between Capture Mode and backend.
- Realtime connection drops between backend and Response Mode.
- Response App joins after the session has already started and needs current state plus recent
  context.
- Multiple Response App clients join the same session.
- A second Capture Mode client attempts to become active for the same MVP session.
- The user closes the Capture App window while capture is active.
- The user quits the Capture App from the tray while capture is active.
- Retention preference changes during an active session.
- User manually deletes a retained workspace session before the 7-day retention window ends.
- User starts code copilot before granting required consent.
- User revokes code copilot or screen/coding context consent during provider processing.
- Screen/coding context is unavailable, unreadable, or too stale to use safely.
- Transcript content is empty, low confidence, or in a language different from the selected primary
  language.
- AI suggestions are low confidence or based on incomplete transcript context.

## Assumptions

- The first desktop target is Windows.
- Capture Mode is implemented as an Electron, React, and TypeScript app.
- Response Mode is implemented as a Next.js, React, and TypeScript web app.
- Backend services use Node.js; `specs/001-persuando-mvp/plan.md` selects NestJS.
- PostgreSQL is the persistence target for users, settings, sessions, consent grants, and retained
  session artifacts.
- Redis/BullMQ may be used for background work during planning but is not selected in this spec as a
  detailed implementation requirement.
- Realtime transport is defined by `specs/001-persuando-mvp/plan.md`, which selects native
  WebSocket.
- Users may provide their own OpenAI-compatible provider credentials.
- Microphone transcription is sufficient for MVP validation.
- Response Mode access is based on the same signed-in account; pairing codes and share links are out
  of MVP scope.
- Google login is the real MVP auth provider.
- Code copilot is in MVP as a visible, opt-in, consent-gated study/practice feature.
- Screenshot/screen context capture is allowed only as visible, consented code copilot input.

## Success Metrics

- A first-time user can sign in, configure provider settings, grant required consent, and start a
  microphone capture session without developer assistance.
- Capture Mode status changes are reflected in Response Mode within a realtime interaction window
  acceptable for live meeting use.
- Live transcript updates appear in Response Mode while Capture Mode is active.
- The user can pause capture, revoke consent, or end a session and see both Capture Mode and Response
  Mode reflect the new state.
- Provider credentials are not exposed in UI after save and do not appear in logs during validation,
  capture, transcription, summary, or suggestion flows.
- Retained workspace session data is available for 7 days by default and can be manually deleted by
  the user.
- MVP screens and copy contain no invisibility, evasion, bypass, proctoring, or cheating claims.
- Code copilot can be enabled with explicit consent and produces useful practice-oriented
  explanations without hiding active capture.

## Clarifications

### Resolved For This Spec

- MVP scope is the meeting assistant loop, not the advanced context roadmap.
- Microphone capture is the first supported capture source.
- Capture Mode uploads live microphone audio to the backend for low-latency backend-orchestrated
  transcription.
- One active Capture Mode client per session is enough for MVP.
- Multiple Response App clients may observe the same authorized session when authenticated as the
  same user account.
- Provider credentials are stored encrypted on the backend and decrypted only by backend
  provider-orchestration code for authorized provider calls.
- Workspace session data is retained for 7 days by default and can be manually deleted by the user.
- Response Mode receives current state, transcript history, and chat history when joining an
  in-progress session; new insights and suggested responses are generated from new events after join
  time while using history as context.
- Google login is required as the real auth provider from the start.
- Code copilot is part of the MVP and must be implemented as visible, opt-in, consent-gated
  study/practice assistance.
- Screen/coding context capture is part of MVP only as a visible code copilot input with explicit
  consent.
- Backend framework is resolved by `specs/001-persuando-mvp/plan.md` as NestJS.
- Realtime transport is resolved by `specs/001-persuando-mvp/plan.md` as native WebSocket.

### Needs Planning Decision

- Exact transcription provider behavior and fallback model.
- Exact encryption mechanism, key-management approach, and secret rotation policy for backend-stored
  provider credentials.
- Exact Google auth library/provider configuration.
- Exact screen/coding context capture mechanism and payload shape for code copilot.
- Exact retention cleanup job timing and manual delete behavior.
- Exact persistence schema and event payload contracts.

## Acceptance Criteria

- **AC-001**: A user can create an MVP session from the Windows Capture App only after signing in and
  granting consent for microphone capture, transcription, backend transmission, and external provider
  use.
- **AC-002**: The Capture App can be closed to tray while preserving visible status and controls.
- **AC-003**: The user can pause, resume, revoke consent, end capture, and quit from appropriate app
  or tray controls.
- **AC-004**: An authenticated Response App client can join the active session and see live status,
  transcript, summaries, insights, and suggestions when available.
- **AC-005**: The system blocks capture or processing when required consent is missing, revoked, or
  expired.
- **AC-006**: The system handles missing microphone permission, unavailable device, provider failure,
  and realtime disconnects with clear user-facing states.
- **AC-007**: Saved provider credentials are masked or hidden in the UI and excluded from logs.
- **AC-008**: Retained workspace session data is kept for 7 days by default and can be manually
  deleted by the user.
- **AC-009**: No MVP path activates screenshots, visual analysis, app/site detection, robust
  system-audio capture, advanced diarization, or code copilot mode without explicit consent and
  visible active state.
- **AC-010**: Product copy and behavior comply with the responsible-use boundary in the constitution.
- **AC-011**: A Response App client joining late receives session history and current state, then
  receives new insights and suggested responses for new events while using that history as context.
- **AC-012**: A user can enable code copilot with explicit consent and receive practice-oriented
  explanations in Response Mode.

## Spec Review Checklist

- User value is explicit.
- Capture Mode, Response Mode, and backend ownership are separated.
- Consent, revocation, visibility, and retention are first-class requirements.
- Responsible-use non-goals are explicit.
- Backend framework and realtime transport are resolved in the plan; provider specifics remain for
  implementation planning/tasks.
- Advanced context features remain deferred.
- No implementation task breakdown is included.
