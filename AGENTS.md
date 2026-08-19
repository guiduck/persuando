# Agent Instructions

This repository supports both Cursor and Codex-style agents. Keep the Cursor workflow intact:
`.cursor/rules/project-sdd-rules.mdc` and `.cursor/skills/**` are the canonical source of truth.

For Codex, use this file as the top-level project brief and load mirrored workflow instructions from
`.codex/skills/**` when a task matches one of those skills.

## Project Context

Treat `README.md` and the files in `docs/` as the current product context.

Replace these placeholders for each project:

- `{{PROJECT_NAME}}`: project name
- `{{PRODUCT_ONE_LINER}}`: short description of the product
- `{{PRIMARY_STACK}}`: main stack, for example FastAPI/PostgreSQL, Next.js/PostgreSQL, or another stack
- `{{DEPLOYMENT_TARGET}}`: target deployment/runtime
- `{{PRIMARY_UI}}`: prototype, extension, web app, mobile app, CLI, or other operational UI

Default product workflow:

1. develop idea and initial documentation in `docs/`
2. create a navigable prototype from docs and `references/lovable-template/`
3. use the prototype as frontend/reference model for the scalable application
4. specify, plan, task, and implement through Spec Kit
5. keep handoff, roadmap, and next spec prompt current after each implementation

## Spec Kit Workflow

The shared Spec Kit runtime lives in `.specify/`; generated feature artifacts live in `specs/`.
Use those folders for both Cursor and Codex.

When the user invokes or discusses Spec Kit commands such as `speckit.specify`,
`speckit.constitution`, `speckit.clarify`, `speckit.plan`, `speckit.tasks`, or implementation from
`tasks.md`, first load the relevant Codex mirror under `.codex/skills/`.

Before `speckit.constitution`, `speckit.clarify`, `speckit.specify`, or `speckit.plan`, load and
follow:

- `.codex/skills/project-context/SKILL.md`
- `.codex/skills/specify-prompt-engineer/SKILL.md`

For general prompt refinement or change-risk review, consider:

- `.codex/skills/project-prompt-engineer/SKILL.md`
- `.codex/skills/change-impact-review/SKILL.md`

For Lovable prototypes, load:

- `.codex/skills/lovable-prompt-engineer/SKILL.md`

The active plan reference is:

- `{{ACTIVE_SPEC_PLAN}}`

## Conflict Handling

If `README.md`, `docs/`, `.specify/memory/constitution.md`, and generated artifacts in `specs/`
disagree, surface the conflict before proceeding. Resolve the smallest coherent interpretation with
the user instead of silently choosing one source.

## Optional Stack Skills

For frontend, web, or Next.js work, also consider relevant skills under `.agents/skills/`, for example:

- `.agents/skills/vercel-react-best-practices/SKILL.md`
- `.agents/skills/vercel-composition-patterns/SKILL.md`

For AI UI, chat UI, prompt workbench, or AI product flows, also consider:

- `.agents/skills/ai-elements/SKILL.md`
- `.agents/skills/ai-sdk/SKILL.md`

Do not load optional skills unnecessarily for unrelated backend, worker, scraper, or infra work.

## Engineering Guardrails

- Preserve existing public API contracts unless the user explicitly accepts a breaking change.
- Prefer additive changes and established project patterns over new abstractions.
- Keep implementation aligned with `docs/roadmap.md` and `docs/handoff.md`.
- Do not store secrets in source files; use environment-specific configuration.
- Update docs, tests, migrations, contracts, and operational notes when the change affects them.
- At the end of every implementation, update all affected documentation plus `docs/handoff.md` and
  `docs/roadmap.md`, and prepare the next Spec Kit `/speckit-specify` prompt in
  `docs/next-spec-prompt.md`. Treat this as a required closeout step even when the code change is
  otherwise complete.

