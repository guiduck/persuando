# Persuando Constitution

## Purpose

This constitution is the durable governance source for Persuando specs, plans, tasks, prototypes, and
implementations. It overrides local convenience when product direction, architecture, privacy,
consent, responsible AI use, documentation workflow, or Spec Kit execution are in question.

## Core Principles

### I. Consent-First Capture

All sensitive capture and AI processing MUST require explicit user consent before activation.
Consent is required for microphone capture, audio transcription, backend transmission, external AI
provider usage, screenshots, visual analysis, code copilot mode, and detection of apps or sites such
as Meet, Teams, LeetCode, or HackerRank.

Consent MUST be revocable. Sensitive modes MUST remain visible to the user while active and MUST be
controllable from settings, session controls, or Windows tray controls. Specs and implementation MUST
define active, paused, revoked, and ended states for any sensitive mode they introduce.

### II. Responsible Use Boundary

Persuando MUST be built and described as a productivity, preparation, coaching, and study assistant.
The project MUST NOT specify, design, implement, market, or imply features for invisibility,
bypassing screen sharing, bypassing recording, bypassing browser focus detection, bypassing
proctoring tools, evading platform rules, or cheating in interviews, assessments, or coding
challenges.

Code copilot mode MUST be opt-in, off by default until the user grants explicit session consent, and
positioned for study, practice, preparation, and review. It MAY be part of the MVP only when it is
visible, consent-gated, user-controlled, and does not implement or imply evasion, proctoring bypass,
platform-rule bypass, or cheating behavior.

### III. Two-Mode Architecture

Future specs and implementation MUST preserve the Capture Mode / Response Mode separation unless this
constitution is explicitly amended.

Capture Mode owns local desktop behavior, tray/background behavior, capture controls, local device
permissions, and secure local handling of user provider credentials where applicable.

Response Mode owns live session display, transcript review, summaries, insights, suggested responses,
and future code-practice explanations.

The backend owns authentication, session membership, event ingestion, realtime fan-out, provider
orchestration, persistence, and retention enforcement.

### IV. TypeScript-First MVP

The MVP SHOULD prefer TypeScript-compatible choices: Electron, React, and TypeScript for the
Windows-first Capture App; Next.js, React, and TypeScript for the Response App; and Node.js for
backend services. The backend framework choice between Fastify and NestJS is a planning decision and
MUST NOT be settled by this constitution.

Rust, C#, native modules, or deeper OS integrations MAY be introduced only when a validated product
need cannot reasonably be satisfied by TypeScript, Electron, and the selected Node.js architecture.

### V. Narrow MVP Before Advanced Context

MVP specs MUST stay focused on login and session connection, settings, consent, user API key entry,
Windows tray/background behavior, microphone capture, authorized screen/coding context capture for
copilot mode, realtime transcription, backend session streaming, Response App transcript, summary,
meeting suggestions, and study/practice code copilot assistance.

The following capabilities are deferred unless a later spec explicitly promotes them: robust
system-audio capture, advanced diarization, automatic LeetCode/HackerRank detection, local/offline
models, non-Windows desktop apps, and any stealth/evasion-oriented screen behavior. MVP screen or
coding-context capture is permitted only for visible, consented copilot assistance.

### VI. Privacy And Credential Safety

Provider credentials, secrets, and user API keys MUST NOT be committed to source code or written to
logs. Future implementation MUST define secure storage and transmission expectations for user
credentials, session data, transcript segments, screenshots, AI provider payloads, and retention
settings.

Retention choices MUST be explicit and user-controllable. Plans and tasks that introduce captured or
generated data MUST define storage location, retention behavior, deletion behavior, and any provider
transmission boundary.

### VII. Documentation-First Workflow

`README.md` and `docs/` are the product context source for planning. Every meaningful change MUST
keep affected docs current, especially `docs/overview.md`, `docs/vision.md`,
`docs/architecture.md`, `docs/domain-model.md`, `docs/roadmap.md`, `docs/handoff.md`, and
`docs/next-spec-prompt.md`.

If documentation and generated Spec Kit artifacts disagree, the conflict MUST be surfaced before
work proceeds. Agents and engineers MUST resolve the smallest coherent interpretation rather than
silently choosing one source.

### VIII. Prototype Before Production UI

Before scalable production UI implementation, user workflows SHOULD be validated through a navigable
prototype based on `docs/`, `docs/lovable-prompt-base.md`, `docs/reference-ui.md`, and
`references/lovable-template/`.

Prototype decisions SHOULD guide production UX, information hierarchy, and interaction states.
Brittle prototype code MUST NOT be copied into production by default.

### IX. Spec Kit Discipline

Specs MUST define user value, requirements, edge cases, non-goals, assumptions, and acceptance
criteria. Plans MUST define architecture boundaries, data flow, interfaces, validation, and
operational concerns. Tasks MUST include implementation, tests, documentation updates, handoff
updates, roadmap updates, and next-spec prompt updates.

Implementation is not complete until validation and documentation closeout are complete.

## Architecture Governance

Persuando is governed as a two-mode product connected by backend realtime sessions. Any feature that
captures local context belongs first to Capture Mode. Any feature that displays or reviews session
assistance belongs first to Response Mode. Any feature that authenticates users, coordinates session
membership, persists data, calls providers, fans out realtime events, or enforces retention belongs
first to the backend.

Specs and plans MUST document cross-boundary contracts before implementation: event payloads,
permission states, session membership rules, provider invocation boundaries, persistence behavior,
and error states. Public API, schema, and workflow changes SHOULD be additive by default; breaking
changes require explicit approval.

## Privacy And Consent Governance

Privacy and consent are product requirements, not optional polish. Every spec that touches capture,
AI processing, provider credentials, session data, or retained artifacts MUST identify:

- what is captured or generated;
- which consent grant authorizes it;
- where it is processed;
- where it is stored;
- who can view it;
- how it can be paused, revoked, redacted, deleted, or retained.

Sensitive capabilities MUST default to off unless a prior explicit user setting and active session
consent make activation clear, visible, and revocable.

## Responsible AI Governance

AI features MUST operate only on authorized session context and MUST respect the user's configured
provider and retention settings. Product language and generated artifacts MUST frame AI output as
assistance, suggestions, explanations, summaries, or coaching rather than guaranteed answers or
rule-evasion capability.

Specs involving AI MUST include expected failure modes such as latency, partial transcripts,
provider errors, low confidence, hallucinated suggestions, missing context, and user revocation
during processing.

## Documentation And Spec Kit Workflow

Cursor workflow files remain canonical for shared agent behavior: `.cursor/rules/project-sdd-rules.mdc`
and `.cursor/skills/**`. Codex mirrors under `.codex/skills/**` MUST be used when a task matches the
corresponding workflow. Shared Spec Kit runtime artifacts live in `.specify/`; generated feature
artifacts live in `specs/`.

Before `speckit.constitution`, `speckit.clarify`, `speckit.specify`, or `speckit.plan`, agents MUST
load the project-context and specify-prompt-engineer workflow instructions. Implementation from
`tasks.md` MUST follow task order and MUST complete validation, docs, handoff, roadmap, and
next-spec-prompt closeout before reporting completion.

## Amendment And Check Process

Constitution changes MUST be explicit, reviewed against `README.md`, `docs/`, `.cursor/skills/**`,
`.codex/skills/**`, `.specify/`, and active `specs/` artifacts, and recorded with the reason for the
change. Any amendment that changes product scope, responsible-use boundaries, architecture ownership,
privacy expectations, or Spec Kit workflow MUST also identify which docs, rules, skills, templates,
or specs need updates to stay aligned.

Before approving any future spec, plan, or implementation, agents and engineers MUST check it against
this constitution for consent, responsible use, architecture boundaries, MVP scope, privacy,
documentation, prototype, and Spec Kit discipline.
