# VPS Deployment Guide

This guide describes the current practical deployment shape for Persuando.

## Atualizar esta alteração de Repository na VPS

Este procedimento usa o destino já documentado: `root@216.158.236.156`, checkout em
`/srv/projects/persuando`, branch `master`, API `4100`, Response `3100`, processos PM2
`persuando-api`, `persuando-worker` e `persuando-response`. Não houve deploy automático.
O recurso não exige novas variáveis de ambiente, atualização do Capture ou migração do banco.

### 1. Enviar o código local ao GitHub

No PowerShell, revise os arquivos e envie a alteração (não inclua `.env.local` ou segredos):

```powershell
cd C:\Users\guilherme\Downloads\persuando
git status --short
git diff
git add -- README.md docs/architecture.md docs/reference-ui.md docs/repository-practice.md docs/vps-deployment.md docs/handoff.md docs/roadmap.md docs/next-spec-prompt.md apps/api/src/modules/providers/openai-compatible-provider.adapter.ts apps/api/src/modules/providers/provider-adapter.ts apps/api/src/modules/realtime/realtime.service.ts apps/api/test/providers.test.mjs apps/api/test/realtime.test.mjs apps/response/src/app/globals.css 'apps/response/src/app/sessions/[sessionId]/session-realtime-client.tsx' 'apps/response/src/app/sessions/[sessionId]/repository-instructions.tsx' packages/contracts/src/websocket.ts
git add -- 'apps/response/src/app/sessions/[sessionId]/session-history-loader.tsx'
git diff --cached --stat
git commit -m "feat: add optional repository practice instructions"
git push origin master
```

Se trabalhar em outra branch, faça a integração em `master` antes do `git pull` abaixo.

### 2. Conectar e verificar o checkout

```powershell
ssh root@216.158.236.156
```

Use a chave ou senha SSH já configurada para sua VPS. Se a conexão usa chave específica:
`ssh -i C:\caminho\sua-chave root@216.158.236.156`.

Na VPS (Bash):

```bash
cd /srv/projects/persuando
git status --short
git branch --show-current
git rev-parse HEAD
pm2 status
node --version
```

Anote o SHA anterior para rollback. O checkout deve estar em `master`, sem mudanças locais
pendentes, e usar Node.js 24 ou superior. Se houver mudanças locais, reconcilie-as antes de
atualizar; não use comandos de descarte automático.

### 3. Atualizar, validar e reconstruir

```bash
git pull --ff-only origin master

set -a
source .env.local
set +a
export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export NEXT_PUBLIC_WEBSOCKET_URL="$WEBSOCKET_URL"

npm ci
npx prisma generate
npm test
npm run --workspace @persuando/response build
```

Execute os comandos na ordem e interrompa se algum falhar, antes de reiniciar o PM2. `npm test`
inclui o build TypeScript da API/pacotes. As variáveis públicas devem estar definidas antes do build
do Next.js e conter os mesmos endpoints HTTPS/WSS de `.env.local`. Para o domínio atual:
`API_BASE_URL=https://api-persuando.gfig.space` e
`WEBSOCKET_URL=wss://api-persuando.gfig.space/realtime`.

Esta alteração não adiciona migração. Não execute `prisma migrate reset`. Se o pull incluir
outras alterações com migrações, siga também as instruções específicas delas.

### 4. Reiniciar e conferir

```bash
PORT=4100 pm2 restart persuando-api --update-env
pm2 restart persuando-worker --update-env
PORT=3100 pm2 restart persuando-response --update-env
pm2 save
pm2 status
curl --fail http://127.0.0.1:4100/health
curl --fail https://api-persuando.gfig.space/health
curl --fail --output /dev/null --write-out '%{http_code}\n' https://persuando.gfig.space/
pm2 logs persuando-api --lines 80 --nostream
pm2 logs persuando-response --lines 80 --nostream
```

Abra [Response](https://persuando.gfig.space), atualize a página e entre na sessão de treino.
Selecione Repository, cole instruções, continue e gere a resposta com um screenshot autorizado.
Confira também **Editar instruções → Pular**, Code Problem e System Design. Não é necessário
alterar Nginx/DNS para esta funcionalidade. O restart pode causar uma breve desconexão; o web
reconecta automaticamente.

### 5. Rollback se necessário

Com o checkout limpo, volte ao SHA anotado usando `git switch --detach SHA_ANTERIOR`. Repita o
carregamento de `.env.local`, os exports, `npm ci`, `npx prisma generate`, `npm test`, o build do
Response e os restarts acima. Como não há mudança de schema, não há rollback de banco para esta
alteração. Para voltar ao fluxo normal depois da correção: `git switch master` e atualize novamente.

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
npm ci
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

The OAuth callback intentionally lands on the API first. Browser/Response Mode login uses the default `/auth/google` flow: the API creates a short-lived one-time login bridge code, redirects the browser to the Response App at `/auth/complete`, and the Response App exchanges that code with `/auth/bridge/consume` to set its own host-only login cookie. Electron Capture login uses `/auth/google?clientType=capture`; the API sets its API-host cookie and returns a small API-local success page instead of redirecting to Response Mode, so the Capture window can read the API cookie and complete sign-in. This keeps the API and Response cookies separated without putting the signed session token in the URL. The bridge code is currently in memory and assumes one API process; use Redis/PostgreSQL for this handoff before running multiple API instances.

## Start Infrastructure

```bash
docker compose --env-file .env.local up -d
```

Check containers:

```bash
docker compose ps
```

## Build The Apps

Load the production environment before both builds. This prevents browser-facing Next.js variables
from being compiled with local fallback values:

```bash
set -a
source .env.local
set +a
export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export NEXT_PUBLIC_WEBSOCKET_URL="$WEBSOCKET_URL"

npm run build
npm run --workspace @persuando/response build
```

The Response build prepares a Next.js standalone bundle and copies `public` plus `.next/static`
into it. `npm run start:response` starts the generated
`apps/response/.next/standalone/apps/response/server.js`; do not replace it with `next start` while
`output: "standalone"` remains enabled.

The session page resolves its realtime endpoint at request time from `WEBSOCKET_URL`, with
`NEXT_PUBLIC_WEBSOCKET_URL` kept as a compatibility fallback. Production session rendering fails clearly if
neither value exists. Keep the domain deployment values as HTTPS/WSS in `.env.local`.

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
cd /srv/projects/persuando
git pull --ff-only origin master

set -a
source .env.local
set +a
export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export NEXT_PUBLIC_WEBSOCKET_URL="$WEBSOCKET_URL"

npm ci
npx prisma generate
npm run build
npm run --workspace @persuando/response build

PORT=4100 pm2 restart persuando-api --update-env
pm2 restart persuando-worker --update-env
PORT=3100 pm2 restart persuando-response --update-env
pm2 save
```

Only run `npx prisma migrate deploy` when the pulled revision contains a new committed migration.
The optional Repository instructions update has no schema change and needs no migration. Never
run `npx prisma migrate reset` on the VPS: it drops production data before rebuilding the schema.

Check status and logs:

```bash
pm2 status
pm2 logs persuando-api --lines 200 --nostream
pm2 logs persuando-worker --lines 200 --nostream
pm2 logs persuando-response --lines 200 --nostream
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
