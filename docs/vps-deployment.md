# VPS Deployment Guide

This guide describes the current practical deployment shape for Persuando.

The latest generation-recovery/code-first change requires API/worker update and a Response rebuild
and restart using the procedure below. No migration, environment variable or Capture installer is
added. Repository v4 refreshes previous teaching context once on generation; retained cards move
ahead of the expandable supporting narrative after refreshing the web. Generation diagnosis uses
the selected model and existing credential, with bounded additional calls only on eligible errors.
See [generation recovery](generation-recovery.md). These changes have not been deployed here.

## Atualizar o projeto e corrigir o Capture no Windows

Este procedimento usa o destino já documentado: `root@216.158.236.156`, checkout em
`/srv/projects/persuando`, branch `master`, API `4100`, Response `3100`, processos PM2
`persuando-api`, `persuando-worker` e `persuando-response`. Não houve deploy automático.
A versão atual inclui o guia completo de Repository e os controles de pedidos GPT-6 no backend,
mais modelos novos e correção de pausa no Capture 0.1.2. Para essas mudanças, atualize/reinicie
API e worker na VPS **e** instale o Capture novo no Windows. Não há migração nem variável nova.
O ajuste mais recente também corrige cores dos códigos, citações, checks manuais e diagramas de
Repository no web. **É obrigatório reconstruir e reiniciar o Response**, além de API/worker.
Os metadados dos passos são opcionais e compatíveis com respostas antigas; não há migração.
Para este ajuste visual/roteiro, não é necessário gerar outro instalador Electron; o Capture
0.1.2 já instalado continua servindo. Recarregue o web após o deploy: respostas antigas ganham a
apresentação corrigida, e uma nova geração aplica o roteiro v3 com arquitetura ilustrada.

### 1. Enviar o código local ao GitHub

No PowerShell, revise os arquivos e envie a alteração (não inclua `.env.local` ou segredos):

```powershell
cd C:\Users\guilherme\Downloads\persuando
git status --short
git diff
git add -- README.md docs apps/api/src/modules/providers/openai-compatible-provider.adapter.ts apps/api/test/providers.test.mjs apps/response/src/app/globals.css "apps/response/src/app/sessions/[sessionId]/session-realtime-client.tsx" apps/response/src/lib/practice-presentation.mjs apps/response/test apps/response/tsconfig.json packages/contracts/src/types.ts
git diff --cached --stat
git commit -m "fix: restore practice presentation and improve repository architecture coaching"
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

docker compose --env-file .env.local ps
docker compose --env-file .env.local exec -T postgres pg_isready -U persuando -d persuando
docker compose --env-file .env.local exec -T redis redis-cli INFO replication

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

Para esta instalação independente, o Redis das filas deve informar `role:master`. Se informar
`role:slave` ou o worker emitir novos erros `READONLY`, interrompa a atualização e confirme o
endpoint/configuração do Redis antes de alterar sua replicação. Os logs antigos sem timestamp
não confirmam uma falha atual; observe novos registros com
`pm2 logs persuando-worker --lines 0 --timestamp` e saia com `Ctrl+C`.

### 4. Reiniciar e conferir

```bash
PORT=4100 pm2 restart persuando-api --update-env
pm2 restart persuando-worker --update-env
PORT=3100 pm2 restart persuando-response --update-env
curl --fail --retry 15 --retry-delay 2 --retry-connrefused --retry-max-time 60 http://127.0.0.1:4100/health
curl --fail --retry 15 --retry-delay 2 --retry-connrefused --retry-max-time 60 https://api-persuando.gfig.space/health
curl --fail --output /dev/null --write-out '%{http_code}\n' https://persuando.gfig.space/
pm2 save
pm2 status
pm2 logs persuando-api --lines 80 --nostream
pm2 logs persuando-worker --lines 80 --nostream
pm2 logs persuando-response --lines 80 --nostream
```

Abra [Response](https://persuando.gfig.space), atualize a página e entre na sessão de treino.
Selecione Repository, cole instruções, continue e gere a resposta com um screenshot autorizado.
Confira também **Editar instruções → Pular**, Code Problem e System Design. Não é necessário
alterar Nginx/DNS para esta funcionalidade. O restart pode causar uma breve desconexão; o web
reconecta automaticamente.

O `/health` atual confirma que a API está respondendo; ele não verifica o processamento de filas.
Compare `pm2 describe persuando-api` e `pm2 describe persuando-worker` para ler uptime/restarts
sem o truncamento da tabela. Em um restart normal, uma chamada imediata pode recusar conexão ou
retornar 502 durante a inicialização; os comandos com retry acima esperam esse intervalo.

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

### Versão atual 0.1.2: pausa de screenshots e modelos novos

Instale **0.1.2** para a lista GPT-6 e a pausa corrigida. Pausar impede novas aquisições de
screenshots; terminar, revogar, trocar sessão ou pausar/retomar enquanto uma captura está em voo
descarta a imagem antiga. O fallback do navegador também libera o elemento de vídeo temporário.
Nenhuma opção para ocultar captura/indicador foi adicionada.

Para gerar o instalador, use sempre o comando normal:

```powershell
npm.cmd run capture:dist:win
```

Cada build usa uma pasta nova `release/capture/builds/build-*`, sem apagar ou sobrescrever um
Capture aberto. Isso resolve `EBUSY` ao remover a antiga pasta `win-unpacked`. O instalador também
é copiado para `release/capture/Persuando-Capture-Setup-0.1.2.exe`. Se essa cópia estiver bloqueada,
o comando informa o caminho do instalador na pasta nova. Os caminhos exatos da última compilação
concluída ficam em `release/capture/latest-build.json`.

Feche o app pela bandeja antes de executar o instalador; copie o instalador novo para o outro PC.
A instalação antiga não é substituída apenas por compilar o projeto. Não é necessário escolher
ou limpar diretórios manualmente a cada atualização. Preserve o script `scripts/package-capture-win.mjs`
e seus dois comandos no package.json em atualizações/merges; os testes do Capture verificam essa ligação.
Se `git pull` avisar sobre alterações locais, preserve-as com commit antes de integrar a atualização;
descartá-las pode remover correções que ainda não estão no remoto.

Depois de atualizar o backend, faça login no Capture e escolha **Analysis model**: Terra para
comparar velocidade em screenshots, Sol para código, Luna para tarefas focadas ou Astra para
maior capacidade. A escolha salva e os modelos anteriores continuam disponíveis. Não houve
benchmark nem chamada real ao provedor nesta alteração; acesso depende da sua conta/provedor.

### Borda amarela de captura no Windows

O código não cria um overlay de tela inteira. A borda fina é compatível com o indicador que o
[Windows desenha no item capturado](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture).
Não foi possível atribuir o indicador a um processo específico só pelo screenshot: outros apps de
captura e ferramentas de automação também podem mantê-lo. O indicador do sistema não é desativado.

Para interromper novas capturas, use **Pause**, **End**, desative **Periodic screen context** ou
saia do Capture pelo **Quit** da bandeja. Uma chamada nativa já em voo pode terminar antes de
liberar seus recursos, mas seu resultado é descartado se a sessão mudou. Se o indicador persistir
após sair, confira os outros aplicativos que estão capturando a tela. Ocultar a toolbar não pausa
captura.

### Correção de inicialização herdada da versão 0.1.1

O instalador antigo 0.1.0 tentava gravar `electron-debug.log` em
`resources/app.asar/electron-debug.log`. ASAR é somente leitura; esse caminho causava o diálogo
`A JavaScript error occurred in the main process` / `ENOENT` em qualquer PC. A versão 0.1.1
grava em `app.getPath("userData")/logs/electron-debug.log` e continua a inicialização mesmo se
o log não puder ser gravado. É uma correção do executável local, independente da VPS.

No Windows que compila o app:

```powershell
cd C:\Users\guilherme\Downloads\persuando
# Não precisa fechar uma versão antiga para compilar; feche-a antes de instalar.
npm.cmd ci
npm.cmd run capture:dist:win
Get-Item .\release\capture\Persuando-Capture-Setup-0.1.2.exe | Select-Object Name, LastWriteTime, Length
```

Esse comando gera uma pasta nova com `win-unpacked` e o novo instalador. Abra especificamente
`release/capture/Persuando-Capture-Setup-0.1.2.exe` para atualizar a instalação antiga. Um atalho
existente ainda executa a versão instalada em `%LOCALAPPDATA%\Programs\Persuando Capture`
até que o instalador novo seja executado. O `0.1.0.exe` antigo pode continuar na pasta de saída;
ele não é atualizado pelo comando `pack:win` e não deve ser usado para testar a correção.

Para abrir a versão nova diretamente, sem instalar:

```powershell
$captureBuild = Get-Content .\release\capture\latest-build.json | ConvertFrom-Json
& $captureBuild.executable
```

Para o outro PC, copie o instalador **0.1.2** e instale-o lá. Alternativamente, copie toda a pasta
`win-unpacked` e abra `Persuando Capture.exe` dentro dela; não copie apenas o executável.
Não é necessário Node/npm no PC que apenas executa o app pronto. `pack:win` gera somente a pasta;
`dist:win` também gera o instalador NSIS. Execute um comando de cada vez e espere sua conclusão.
Os avisos de ícone padrão e referências de dependência duplicadas não são a exceção de log que
impedia a inicialização. Ícone e assinatura de distribuição continuam como trabalho separado.

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
release/capture/builds/build-<id>/win-unpacked/Persuando Capture.exe
```

To build a Windows installer:

```bash
npm.cmd run capture:dist:win
```

Output:

```text
release/capture/Persuando-Capture-Setup-0.1.2.exe
```

The current installer is suitable for local smoke testing. Production distribution still needs app icon, publisher/signing decisions, update strategy, and release-channel policy.
