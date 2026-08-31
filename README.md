# Persuando

Persuando is a real-time contextual assistant for meetings, simulated interviews, technical study,
and coding practice.

The MVP uses two visible modes:

- Capture Mode: a Windows-first Electron app with a floating toolbar, tray behavior, microphone
  capture, consent controls, provider settings, and optional user-requested screen/code context.
- Response Mode: a Next.js web app that shows live transcripts, summaries, insights, suggested
  responses, topic context, and code-practice explanations.

The backend is a NestJS API with PostgreSQL, Prisma, native WebSocket realtime, Redis/BullMQ worker
boundaries, encrypted provider credentials, consent enforcement, and 7-day session retention with
manual delete.
## Code Practice Interview Script

Code Practice is a study simulation for technical assessments, not a stealth or proctoring feature. The `exercise` workflow focuses on public code problems, `repository` on visible repository/debugging work, and `design_system` on component or design-system practice.

For code-problem practice, the generated answer should read like a conversational interview walkthrough. It should put the complete solved code near the beginning, then make the spoken script visually prominent with `Fala para entrevista` blockquotes, starting from what the student understood about the problem and the objective. Each step should expose the current doubt, what to try next, why that choice moves the solution forward, and small realistic false starts corrected along the way. Google help should appear only as short search terms a candidate could reasonably use for preparation or allowed clarification.

## Local Setup

Use this guide when starting the whole app from zero on Windows.

### 1. Install Dependencies

Run once after cloning or after dependency changes:

```bash
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local`:

```bash
copy .env.example .env.local
```

Minimum local values:

```env
# Database and jobs
DATABASE_URL=postgres://persuando:persuando@localhost:15433/persuando
POSTGRES_HOST_PORT=15433
REDIS_URL=redis://localhost:6379

# Auth/session
AUTH_SESSION_SECRET=replace-with-a-long-random-secret
LOCAL_DEV_USER_ID=dev-user-1
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# Credential encryption
CREDENTIAL_ENCRYPTION_KEY=replace-with-a-32-byte-base64-key
CREDENTIAL_ENCRYPTION_KEY_VERSION=dev-v1

# Network boundaries
API_BASE_URL=http://localhost:4000
WEBSOCKET_URL=ws://localhost:4000/realtime
ALLOWED_ORIGINS=http://localhost:3100,app://persuando-capture

# Real OpenAI-compatible provider testing
PROVIDER_ADAPTER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1

# Retention and cleanup
SESSION_RETENTION_DAYS=7
RETENTION_CLEANUP_CRON=0 */2 * *
```

Generate local secrets in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Use one generated value for `AUTH_SESSION_SECRET` and another generated value for
`CREDENTIAL_ENCRYPTION_KEY`.

Do not commit `.env.local` or provider API keys.

### 3. Start Docker Infrastructure

Terminal 1:

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

Postgres runs on `localhost:15433` and Redis runs on `localhost:6379`.

### 4. Start The Backend API

Terminal 2:

```bash
npm.cmd run dev:api
```

Check the API:

```bash
curl http://localhost:4000/health
```

Expected:

```json
{"ok":true,"service":"persuando-api"}
```

### 5. Start The Worker

Terminal 3:

```bash
npm.cmd run dev:worker
```

Keep this terminal open. It runs background jobs for provider validation, assistance generation, and
retention cleanup.

### 6. Start Response Mode

Terminal 4:

```bash
npm.cmd run dev:response
```

Open:

```text
http://localhost:3100
```

### 7. Start Capture Mode

Terminal 5:

For normal local use:

```bash
npm.cmd run --workspace @persuando/capture start
```

For debugging Electron logs:

```bash
npm.cmd run --workspace @persuando/capture start:debug
```

Use `start:debug` when testing microphone upload, screenshots, toolbar behavior, or provider errors.

### 8. Sign In

Browser login:

```text
http://localhost:4000/auth/google
```

Capture App login:

1. Open the Capture App window.
2. Click `Sign in with Google`.
3. Complete Google login.
4. Confirm the Capture App shows your email.

During local development, browser login and Capture login can be separate, so sign in in both places
when testing the full flow.

### 9. Configure Provider Key

In Capture App:

1. Paste your OpenAI API key into `OpenAI-compatible API key`.
2. Click `Save key`.
3. Confirm the status becomes `valid`.

The API key is stored encrypted by the backend and should only appear masked in UI/API responses.

### 10. Grant Consent And Start Capture

In Capture App:

1. Enable required consent toggles.
2. Select your microphone.
3. Enable `Microphone capture default`.
4. Enable `Periodic screen context default` if you want screenshots.
5. Click `Start listening`.

Open `http://localhost:3100`, click the active session, and watch live updates.

### 11. Expected Logs

For audio transcription, the API terminal should show:

```text
[RealtimeService] Audio chunk received: ...
[RealtimeService] Transcription provider request: ...
[RealtimeService] Transcription provider response: ...
```

For periodic screenshots, debug the flow in this order. The worker terminal is not responsible for
screenshot upload; this path is Capture App -> API WebSocket -> Response App.

Capture debug terminal should show:

```text
[Persuando Capture] Periodic screen context evaluating: ... setting=true ... screenConsent=true codeConsent=true ...
[Persuando Capture] Periodic screen context started.
[Persuando Capture] Periodic screen context capture tick.
[Persuando Capture] captureScreenImageFallback called: ...
[Persuando Capture] Screen capture requested.
[Persuando Capture] Screen capture completed: ...
[Persuando Capture] Sending copilot.context: ... hasImage=true ...
[Persuando Capture] copilot.context sent: ...
```

API terminal should show:

```text
[RealtimeService] Copilot context access ok: ...
[RealtimeService] Copilot context received: ... hasImage=true ...
[RealtimeService] Copilot context consent check: ...
[RealtimeService] Copilot context persisted: ...
[RealtimeService] Realtime event appended: type=copilot.context ...
[RealtimeService] Copilot context fanout queued: ...
[RealtimeService] Periodic screen context accepted without generation: ...
```

Browser DevTools console in Response Mode should show:

```text
[Persuando Response] Realtime message received: ... eventTypes=copilot.context
[Persuando Response] Realtime event accepted: type=copilot.context ...
[Persuando Response] Applying copilot.context: ... hasImage=true ...
```

If Capture does not show `Periodic screen context evaluating`, the timer was not started. If Capture
shows `setting=false`, enable `Periodic screen context default` in Capture before starting. If Capture
shows `copilot.context sent` but API does not show `Copilot context received`, the WebSocket upload is
failing. If API receives it but Response does not apply it, the bug is in Response realtime/subscription.

### 12. Code Practice Visual Generation Diagnostics

Code Practice now uses the actual OpenAI-compatible provider response. It does not replace short,
invalid, or failed responses with hardcoded tutoring content. A malformed or empty provider response
is published as `PROVIDER_RESPONSE_INVALID` so the failure remains visible and debuggable.

The Response App retains the latest 30 screenshots, displays them newest-to-oldest, sends them
oldest-to-newest with a manual generation request, and replaces the oldest entry when a 31st
screenshot arrives. Session
history hydrates the same persisted window after a refresh. The panel shows the exact `N/30` count and marks the newest image. Code Practice first asks the provider to extract the exact platform contract, current attempt, and visible test results from all screenshots; a second provider call produces the tutoring answer using that analysis and up to four previous generated explanations. For a generation request, look for:

```text
[Persuando Response] Manual generation requested: ... screenContexts=30 imageReferences=30
[RealtimeService] Manual generation requested: ... screenContexts=30 imageReferences=30 previousGuidance=...
[OpenAiCompatibleProviderAdapter] Generation provider request: ... task=code_practice phase=visual_analysis ... imageCount=30
[OpenAiCompatibleProviderAdapter] Generation provider response: ... phase=visual_analysis ... contentLength=... durationMs=...
[OpenAiCompatibleProviderAdapter] Generation provider request: ... task=code_practice phase=answer ... previousGuidance=...
[OpenAiCompatibleProviderAdapter] Generation provider response: ... phase=answer ... contentLength=... durationMs=...
[RealtimeService] Manual Code Practice guidance persisted: ... guidanceLength=... previousGuidance=...
[RealtimeService] Manual generation completed: ... imageReferences=30 ...
```

On failure, the API logs `Manual generation failed` with the safe provider error code and the browser
receives `provider.error`. Use a newly created session for deployment smoke tests: screenshots stored
before this persistence fix may have kept only their text label, so their original image bytes cannot
be recovered.

### Response Realtime Deployment Diagnostics

If retained screenshots load but the page shows a live-update connection error, REST is working
while the browser WebSocket is not. Check the browser console for `Realtime socket error`; it now
shows the configured endpoint without query parameters. On the VPS, load `.env.local` before
building and before `pm2 restart --update-env`. The session page reads `WEBSOCKET_URL` at server
runtime, so a PM2 restart can correct the endpoint without compiling a localhost WebSocket fallback
into the client bundle.

### 13. Stop Everything

Stop app terminals with `Ctrl+C`.

Stop Docker containers:

```bash
docker compose down
```

Screenshot troubleshooting:

- Consent grants and feature toggles are separate. Consent allows screenshots; Periodic screen context default actually starts periodic screenshot capture.
- If the Capture debug log says periodicScreenshotCaptureDefault=false or Periodic screen context not started: setting disabled, enable Periodic screen context default in the Capture App Features panel and start capture again.
- If the feature is on, the debug log should show Screen capture requested, Screen capture completed, and Sending copilot.context with hasImage=true.

### Floating Capture Toolbar

- Hover any toolbar action to see what it does. Disabled actions keep their tooltip.
- The camera button is always visible. During an active listening session, click it or press `Ctrl+E` from any focused Windows app to capture and send the current screen context.
- If no session is listening, `Ctrl+E` opens the toolbar and logs that the screenshot was ignored instead of sending context without an active session.
- The Electron log reports whether `CommandOrControl+E` registered successfully and when the shortcut is received.
- Screenshots run every 5 seconds independently of `Session timer`, which is stored in minutes. Native Electron captures are sent as JPEG quality 70, and Response logs `transportLatencyMs` when each context arrives.

## Validation

Run the main checks:

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run format`
- `npm.cmd run test`

The current MVP slice also supports local scripted smoke testing over REST and `/realtime` WebSocket:
create a workspace/session, grant consent, activate capture, upload an audio chunk, receive transcript
and assistant events, send code-practice context, receive guidance, and manually delete the session.

## Product Guardrails

- Sensitive capture and provider processing require explicit consent.
- Consent must be visible and revocable.
- Provider keys must never be committed or logged.
- Code copilot is visible, opt-in, and positioned for study, preparation, and review.
- Persuando must not implement or market invisibility, screen-share bypass, recording bypass,
  browser focus evasion, proctoring evasion, platform-rule evasion, or cheating behavior.

## Docs And Spec Kit

Product context lives in `docs/`.

The active implemented MVP feature lives in:

- `specs/001-persuando-mvp/spec.md`
- `specs/001-persuando-mvp/plan.md`
- `specs/001-persuando-mvp/tasks.md`

Durable governance lives in:

- `.specify/memory/constitution.md`

Current handoff and next prompt:

- `docs/handoff.md`
- `docs/roadmap.md`
- `docs/next-spec-prompt.md`
### Code Practice provider diagnostics

Manual Code Practice generation logs a `generationId` across `visual_analysis` and `answer`. The request combines current Response contexts with the latest persisted/cache history, keeps the newest 30, and sends them chronologically. The Capture-selected programming language is authoritative. Visual-analysis JSON may be strict, fenced, or embedded; one parse-failure retry is allowed, while HTTP/auth/quota/network failures remain visible without generated fallback content. Use PM2 with `--nostream` when collecting logs so the command exits:

```bash
pm2 logs persuando-api --lines 500 --nostream | grep -E "Manual generation|Generation provider|generationId|invalid JSON|network request|HTTP request"
```
### Realtime screenshots and provider recovery

A received `copilot.context` event bypasses generation-panel filters in Response Mode. The screen-context list immediately scrolls to the top so the newest screenshot is visible without a refresh or manual scrolling.

Code Practice generation retries one transient network, HTTP 408/429, or HTTP 5xx failure after 500 ms. Provider logs include `attempt`, `retrying`, `httpStatus`, and a safe `causeCode`. The selected programming language overrides an unknown visual-language result. For public practice exercises, an answer without a non-empty fenced block in that language is retried once with a repair instruction; a second invalid answer becomes `PROVIDER_RESPONSE_INVALID` instead of being displayed as complete guidance.

Useful VPS filter:

```bash
pm2 logs persuando-api --lines 500 --nostream | grep -E "Manual generation|Generation provider|Provider network|Provider HTTP|missing required code|retrying"
```
### Switching coding exercises in one session

Code Practice groups the latest 30 screenshots by visible exercise title, URL, function signature, statement, and editor state. The newest identifiable exercise is active. Older screenshots and prior guidance are used only when they match that active exercise; evidence from another challenge is treated as stale context. When an exact public practice challenge is identifiable but the newest screenshot is partial, the tutor may use the established challenge contract, label the assumption, and must still provide the complete solution in the Capture-selected language. Big-O must be derived from the loops, traversals, recursion, and data structures in that proposed solution.

### Exclusive assistant modes and hot screen context

Each user selects one active mode in Capture: Conversation, Code Practice, or Exam Study. Conversation is the only mode that opens the microphone, creates an audio meter/recorder, and runs transcription/meeting assistance. Code Practice and Exam Study use screen context without requesting a microphone or creating an `AudioContext` media source, reducing provider traffic and latency.

Validated screenshot events are published to Response listeners immediately and retained in the API hot event state. The Response generation request includes its current newest 30 contexts, while the API also merges hot and persisted session context. Consequently, a screenshot can be displayed and used by the model before PostgreSQL persistence completes.

Image contexts are queued in memory and persisted in background batches every 2 seconds. The queue retries failed rows on a later flush and flushes again during API shutdown. Logs to monitor:

- `Screen context queued for background persistence`
- `copilot.context background persisted`
- `Screen context persistence flush completed`

### Code Practice Exercise And Repository Workflows

Code Practice now has two Response-mode workflows:

- `Exercise`: the default public-practice workflow for LeetCode/HackerRank-style single exercises. It keeps the existing two-phase visual grounding, requires the selected-language solution block when appropriate, and treats timers or test/exam wording as simulated practice context.
- `Repository`: a repository/debugging workflow for visible editor, terminal, test output, diffs, comments, and instructions. It treats screenshots as partial observable evidence, carries bounded incremental history from recent screen text and prior guidance, and must avoid claiming file searches, commands, or repository facts that were not visible.

The selected workflow is stored by Response Mode per session in browser local storage and is sent on every manual or automatic Code Practice generation request. The API also persists the workflow and incremental-history summary in the generated visual guidance metadata for later debugging. Repository mode does not enforce the single-exercise fenced-solution repair rule, because repository help may need patches, edits, commands, or diagnosis rather than one final solution block.

Manual generation is single-flight per `sessionId + mode + workflow` in both Response and the API. Duplicate clicks or Auto refreshes while a matching request is already running are skipped instead of sending repeated provider calls. Response Auto waits briefly after fresh screen context before requesting generation, allowing the latest screenshot batch to be included.

Response Mode renders Copilot Markdown through a safe Markdown renderer with HTML disabled and `highlight.js` syntax highlighting for fenced code blocks. Session detail panels can be expanded/focused from their header control and collapsed again with the same control or `Escape`.

Useful logs:

```text
[Persuando Response] Manual generation requested: ... mode=code_practice workflow=repository screenContexts=...
[Persuando Response] Manual generation skipped because one is already running: ... mode=code_practice workflow=repository
[RealtimeService] Manual generation requested: ... mode=code_practice workflow=repository ... incrementalHistory=... repositorySearch=false
[RealtimeService] Manual generation skipped because a matching request is already in flight: ... mode=code_practice workflow=repository
[OpenAiCompatibleProviderAdapter] Generation provider request: ... task=code_practice phase=visual_analysis ... workflow=repository ... incrementalHistory=...
[OpenAiCompatibleProviderAdapter] Generation provider request: ... task=code_practice phase=answer ... workflow=repository ... incrementalHistory=...
```

Repository-mode smoke should use a new session, select Code Practice, switch the panel to `Repository`, capture the visible editor plus terminal/test output, request guidance, then verify the answer labels observable evidence, distinguishes current versus stale context, proposes concrete changes, and does not invent unseen files, command output, or repository-wide searches.

### Code Practice Interview-Style Workflows

Code Practice now exposes three study workflows in Response Mode:

- `Code Problem` (`exercise`): algorithm/platform problems. The answer must frame the session as simulated technical-assessment preparation for study, diagnose the current attempt, explain the chosen approach like an interview, build the solution in parts, call out small corrected pitfalls, and still end with the complete final solution in the selected language when the context is public practice/self-study.
- `Repository` (`repository`): repository/debugging work from visible editor, terminal, tests, diffs, comments, and instructions. The answer must use only observable evidence, continue incrementally from prior guidance, explain the chosen fix like an interview, propose step-by-step edits, and include the complete relevant final function/component/patch section when evidence is sufficient.
- `Design System` (`design_system`): component-library and UI-system work from visible components, props, variants, tokens, styles, stories, tests, accessibility notes, and visual diffs. The answer must explain component API, token/styling, accessibility, states, trade-offs, corrected pitfalls, validation checks, and final code or patch shape.

All three workflows remain explicitly study/preparation simulations. False starts are teaching notes only: the final code should be clean, complete, and not intentionally wrong. Repository and Design System modes must not claim unseen repository search, design-file access, command output, files, exact line numbers, hidden tests, or tokens unless that evidence is visible or provided by a real tool.

Useful logs now include `workflow=exercise`, `workflow=repository`, or `workflow=design_system` across Response, realtime, and provider phases.

