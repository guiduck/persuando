# Persuando MVP Prototype Flow

This reference flow is the current navigable prototype contract for the production MVP. It is based
on `docs/`, `docs/lovable-prompt-base.md`, `docs/reference-ui.md`, and the implemented Capture and
Response apps.

## Entry Points

1. Capture App dashboard: `npm run --workspace @persuando/capture start`
2. Response App workspace: `http://localhost:3100`
3. Backend auth entry: `http://localhost:4000/auth/google`

## Flow A: First-Time Setup

1. User opens Capture dashboard.
2. User signs in with Google.
3. User saves an OpenAI-compatible API key.
4. App masks the key after save and shows validation status.
5. User chooses transcription model, analysis model, primary language, response language, preferred
   programming language, session timer, and capture defaults.
6. User grants explicit consent for microphone capture, transcription, backend transmission,
   external provider usage, retention, screen/code context, and code practice.

Production status:

- Implemented in Capture settings UI and backend settings/credentials/consent endpoints.
- Global consent now applies to live sessions unless a session-specific grant overrides it.

## Flow B: Live Capture

1. User chooses a microphone.
2. User clicks Start listening from dashboard, toolbar, or tray menu.
3. Capture creates a backend session.
4. Capture opens a native WebSocket as a Capture client.
5. Capture requests microphone permission with `getUserMedia`.
6. Capture uses `MediaRecorder` to send `capture.audio_chunk` events.
7. User can pause, resume, end, hide toolbar, show toolbar, open dashboard, capture context, or
   revoke capture from visible controls.

Production status:

- Implemented with Electron main/preload/renderer split, floating toolbar, tray menu commands,
  visible status, timer, pause/resume, and WebSocket microphone upload.

## Flow C: Response Mode

1. User opens Response App signed in to the same Google account.
2. Workspace shows active and retained sessions.
3. User opens the live session.
4. Response fetches retained history over REST.
5. Response subscribes over `/realtime`, receives replayed events, sends `response.ack`, and keeps
   receiving live transcript, summary, insights, suggestions, provider errors, and delete state.
6. Late joiners see retained history as context; new insights/suggestions are visually marked as
   new only after join.

Production status:

- Implemented in Next.js App Router session pages and client WebSocket component.

## Flow D: Context And Code Practice

1. User starts listening with the toolbar visible.
2. User types a context prompt or clicks Capture screen.
3. Capture sends visible, user-requested `copilot.context`.
4. Backend checks code copilot, screen/code context, backend transmission, and provider consent.
5. Response receives `copilot.explanation` and shows it in Code practice.

Production status:

- Implemented for visible text context and user-requested screen context capture.
- Future specs may improve image storage/redaction; hidden automatic capture remains forbidden.

## Flow E: Retention And Delete

1. Sessions are retained for 7 days by default.
2. Response App can delete a retained session with confirmation.
3. Deleted sessions are removed from visible workspace/session access and future AI context.
4. Retention cleanup is idempotent.

Production status:

- Implemented in backend retention/manual delete and Response delete UI.

## Validation Matrix

| Area | Prototype Expectation | Production Evidence |
| --- | --- | --- |
| Capture settings | Provider key, models, languages, defaults, shortcuts, consent | `apps/capture/src/renderer/main.tsx` |
| Floating toolbar | Start, pause, resume, ask, screen context, end, timer, hide/show | `apps/capture/src/renderer/main.tsx` |
| Tray/background | Close-to-tray, status menu, show/hide, dashboard, start/end, pause/resume, quit | `apps/capture/src/main.ts` |
| Realtime | Native WebSocket, subscribe, ack, replay, fan-out | `apps/api/src/modules/realtime/` |
| Response live session | History plus live transcript/summary/insights/suggestions/errors/delete | `apps/response/src/app/sessions/[sessionId]/` |
| Responsible use | No invisibility, bypass, proctoring evasion, or cheating claims | `apps/*/test/*ui.test.mjs` |

## Open Prototype Notes

- The Capture UI is functional but still visually minimal.
- Screen context currently sends an in-memory data URL through the realtime event; future production
  hardening should add storage/redaction limits before broad usage.
- Robust system-audio capture, automatic app/site detection, and hidden capture are still outside
  MVP scope.
