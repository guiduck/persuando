# VPS Deployment Guide

This guide describes the current practical deployment shape for Persuando.

## What Runs On The VPS

Run these services on the VPS:

- Persuando API on Node/NestJS.
- Persuando worker for BullMQ jobs.
- Persuando Response App on Next.js.
- PostgreSQL and Redis through Docker Compose.

Do not run the Electron Capture App on the VPS. Capture Mode must run on the Windows machine where the microphone and screen are captured. The VPS hosts the backend and Response Mode; the Windows app connects to the VPS API/WebSocket.

## Suggested Ports

Use non-default host ports if the VPS already has other Docker projects:

- PostgreSQL host port: `55433`
- Redis host port: `56379`
- API port: `4100`
- Response App port: `3100` or `3101`

The Docker Compose file supports `POSTGRES_HOST_PORT` and `REDIS_HOST_PORT`.

## VPS Setup

SSH into the VPS:

```bash
ssh root@216.158.236.156
mkdir -p /srv/projects/persuando
cd /srv/projects/persuando
```

Clone or copy the repo into `/srv/projects/persuando`.

Install runtime dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and edit it:

```bash
cp .env.example .env.local
nano .env.local
```

Example VPS `.env.local` without a domain:

```env
DATABASE_URL=postgres://persuando:persuando@localhost:55433/persuando
POSTGRES_HOST_PORT=55433
REDIS_HOST_PORT=56379
REDIS_URL=redis://localhost:56379

AUTH_SESSION_SECRET=replace-with-a-long-random-secret
LOCAL_DEV_USER_ID=dev-user-1
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://216.158.236.156:4100/auth/google/callback

CREDENTIAL_ENCRYPTION_KEY=base64-32-byte-key
CREDENTIAL_ENCRYPTION_KEY_VERSION=dev-v1

API_BASE_URL=http://216.158.236.156:4100
WEBSOCKET_URL=ws://216.158.236.156:4100/realtime
ALLOWED_ORIGINS=http://216.158.236.156:3100,app://persuando-capture

PROVIDER_ADAPTER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1

SESSION_RETENTION_DAYS=7
RETENTION_CLEANUP_CRON="0 */2 * * *"
LOG_LEVEL=info
LOG_REDACT_KEYS=apiKey,authorization,credential,ciphertext,decryptedSecret,audio,providerPayload,transcript
```

For real production, prefer a domain with HTTPS and update these values:

```env
GOOGLE_CALLBACK_URL=https://api.your-domain.com/auth/google/callback
API_BASE_URL=https://api.your-domain.com
WEBSOCKET_URL=wss://api.your-domain.com/realtime
ALLOWED_ORIGINS=https://your-domain.com,app://persuando-capture
```

Current `gfig.space` production-style values:

```env
GOOGLE_CALLBACK_URL=https://api-persuando.gfig.space/auth/google/callback
API_BASE_URL=https://api-persuando.gfig.space
WEBSOCKET_URL=wss://api-persuando.gfig.space/realtime
ALLOWED_ORIGINS=https://persuando.gfig.space,app://persuando-capture
```

Google OAuth must have the exact callback URL registered in Google Cloud Console.

For the current `gfig.space` deployment, add this authorized redirect URI to the Google OAuth web client:

```text
https://api-persuando.gfig.space/auth/google/callback
```

The OAuth callback intentionally lands on the API first. The API creates a short-lived one-time login bridge code, redirects the browser to the Response App at `/auth/complete`, and the Response App exchanges that code with `/auth/bridge/consume` to set its own host-only login cookie. This keeps the API and Response cookies separated without putting the signed session token in the URL. The bridge code is currently in memory and assumes one API process; use Redis/PostgreSQL for this handoff before running multiple API instances.

## Start Infrastructure

```bash
docker compose --env-file .env.local up -d
```

Check containers:

```bash
docker compose ps
```

## Build The Apps

```bash
npm run build
NEXT_PUBLIC_API_BASE_URL=http://216.158.236.156:4100 \
NEXT_PUBLIC_WEBSOCKET_URL=ws://216.158.236.156:4100/realtime \
npm run --workspace @persuando/response build
```

If using a domain, replace the URLs with HTTPS/WSS values before building Response Mode.

## Run With PM2

Install PM2 once:

```bash
npm install -g pm2
```

Load env vars and start API, worker, and Response Mode:

```bash
set -a
source .env.local
set +a

PORT=4100 pm2 start npm --name persuando-api -- run start:api
pm2 start npm --name persuando-worker -- run start:worker
PORT=3100 NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL NEXT_PUBLIC_WEBSOCKET_URL=$WEBSOCKET_URL pm2 start npm --name persuando-response -- run start:response
pm2 save
```

After pulling code or changing `.env.local`, reload the shell environment and restart the PM2 processes with updated env vars:

```bash
set -a
source .env.local
set +a

pm2 restart persuando-api --update-env
pm2 restart persuando-worker --update-env
pm2 restart persuando-response --update-env
pm2 save
```

Check status and logs:

```bash
pm2 status
pm2 logs persuando-api
pm2 logs persuando-worker
pm2 logs persuando-response
```

Health check:

```bash
curl http://216.158.236.156:4100/health
```

Open Response Mode:

```text
http://216.158.236.156:3100
```

## Electron Capture App

The Electron app is not deployed to the VPS. It runs on the Windows machine that captures microphone and screen context.

To run Capture locally against the VPS domain:

```bash
npm.cmd run capture:start:vps
```

To build a Windows unpacked app folder:

```bash
npm.cmd run capture:pack:win
```

Output:

```text
release/capture/win-unpacked/Persuando Capture.exe
```

To build a Windows installer:

```bash
npm.cmd run capture:dist:win
```

Output:

```text
release/capture/Persuando-Capture-Setup-0.1.0.exe
```

The current installer is suitable for local smoke testing. Production distribution still needs app icon, publisher/signing decisions, update strategy, and release-channel policy.
