---
name: specify-prompt-engineer
description: Transform informal product requests into structured, Spec Kit-ready prompts for speckit.constitution, speckit.clarify, speckit.specify, and speckit.plan. Use whenever the user gives a rough idea, short text, or loosely described request before generating or updating Spec Kit artifacts.
---

# Specify Prompt Engineer

Use this skill before `speckit.constitution`, `speckit.clarify`, `speckit.specify`, or
`speckit.plan` whenever the user's request is short, informal, incomplete, or mixed with context.

## Goal

Convert the user's raw request into a structured prompt that is safer for Spec Kit execution.

The rewritten prompt must:

1. preserve the real intent
2. align with current project docs and constitution
3. make assumptions explicit
4. surface compatibility and scope risks
5. prepare the next Spec Kit command to produce cleaner artifacts

## Required Context

Gather only the relevant context from:

- `README.md`
- `docs/`
- `docs/handoff.md`
- `docs/roadmap.md`
- `.specify/memory/constitution.md`
- the active spec, plan, or tasks artifact when one already exists

## Core Workflow

1. Identify the target command: `speckit.constitution`, `speckit.clarify`, `speckit.specify`, or
   `speckit.plan`.
2. Extract the real ask: desired change, affected product area, constraints, compatibility concerns,
   and important assumptions.
3. Anchor the prompt to project reality from docs and handoff.
4. Tailor the output to the command.

## Output Format

Use this format unless the user asks for a different one:

```markdown
## Command
[speckit.constitution | speckit.clarify | speckit.specify | speckit.plan]

## Objective
[What this command should accomplish]

## Source Request
[Short normalized summary of the user's original ask]

## Project Context
- Relevant area: [backend, frontend, worker, docs, AI, infra, mixed]
- Existing direction to preserve: [architecture, naming, workflow, product constraints]
- Current stage: [roadmap or handoff context when relevant]

## Requirements
- [Key requirement]
- [Key requirement]

## Existing Artifact Considerations
- [What existing doc/spec/plan/constitution behavior must stay aligned]
- [What nearby files or flows may need sync]

## Risks / Assumptions
- [Main regression, drift, or scope risk]
- [Explicit assumption]

## Expected Output
- [What the next Spec Kit command should produce]
- [What it should avoid]
```

## Quality Bar

Before handing the structured prompt to the next command, verify:

- the intent is clearer than the original request
- the prompt is aligned with current docs
- assumptions are explicit
- scope is not inflated unnecessarily
- risks or cross-area impacts are visible

