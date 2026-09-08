## Command
speckit.specify

## Objective
Create the next focused Persuando specification for Windows Capture App release polish, UI polish, and production-readiness hardening after the first MVP implementation slice and initial VPS/installer smoke path.

## Current Context

The first MVP slice in `specs/001-persuando-mvp/` is implemented and validated locally:

- NestJS API with Prisma/PostgreSQL persistence.
- Google/local-dev auth, including production subdomain browser callback bridge from API OAuth callback to the Response App login completion route and a separate Electron Capture callback completion path using `/auth/google?clientType=capture`.
- Backend-encrypted provider credentials.
- Consent grant/revoke.
- Settings.
- 7-day retention and manual delete.
- Native `/realtime` WebSocket.
- Consent-gated microphone chunk ingestion.
- Transcript, summary, insight, suggestion, and code-practice guidance fan-out.
- BullMQ worker boundaries.
- Next.js Response Mode.
- Electron/Vite/React Capture Mode with dashboard, settings, floating toolbar, tray menu, microphone capture, visible context controls, user-requested screen context, periodic screen context, and responsible Code Practice tutoring from recent visual context.

Validation completed:

-
pm.cmd run build`
-
pm.cmd run typecheck`
-
pm.cmd run lint`
-
pm.cmd run format`
-
pm.cmd run test` with 108 passing tests
- Local integrated REST/WebSocket smoke for capture activation, audio upload, response fan-out, copilot context, and manual delete
- Regression coverage for active-session cleanup on new capture creation and periodic screenshot toggle startup during active capture
- Code Practice provider prompt now requires long Markdown teaching answers with detected-language code snippets in the step-by-step section, fenced code blocks, JavaScript fallback when unclear, and Response Mode renders headings, lists, inline code, and scrollable code blocks
- Realtime regression coverage confirms blank/missing Copilot programming language falls back to `javascript` instead of rejecting screen context during capture

## Feature To Specify

Define the next production-readiness slice for:

1. Windows Capture App release polish beyond the current Electron Builder smoke installer.
2. Floating toolbar and tray UX polish.
3. Manual end-to-end Electron/browser smoke workflow.
4. Real OpenAI-compatible provider smoke workflow.
5. Screen/context capture hardening before broader use.
7. Optional VPS production deployment hardening from `docs/vps-deployment.md`, including ports, PM2/systemd or containerization, HTTPS/domain setup, production URL configuration, and durable auth bridge storage before multiple API instances.
6. Code Practice visual-context quality gates for study/practice/review explanations, including manual smoke criteria for automatic screenshot-triggered generation behavior, detected-language snippets, Markdown/code-block readability, and future syntax-highlighting polish in Response Mode.

## Requirements To Cover

- Refine the current runnable Windows artifacts (`release/capture/win-unpacked/Persuando Capture.exe` and `release/capture/Persuando-Capture-Setup-0.1.0.exe`) into a safer release flow with icon, signing/publisher decisions, update policy, and installer smoke checks.
- Preserve close-to-tray behavior and visible toolbar show/hide.
- Keep capture status visible for idle, active, paused, reconnecting, error, revoked, and ended states.
- Make settings, provider key entry, model selection, consent toggles, microphone selection, and shortcut references easier to test manually.
- Add manual smoke documentation for: Google sign-in, provider key save/validate, consent grant/revoke, start capture, pause/resume, hide/show toolbar, Response Mode live session, context capture, provider error, and manual delete.
- Define real-provider testing expectations without committing keys or secrets.
- Define production auth hardening expectations for the current browser one-time login bridge and Electron Capture callback flow: short TTL, single use, no signed token in URLs, host-only cookies per subdomain, Capture login must not redirect into Response Mode, and Redis/PostgreSQL storage if the API runs more than one process.
- Add screen/context limits for size, consent text, visible active state, maximum retained visual-context count, redaction expectations, and retention/delete behavior.
- Define manual validation criteria for Code Practice outputs from screenshots: identify the visible prompt/enunciado when present, detect the selected programming language and fall back to JavaScript only when unclear, explain the chosen technique step by step with concrete code snippets inside the steps, include child-friendly intuition, include Big-O time and space complexity, provide pseudocode or final code only in allowed study/practice/review contexts, format the answer as Markdown with fenced code blocks, render code blocks readably in Response Mode, avoid live-assessment cheating behavior or claims, and verify Auto mode triggers from new screenshots without repeated spam.
- Preserve the new programming-language fallback in both Capture and API validation so missing user settings cannot break screenshot/code-practice context upload.

## Non-Goals

- Do not add stealth, invisibility, recording bypass, screen-share bypass, browser focus evasion, proctoring evasion, platform-rule evasion, or cheating-oriented features.
- Do not add robust system-audio capture in this slice.
- Do not add automatic app/site detection in this slice.
- Do not add local/offline models in this slice.
- Do not choose a production deployment provider unless required by the spec.

## Source Context

Use:

- `.specify/memory/constitution.md`
- `docs/overview.md`
- `docs/vision.md`
- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/reference-ui.md`
- `docs/prototype-mvp-flow.md`
- `docs/roadmap.md`
- `docs/handoff.md`
- `specs/001-persuando-mvp/spec.md`
- `specs/001-persuando-mvp/plan.md`
- `specs/001-persuando-mvp/tasks.md`

## Output Expectations

- Produce a concise Spec Kit feature specification.
- Preserve the current two-mode architecture.
- Keep consent, privacy, responsible use, and documentation closeout enforceable.
- Do not create implementation tasks until `/speckit-tasks` is invoked.

## Additional Source Context - 2026-08-22 Screenshot Debug Trace

Recent implementation fixed the runtime Capture preload mismatch for periodic screen context IPC and added optional `debugId` propagation for manual and periodic screenshots. The next spec should preserve this traceability requirement in manual smoke criteria: every screenshot should be debuggable with one `[screen:<debugId>]` across Capture renderer, Electron main, WebSocket `copilot.context`, API validation/persist/publish, and Response screen-context apply. Build validation for this update: `npm.cmd run build` passed.

## Next Spec Prompt - 2026-08-23 Visual Context Production Hardening

```text
/speckit-specify Specify production hardening for Persuando Code Practice visual context.

Objective:
Make real OpenAI-compatible visual generation reliably grounded in the current coding problem while controlling latency, payload size, retention, and cost.

Source request/context:
The 2026-08-23 fix removed an incorrect Tree Height hardcoded fallback and established a 30-screenshot FIFO window. Preserve truthful provider errors and the real-model-only generation path.

Project context:
Use README.md, docs/architecture.md, docs/domain-model.md, docs/handoff.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing Capture -> realtime API -> Response architecture.

Requirements:
- Preserve explicit consent and visible Code Practice state.
- Define screenshot compression, deduplication, durable storage, retention, and deletion behavior.
- Define an adaptive model-input policy that prioritizes recent/non-duplicate screenshots without silently using stale sessions.
- Keep every generation addressable in logs by session, model, context source, image count, latency, and safe provider error code without logging images, prompts, keys, or secrets.
- Add real-provider smoke criteria proving that the generated explanation matches the visible problem title, requested function, input/output behavior, and selected language.
- Never fabricate fallback tutoring content; provider failures must stay visible and retryable where appropriate.

Artifact considerations:
Prefer additive contracts and migrations. Document compatibility for existing text-only CodeCopilotContext rows and keep the current 30-item UI behavior until a replacement policy is approved.

Risks/assumptions:
Thirty full-screen data URLs can increase latency and cost. Older persisted rows may not contain recoverable image bytes. Real-provider tests require external credentials and must not commit secrets.

Expected output:
Produce a concise feature specification with acceptance criteria, failure states, observability requirements, migration/rollback considerations, and manual Electron-to-VPS smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Additional Source Context - 2026-08-23 Incremental Tutoring

The implemented baseline now performs two OpenAI-compatible calls for Code Practice: `visual_analysis` receives all current screenshots and extracts exact structured evidence; `answer` receives that analysis plus the last four completed explanations. Manual guidance is persisted in the existing CodeCopilotContext table, and the Response panel exposes `N/30` FIFO order. The next `/speckit-specify` must preserve this truthful two-phase behavior and define fixture-based quality gates for function signatures, provided node fields, method-only submissions, print/return semantics, output whitespace, current code, failed test evidence, correction of prior advice, OCR uncertainty, latency, and image/token cost. It must not introduce fabricated fallback content or automated code execution.

## Additional Source Context - 2026-08-23 Capture Toolbar Ergonomics

The floating Capture toolbar now uses explanatory native tooltips and accessible labels for every action. Its camera action remains visible and is also available through the Electron global accelerator `CommandOrControl+E`, which reuses the existing consented manual `capture-context` flow only during an active listening session. Future Capture UI specs must preserve discoverability, visible capture state, accelerator conflict handling, and the product's consent and responsible-use boundaries.

## Additional Source Context - 2026-08-23 Realtime And Model Routing

Response now receives `WEBSOCKET_URL` from the Next server at request time, displays actionable
connection failures, and renders its 30 screenshots newest-to-oldest while sending them
oldest-to-newest to the provider. Capture offers GPT-5.6 sol/terra/luna analysis choices and the
OpenAI-compatible adapter maps GPT-5 models to `max_completion_tokens` without legacy temperature.
The next `/speckit-specify` should define model capability discovery or an explicit allowlist,
provider-specific compatibility checks, quality/latency/cost acceptance criteria, and a deployment
smoke proving the browser connects to the production WSS endpoint rather than localhost. Preserve
truthful provider errors and do not add silent model or content fallbacks.
## Next Spec Prompt - 2026-08-23 Provider Reliability And Visual Tutoring Evaluation

```text
/speckit-specify Specify production reliability and evaluation for Persuando Code Practice provider generation.

Objective:
Make the two-phase visual tutoring flow consistently use fresh screenshots, the selected programming language, and provider output that is structurally valid, accurate, observable, and bounded in latency/cost.

Source request/context:
Recent production runs returned invalid visual-analysis JSON, generic pre-response failures, stale-looking context, and language-neutral pseudocode despite JavaScript being selected. The implemented baseline now merges persisted/session contexts, sends the selected language to both prompts, accepts fenced JSON, retries one visual parse failure, and assigns a generationId.

Project context:
Use README.md, docs/architecture.md, docs/domain-model.md, docs/handoff.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing Capture -> realtime API -> OpenAI-compatible provider -> Response architecture.

Requirements:
- Preserve the latest-30 screenshot window and chronological provider input while rendering newest-first in Response.
- Define freshness guarantees for shortcut/periodic screenshots immediately before manual and automatic generation.
- Define provider/model capability checks for vision, structured output, token controls, and supported model IDs.
- Define bounded retry behavior by failure class; never turn provider failure into fabricated tutoring.
- Require the Capture-selected programming language in extracted facts, code blocks, and platform-compatible solutions.
- Add fixture-based evaluations for problem title, exact signature, provided scaffolding, output format, current attempt, compiler/test feedback, correction of prior advice, and uncertainty.
- Correlate each phase by generationId while excluding prompts, images, keys, and secrets from logs.
- Establish latency, image/token, and cost budgets for visual_analysis and answer phases.

Artifact considerations:
Prefer additive contracts and existing provider abstractions. Preserve existing persisted CodeCopilotContext rows and safe client errors. Include deployment and rollback notes for API, Response, and Capture artifacts.

Risks/assumptions:
Model support and structured-output behavior differ across OpenAI-compatible providers. Thirty full-screen data URLs and two sequential calls can be slow or expensive. Real-provider tests require external credentials that must not be committed.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, error taxonomy, observability fields, fixture matrix, deployment/rollback checks, and manual Electron-to-VPS smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```
## Additional Source Context - 2026-08-23 Screenshot Delivery Latency

Manual `Ctrl+E`/tray capture now broadcasts across Electron windows so the renderer owning `activeCapture` handles it; non-owning renderers ignore the command. Native screenshots are JPEG quality 70 at the existing 1440x900 thumbnail size, and validated contexts are published to Response before PostgreSQL persistence completes. Response logs `transportLatencyMs`. The next specification must define an explicit latency target from shortcut/tick to Response apply, acceptable compressed-image OCR/readability quality, behavior when persistence fails after realtime fan-out, payload/backpressure limits, and a packaged Windows-to-VPS measurement procedure. Keep the periodic interval at five seconds unless a later product decision makes it configurable. `sessionTimerMinutes` is unrelated and automatic timeout enforcement remains deferred.
## Additional Source Context - 2026-08-23 Immediate UI And Bounded Provider Recovery

The implemented baseline now accepts `copilot.context` independently from generated-artifact panel modes and scrolls the newest-first screen-context panel to the latest screenshot on arrival. OpenAI-compatible chat calls retry one transient network/408/429/5xx failure after 500 ms and log safe attempt metadata. The selected programming language overrides unknown visual inference, and public-practice Code Practice output is rejected and repaired once when it lacks a non-empty fenced solution in that language. The next `/speckit-specify` must preserve these guarantees and define measurable Capture-to-Response latency, mode-specific provider-error attribution, maximum provider request payload, retry budgets, and fixture-based completeness checks without adding fabricated fallback content.
## Additional Source Context - 2026-08-23 Multi-Exercise Sessions

The provider prompt now groups screenshots by challenge, treats the newest identifiable exercise as active, excludes prior-exercise contracts/code/tests, permits labeled standard-contract completion for exact public practice titles or URLs, and requires implementation-specific Big-O reasoning. The next `/speckit-specify` should include multi-exercise fixtures that measure active-problem classification, stale-context rejection, same-problem chronology retention, complete selected-language solutions, and recovery when the newest screenshot is partial.

## Next Spec Prompt - 2026-08-23 Mode Isolation And Durable Hot Context

```text
/speckit-specify Specify production hardening for exclusive assistant modes and hot screenshot context.

Objective:
Preserve immediate screenshot display/model grounding while making background durability reliable across API restarts and multiple instances, with isolated provider budgets and errors for Conversation, Code Practice, and Exam Study.

Source request/context:
The implemented baseline persists one active mode per user, prevents audio transcription outside Conversation, prevents cross-mode generation, publishes screenshots before persistence, sends Response hot state in visual generation requests, and batches image persistence every two seconds. Exam Study solves the newest visible public-exam question didactically.

Requirements:
- Define multi-instance ownership or shared hot-state behavior without delaying WebSocket fan-out.
- Define at-least-once screenshot persistence, idempotency, bounded memory/backpressure, retry, shutdown, and crash-recovery behavior.
- Preserve the newest 30 contexts and newest-active-question/exercise segmentation.
- Attribute provider errors and rate limits to transcription, conversation, code_practice, or exam_study.
- Define per-mode request concurrency, cooldown, latency, payload, token/image, and cost budgets.
- Add real-provider fixtures for Code Practice correctness and Exam Study subject identification, alternative analysis, and child-simple step-by-step teaching.
- Preserve consent, retention/deletion, safe logs, and no fabricated provider fallback content.

Risks/assumptions:
The current in-process queue cannot survive a hard crash or coordinate multiple API instances. Exam Study uses captured question context and does not yet browse an external question bank.

Expected output:
Produce measurable acceptance criteria, event/state diagrams, migration and rollback notes, failure taxonomy, observability fields, fixture matrix, and packaged Electron-to-VPS smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Additional Source Context - 2026-08-23 Visual Mode Audio Isolation

Code Practice and Exam Study now start as screenshot-only Capture sessions without creating an audio meter or recorder. Future mode-hardening work must preserve this isolation and include packaged Electron tests with no microphone device, a disabled microphone, and a valid Conversation microphone stream.

## Next Spec Prompt - 2026-08-25 Repository Code Practice Evaluation

```text
/speckit-specify Specify production evaluation and hardening for Persuando Code Practice repository workflow.

Objective:
Make repository-mode Code Practice reliably diagnose visible codebase/debugging context without inventing repository searches, command output, files, symbols, or line numbers, while preserving the existing exercise workflow.

Source request/context:
The implemented baseline adds an additive `codePracticeWorkflow` contract with `exercise` as the default and `repository` as a Response-selectable workflow. Repository mode passes bounded incremental history from visible screen text and previous guidance, logs `workflow` and `incrementalHistory`, persists workflow metadata with generated guidance, and renders safe syntax-highlighted Markdown in Response Mode. Manual generation is single-flight per session/mode/workflow.

Requirements:
- Preserve backward compatibility for existing Code Practice clients that omit `codePracticeWorkflow`.
- Define fixture-based evaluation for visible editor content, terminal/test output, diffs, comments, instructions, stale screenshots, and prior incorrect guidance.
- Require repository answers to label observable evidence, current/stale context, concrete edit proposals, validation commands, and uncertainties.
- Forbid claims of unseen repository search, files, exact line numbers, command execution, or test results unless they are visible in provided context.
- Define when workflow preference should remain browser-local versus server-persisted across devices/reconnects.
- Define payload, concurrency, cooldown, latency, token/image, and cost budgets for repository mode separately from exercise mode.
- Preserve safe logs: generationId, workflow, phase, model, language, image count, incremental-history count, latency, and safe error code only.
- Include packaged Electron-to-VPS smoke scenarios for switching Exercise/Repository, duplicate-click prevention, Auto generation after fresh screenshots, highlighted code rendering, and panel focus/collapse behavior.

Artifact considerations:
Prefer additive contracts and existing provider abstractions. Avoid database migrations unless server-side workflow persistence is approved. Preserve generated guidance compatibility with existing CodeCopilotContext rows.

Risks/assumptions:
Screenshots are partial evidence and OCR may be uncertain. Repository mode cannot inspect local files unless a future approved connector or upload path provides them. Real-provider evaluation requires external credentials that must not be committed.

Expected output:
Produce a concise feature specification with acceptance criteria, fixture matrix, failure taxonomy, observability requirements, deployment/rollback notes, and manual smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-08-30 Interview-Style Code Practice Evaluation

```text
/speckit-specify Specify evaluation and hardening for Persuando interview-style Code Practice workflows.

Objective:
Make Code Practice consistently produce study-safe simulated interview answers across code problems, repository debugging, and design-system/component work, with complete final code when evidence is sufficient and a clear step-by-step development narrative.

Source request/context:
The implemented baseline now has three additive workflows: `exercise`, `repository`, and `design_system`. Response Mode labels them as Code Problem, Repository, and Design System. The workflow travels through WebSocket, realtime, provider prompts, guidance metadata, and Copilot explanation events. Prompts frame the session as simulated technical-assessment preparation for study and require interview-style commentary, step-by-step construction, corrected false-start pitfalls, and clean final code or patch sections.

Project context:
Use README.md, docs/architecture.md, docs/domain-model.md, docs/handoff.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing Capture -> realtime API -> OpenAI-compatible provider -> Response architecture.

Requirements:
- Preserve backward compatibility: omitted `codePracticeWorkflow` defaults to `exercise`.
- Define answer-quality fixtures for Code Problem, Repository, and Design System workflows.
- Require public study/practice code-problem answers to include complete final selected-language code plus interview-style walkthrough sections.
- Require repository answers to use only visible/provided evidence, propose incremental edits, explain what to say aloud, and include complete relevant final function/component/patch sections when evidence is sufficient.
- Require design-system answers to cover component API, variants, tokens, states, accessibility, responsive behavior, visual quality, validation checks, and final code/patch shape.
- Define how corrected false-start pitfalls should appear as teaching notes without leaving wrong final code.
- Forbid claims of live/proctored assistance, unseen repository search, design-file access, command output, exact lines, hidden tests, or tokens unless actually visible or tool-provided.
- Define per-workflow latency, payload, token/image, cost, duplicate-click, Auto-generation, and logging expectations.
- Include packaged Electron-to-VPS real-provider smoke scenarios for all three workflow labels and Markdown/syntax-highlight rendering.

Artifact considerations:
Prefer additive contracts and existing provider abstractions. Avoid database migrations unless durable server-side workflow preference is approved. Preserve existing CodeCopilotContext compatibility.

Risks/assumptions:
Screenshots are partial evidence and OCR may be uncertain. Repository/design-system workflows cannot inspect files or design tools unless a future approved connector or upload path provides them. Real-provider tests require external credentials that must not be committed.

Expected output:
Produce a concise feature specification with acceptance criteria, fixture matrix, failure taxonomy, observability fields, deployment/rollback checks, and manual smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-08-31 Conversational Code Practice Evaluation

```text
/speckit-specify Specify evaluation and hardening for Persuando conversational Code Practice answers.

Objective:
Make code-problem practice outputs consistently useful as simulated interview rehearsal: complete final code first, then a readable spoken walkthrough that feels like the candidate thinking and explaining while coding.

Source request/context:
The implemented baseline now asks Code Practice to start with what the student understood, place the complete solved code near the beginning, emphasize `Fala para entrevista` blockquotes, include current doubts per step, explain why decisions are made during the walkthrough, include small corrected false starts, and provide only concise Google search terms suitable for preparation or allowed interview clarification.

Requirements:
- Preserve explicit Code Practice study framing and the existing `exercise`, `repository`, and `design_system` workflows.
- Define quality fixtures for code-problem answers that verify: problem understanding, objective, complete selected-language final solution, conversational step progression, current doubt per step, spoken-script prominence, explanation of decisions when relevant, corrected false starts, implementation-specific Big-O, and final checklist.
- Require Google help to be only short search queries such as algorithm names, data structures, API concepts, platform error messages, or visible error text; do not add links or long explanations.
- Validate Response rendering so `Fala para entrevista` blockquotes are visually scannable without breaking safe Markdown/code highlighting.
- Preserve no fabricated provider fallback content, no hidden repository/design access, and no live-assessment/proctoring evasion behavior.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, fixture matrix, UI readability checks, provider prompt constraints, deployment smoke scenarios, and rollback notes. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-06 Interview Practice Evaluation And Concurrent Reliability

```text
/speckit-specify Specify real-provider evaluation and concurrent-mode reliability for retained Persuando interview practice.

Objective:
Measure and harden Code Practice and System Design quality, latency, error attribution, history restoration, and Auto behavior while both independent panels can generate concurrently.

Implemented baseline:
- Capture requires simulation-only-use acceptance and the application-selected mode is authoritative; realistic logos, timers, hiring copy, and platform UI remain simulation scenery.
- Code Practice and System Design use independent generation modes, locks, prior guidance, visual fingerprints, persisted metadata, and Response panels while sharing the newest 30 consented screen contexts.
- Unchanged extracted problem/attempt facts emit `generation.completed` without a duplicate answer.
- Code Practice requires child-simple interpretation, three to five clarifying questions, assumptions, complete optimal and minimum solutions, structured complete-code/test pairs, interview speech, and implementation-specific Big-O.
- System Design requires clarification, assumptions, staged architecture evolution, interview speech, and at least one valid Mermaid diagram rendered with strict security.
- Completed guidance persists in the existing `code_copilot_contexts` table and rehydrates through session history; no schema migration was introduced.
- Response selects Portuguese or English per session for future requests.

Requirements:
- Define fixture-based scoring for Code Practice contract accuracy, compilable/coherent incremental code, test-to-step correspondence, minimum-to-optimal progression, new-problem resets, and Big-O explanations grounded in exact operations.
- Define System Design fixtures covering clarification quality, assumptions, capacity estimates, minimum architecture, staged scaling, APIs/data, reliability, security, observability, trade-offs, and Mermaid semantic/syntax accuracy.
- Measure simultaneous Code Practice plus System Design provider latency, token/image cost, rate-limit behavior, cancellation, reconnect/replay behavior, and single-flight correctness.
- Replace the shared visual provider-error surface with mode-correlated errors and loading completion without weakening safe-message handling.
- Verify history restoration across refresh/reconnect for mode, language, workflow, practice steps, diagram content, order, seven-day retention, and manual deletion.
- Verify semantic unchanged-context suppression and problem-fingerprint reset accuracy with screenshot sequences rather than pixel equality alone.
- Include Portuguese and English real-provider fixtures and packaged Windows Capture -> VPS API -> Response smoke scenarios.
- Preserve backward compatibility for legacy `design_system` workflow metadata and clients while keeping new System Design independent in the UI.
- Preserve screenshot text as untrusted evidence, no fabricated repository/infrastructure access, safe logs, encrypted credentials, consent revocation checks, and existing retention boundaries.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, evaluation datasets, concurrency/error state machine, observability fields, migration-free compatibility checks, deployment/rollback notes, and manual smoke scenarios. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-06 Durable Response Workspace Personalization

```text
/speckit-specify Specify durable cross-device Response workspace personalization for Persuando.

Objective:
Evolve the implemented local card-order editor into reliable, accessible workspace preferences that can follow an authenticated user across browsers and devices without weakening the current instant local experience.

Source request/context:
The live Response session now exposes Edit layout, Done arranging, and Reset layout. Every visible card can be sorted with pointer/touch drag, keyboard drag, or explicit earlier/later controls. The normalized order is versioned in browser local storage per assistant mode, automatically appends newly introduced cards, and removes stale or duplicate keys. This baseline changes no API contract or database schema.

Project context:
Use README.md, docs/architecture.md, docs/domain-model.md, docs/handoff.md, docs/reference-ui.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing authenticated Next.js Response -> NestJS API -> PostgreSQL architecture.

Requirements:
- Preserve the existing local-storage behavior as an immediate and offline-tolerant fallback.
- Define an additive authenticated preference contract for a versioned card order per assistant mode.
- Define deterministic local/server conflict resolution for first load, edits on multiple devices, stale versions, newly added cards, removed cards, malformed values, and reset-to-default.
- Keep pointer, touch, keyboard sorting, explicit move buttons, ARIA announcements, 44 px targets, and responsive left-to-right ordering accessible.
- Evaluate whether the first durable scope includes only ordering or also card visibility, card size/span, named layouts, and undo/redo; keep free-form pixel coordinates out unless justified by concrete UX evidence.
- Avoid coupling preferences to retained session artifacts or visual-guidance history; session deletion must not unexpectedly delete account-level layout preferences.
- Define loading, optimistic update, retry, offline, reconnect, and rollback behavior without layout flashes or silently overwriting a newer device preference.
- Include migration, authorization, same-account isolation, observability, and privacy requirements for any durable preference model.
- Include automated contract/unit tests and manual responsive browser smoke for mouse, touch, keyboard, reset, cross-device sync, and new-card normalization.

Artifact considerations:
Prefer additive REST/contracts and a narrowly scoped preference model. Document compatibility with existing local-storage key `persuando:response-layout:<assistantMode>:v1` and define a migration/versioning path rather than invalidating it silently.

Risks/assumptions:
The current layout is browser-local and intentionally not session history. Network latency can cause visible reorder rollback or multi-device last-write conflicts. Responsive grids translate one logical order into different row/column positions, so the spec must define order semantics independently of viewport geometry.

Expected output:
Produce a concise feature specification with acceptance criteria, preference/version model, conflict-resolution state machine, API and migration considerations, accessibility requirements, automated/manual validation matrix, deployment/rollback notes, and explicit deferred scope. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-07 Curated Multilingual System Design Reference

```text
/speckit-specify Specify a curated multilingual System Design learning reference for Persuando.

Objective:
Evolve the implemented static Portuguese System Design concept guide into a navigable, maintainable learning reference in Portuguese and English while keeping generated interview solutions fast and uncluttered.

Source request/context:
The implemented baseline places `Guia rápido de conceitos` before generated System Design explanations. It opens a responsive native dialog, lazily fetches `apps/response/public/system-design-reference.md`, renders through HTML-disabled React Markdown, and visually/semantically distinguishes blue concept names, green checked benefits, and red warning-labeled trade-offs. The current content covers load balancing, vertical/horizontal scaling, cache, CDN, SQL/NoSQL, sharding, consistent hashing, resharding, replication, database indexes, queues/event streams, rate limiting, CAP/consistency, and object storage with interview-speech examples.

Project context:
Use README.md, docs/architecture.md, docs/handoff.md, docs/reference-ui.md, docs/roadmap.md, specs/001-persuando-mvp/, and the existing Next.js Response application. Preserve the independent Code Practice/System Design generation lanes and current safe Markdown/Mermaid rendering.

Requirements:
- Define Portuguese and English reference content aligned with the live response-language selection without translating at provider runtime.
- Add accessible search, concept navigation, and a table of contents appropriate for a long modal on desktop and mobile.
- Preserve native dialog focus behavior, `Escape`, focus restoration, named controls, semantic headings, visible focus, and meaning independent of color.
- Define a content schema or authoring convention for concept name, purpose, use cases, positive properties, negative trade-offs, alternatives, common pitfalls, and interview speech.
- Define editorial accuracy review, ownership, source tracking, terminology consistency, versioning, and regression checks for static educational content.
- Decide whether content remains bundled Markdown or moves to a versioned application-owned content service; avoid provider-generated canonical reference text.
- Preserve on-demand loading, browser caching, safe failure/retry behavior, and no impact on session history, retention, or generation concurrency.
- Include automated tests and manual responsive/browser checks for language switching, search, navigation, focus, scroll position, contrast, and offline/static-asset failure.

Artifact considerations:
Prefer additive UI/content changes and preserve `system-design-reference.md` compatibility or define an explicit content-version migration. Avoid a database migration unless editorial workflow requirements clearly justify server-managed content.

Risks/assumptions:
System Design advice is contextual rather than universally prescriptive. A growing reference can become hard to scan, translations can drift semantically, and color-only meaning would be inaccessible. The generated answer must remain visually primary after the user closes the guide.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, content model, authoring/editorial workflow, localization behavior, accessible navigation design, validation matrix, deployment/rollback notes, and explicit deferred scope. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-07 System Design Diagram-Legend Quality Evaluation

```text
/speckit-specify Specify measurable semantic-quality evaluation for System Design Mermaid diagrams and explanatory legends in Persuando.

Objective:
Turn the implemented structural diagram-plus-legend contract into a measurable quality gate that verifies whether the visual architecture and its explanation actually agree, without slowing the normal interview-practice response path.

Source request/context:
New System Design guidance requires the first fenced Mermaid diagram to be immediately followed by `## Legenda do diagrama` in Portuguese or `## Diagram legend` in English. The legend must repeat visible labels and explain every important component, connection, responsibility, and incoming/outgoing request or data flow. The provider adapter currently validates adjacency and non-empty bullets with one repair attempt. Response extracts the pair from persisted Markdown, renders diagram and legend side by side, stacks them at narrow widths, and falls back to ordinary Markdown for legacy output.

Project context:
Use README.md, docs/architecture.md, docs/handoff.md, docs/reference-ui.md, docs/roadmap.md, specs/001-persuando-mvp/, the OpenAI-compatible provider adapter, and the existing Next.js Response Mermaid renderer. Preserve independent Code Practice/System Design generation, current strict Mermaid security, safe Markdown rendering, retained-history compatibility, and migration-free persistence unless the specification proves a schema change necessary.

Requirements:
- Define Portuguese and English fixtures for representative system designs, including simple, scaled, degraded, and intentionally inconsistent diagram/legend pairs.
- Measure node-label coverage, edge/flow coverage, responsibility accuracy, contradiction rate, important-component omissions, and irrelevant legend additions.
- Define which checks can be deterministic from a safely parsed Mermaid subset and which require offline evaluator/model scoring.
- Keep semantic evaluation out of the latency-critical generation path unless evidence justifies a bounded validation strategy.
- Specify repair behavior, user-visible fallback, observability, cost/latency budgets, false-positive handling, and provider compatibility.
- Define accessible desktop and narrow-screen acceptance criteria for side-by-side/stacked presentation, reading order, labels, Mermaid failure fallback, zoom/overflow, and retained legacy answers.
- Include automated provider/UI regression tests and a manual real-provider matrix in Portuguese and English.
- Preserve the current Markdown answer as the compatibility boundary or document an additive versioning/migration path for any proposed structured diagram metadata.

Artifact considerations:
Prefer additive fixture/evaluator tooling and a constrained Mermaid parser over executing diagram content. Treat screenshot text and generated prose as untrusted content. Do not weaken strict Mermaid security or HTML-disabled Markdown. Update contracts, persistence, retention, and deletion docs only if new stored evaluation artifacts are actually proposed.

Risks/assumptions:
Mermaid syntax is broad, visible labels do not always equal node identifiers, and a structurally complete legend can still be semantically wrong. Model-based evaluation may be nondeterministic and costly; deterministic parsing may reject valid diagrams outside the supported subset. The specification must separate release-blocking checks from advisory quality metrics.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, fixture taxonomy, evaluation architecture, supported Mermaid subset, scoring thresholds, latency/cost budgets, accessible visual test matrix, observability, rollout/rollback plan, and explicit deferred scope. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-07 Staged System Design Quality And Navigation

```text
/speckit-specify Specify staged System Design quality evaluation and optional answer navigation for Persuando.

Objective:
Measure whether generated System Design answers faithfully apply the implemented nine-stage interview method and define a lightweight way to navigate long answers without fragmenting generation or increasing provider latency.

Source request/context:
System Design now asks three to five grouped opening questions that collectively cover, in order, Requirements, Access patterns, horizontal/vertical Scale, Data, High-level design, Bottlenecks, Consistency, Failures, and Trade-offs. The answer contains one numbered level-two section for each concern; every section has Problem, Solution, Trade-off, and interview speech in order. An initial assumption-based Mermaid diagram appears before the stages and a final evolved diagram follows stage 9, each with an adjacent side-by-side legend. The provider structurally validates this contract and performs one repair attempt.

Project context:
Use README.md, docs/architecture.md, docs/handoff.md, docs/reference-ui.md, docs/roadmap.md, specs/001-persuando-mvp/, the OpenAI-compatible provider adapter, and the existing Next.js Response safe Markdown/Mermaid rendering. Preserve independent Code Practice/System Design lanes, one-call initial generation, persisted Markdown compatibility, simulation-authoritative prompting, and existing retention/deletion behavior.

Requirements:
- Define bilingual fixtures for vague and detailed prompts that score clarification coverage across all nine concerns without requiring nine repetitive questions.
- Score whether each stage identifies a real problem, justifies a solution, states meaningful positive and negative trade-offs, and provides natural first-person interview speech.
- Measure whether the initial diagram is a defensible minimum hypothesis and the final diagram materially reflects decisions made across the nine stages.
- Define deterministic structural checks separately from semantic evaluator/model checks, with thresholds, false-positive handling, latency, and cost budgets.
- Explore an accessible table of contents, sticky progress indicator, or collapsible stage navigation while preserving Markdown reading order and printable/history views.
- Keep the complete answer generated in one provider response unless measured evidence shows staged generation materially improves time-to-first-useful-content without confusing Auto mode.
- Include desktop/mobile, keyboard, screen-reader, bilingual, retained-history, malformed-output, and provider-repair acceptance scenarios.
- Avoid a database migration unless persisted per-stage state or progress is explicitly justified by cross-session user value.

Artifact considerations:
Prefer deriving navigation from existing level-two headings and persisted Markdown. Do not duplicate the answer into a second canonical stage schema without an explicit compatibility and migration plan. Preserve strict Mermaid security and HTML-disabled Markdown.

Risks/assumptions:
Long fixed-format answers can become repetitive; grouped questions can technically mention every concern without meaningfully scoping it; and model-based quality scores may be nondeterministic. Navigation must not hide the current interview narrative or make diagram/legend pairs lose their semantic reading order.

Expected output:
Produce a concise feature specification with measurable acceptance criteria, fixture and scoring matrix, navigation alternatives and recommendation, accessibility requirements, latency/cost budgets, compatibility analysis, rollout/rollback notes, and explicit deferred scope. Do not create tasks until /speckit-tasks is invoked.
```

## Next Spec Prompt - 2026-09-08 Progressive Persisted System Design Generation

```text
/speckit-specify Specify progressive, resumable System Design generation for Persuando.

Objective:
Reduce time to first useful System Design guidance by publishing clarification questions first and then the ordered architectural stages incrementally, without allowing independent prompts to contradict one another.

Source request/context:
The current implementation performs hidden visual analysis followed by one complete strict-JSON answer containing interpretation, three to five clarifying questions, assumptions, initial Mermaid plus legend, nine ordered Problem -> Solution -> Trade-off stages with interview speech, and final Mermaid plus legend. Results arrive over WebSocket only after the complete answer passes validation. System Design limits input to six recent screenshots, uses 3,200 visual-analysis and 12,000 answer tokens on the first attempt, and expands to 4,800/16,000 for its single bounded repair. A malformed, empty, or truncated final JSON is retried once with a compact-JSON instruction. Safe logs include the requested ceiling and available provider token usage. Response shows a non-terminal notice after three minutes, waits up to ten minutes, and aborts an individual provider request after four minutes. Code Practice must retain its independent 30-context policy and its new 6,400/8,000 visual plus 8,000/12,000 answer ceilings.

Project context:
Use README.md, docs/architecture.md, docs/handoff.md, docs/reference-ui.md, docs/roadmap.md, specs/001-persuando-mvp/, the NestJS realtime/provider modules, Prisma persistence, contracts package, and Next.js Response app. Preserve simulation-authoritative prompting, independent Code Practice/System Design lanes, safe Markdown, strict Mermaid rendering, consent, retention, and deletion.

Requirements:
- Model the flow as one durable generation job with a stable generationId, not unrelated user prompts.
- Publish interpretation, clarification questions, assumptions, and the initial diagram/legend as the first useful artifact.
- Define whether progression waits for interviewer/user answers or offers an explicit Continue with assumptions action; Auto mode must never confuse a continuation with a new exercise.
- Carry a compact canonical architecture state containing scope, requirements, scale assumptions, data decisions, chosen components, unresolved questions, and completed stage indexes.
- Generate stages strictly in order and persist each accepted partial artifact idempotently so reconnect/replay and process restarts cannot duplicate or reorder content.
- Publish WebSocket started/progress/partial/completed/failed events with mode, generationId, current stage, elapsed time, and safe error attribution.
- Preserve task-specific initial/repair token ceilings and record phase-level prompt, output, reasoning, total token, finish-reason, latency, and retry metrics without persisting generated content in operational logs.
- Define retry and repair at the smallest failed stage; never regenerate already accepted stages unless the user explicitly restarts the exercise.
- Build the final Mermaid and legend from the canonical accumulated state and validate agreement with earlier decisions.
- Preserve existing completed Markdown history through a backward-compatible projection or additive versioned representation.
- Keep Code Practice unchanged at up to 30 contexts and preserve simultaneous Code Practice/System Design execution.
- Include cancellation, superseded screenshot, new-problem detection, provider timeout, reconnect, duplicate click, partial persistence failure, and resume-after-restart behavior.

Artifact considerations:
Expect additive WebSocket contracts and likely additive persistence for generation jobs/stages. Define migration and rollback behavior, retained-history projection, deletion/retention cascade, observability, and compatibility with existing complete Markdown answers. Do not store provider secrets, image bodies, or chain-of-thought in progress records.

Risks/assumptions:
More calls may increase total wall-clock time and cost even while improving perceived latency. Independent stage prompts can drift unless every call is grounded in one canonical state. Partial UI must clearly distinguish draft, waiting-for-answer, running, completed, failed, and superseded states. Model routing should be measured rather than silently changed.

Expected output:
Produce a concise feature specification with state/event diagrams, data model and migration options, compatibility boundary, stage prompts/state schema, idempotency and retry rules, latency/cost targets, failure taxonomy, observability fields, automated/manual validation matrix, VPS rollout/rollback plan, and explicit deferred scope. Do not create tasks until /speckit-tasks is invoked.
```
