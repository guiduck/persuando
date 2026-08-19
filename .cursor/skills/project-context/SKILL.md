---
name: project-context
description: Prepare project-aware Spec Kit and implementation work with docs-first context, prompt refinement, compatibility checks, prototype alignment, and documentation closeout. Use when the user invokes or discusses Spec Kit commands, asks to implement from tasks.md, or gives rough product direction that must align with docs, roadmap, handoff, and existing artifacts.
---

# Project Context

Use this skill before shaping or updating Spec Kit artifacts and before implementation work that could
drift from the project direction.

For `speckit.constitution`, `speckit.clarify`, `speckit.specify`, and `speckit.plan`, load
`.cursor/skills/specify-prompt-engineer/SKILL.md` first when the user request is rough, short, mixed
with context, or informal.

## Required Context

Read only the relevant project docs before proceeding:

- `README.md`
- `docs/overview.md`
- `docs/vision.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/handoff.md`
- `docs/domain-model.md` when domain entities are affected
- `docs/prototype.md` or `docs/reference-ui.md` when frontend/prototype work is affected
- `.specify/memory/constitution.md` when governance or Spec Kit alignment matters
- active `specs/**/spec.md`, `plan.md`, or `tasks.md` when continuing an existing feature

Also consider stack skills from `.agents/skills/` when relevant.

## Core Job

Turn informal product or implementation requests into project-aligned direction.

Always:

1. Extract the true product goal.
2. Align it with current docs, handoff, and roadmap.
3. Surface compatibility or architecture risks.
4. Keep prototype/reference UI intent connected to production implementation.
5. Call out doc conflicts before generating or updating spec artifacts.

## Spec Kit Guidance

### For `speckit.constitution`

- Keep principles concise and enforceable.
- Reflect current decisions from `docs/`.
- Include rules for docs-first discovery, prototype reference, Spec Kit artifacts, and closeout docs.

### For `speckit.specify`

- Convert loose ideas into concrete user stories, requirements, edge cases, and success criteria.
- Prefer additive, realistic scopes over speculative breadth.
- Preserve future compatibility with documented roadmap items.
- If the user provides a brief prompt, expand it into the real implementation intent before writing
  the spec.

### For `speckit.plan` and `speckit.tasks`

- Keep architecture boundaries explicit.
- Include docs, schema, contracts, UI, operational, and validation implications when relevant.
- Use prototype/reference UI as a requirement visualization guide, not as an excuse to copy brittle
  prototype code into production.
- Add documentation closeout tasks for affected docs, `docs/handoff.md`, `docs/roadmap.md`, and
  `docs/next-spec-prompt.md`.

### For `speckit.implement`

- Execute tasks in dependency order.
- Mark tasks complete only when implementation and validation are done.
- Before final response, update affected docs, `docs/handoff.md`, `docs/roadmap.md`, and
  `docs/next-spec-prompt.md`.

## Conflict Handling

If the request conflicts with `docs/`, the constitution, or generated specs:

- do not silently choose one
- describe the conflict
- propose the smallest coherent resolution

## Output Style

- concise
- implementation-oriented
- explicit about assumptions
- explicit about backward compatibility and project health

