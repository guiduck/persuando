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

### 12. Stop Everything

Stop app terminals with `Ctrl+C`.

Stop Docker containers:

```bash
docker compose down
```

Screenshot troubleshooting:

- Consent grants and feature toggles are separate. Consent allows screenshots; Periodic screen context default actually starts periodic screenshot capture.
- If the Capture debug log says periodicScreenshotCaptureDefault=false or Periodic screen context not started: setting disabled, enable Periodic screen context default in the Capture App Features panel and start capture again.
- If the feature is on, the debug log should show Screen capture requested, Screen capture completed, and Sending copilot.context with hasImage=true.

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





