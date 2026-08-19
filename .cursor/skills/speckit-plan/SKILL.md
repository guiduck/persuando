---
name: speckit-plan
description: Project overlay for speckit.plan. Use when producing implementation plans from specs while preserving architecture boundaries, prototype intent, stack-specific skills, validation, and documentation closeout requirements.
---

# Speckit Plan Overlay

Use this overlay before running the underlying GitHub Spec Kit plan workflow.

1. Load `.cursor/skills/project-context/SKILL.md`.
2. Load `.cursor/skills/specify-prompt-engineer/SKILL.md` if the planning request is informal.
3. Read the active `spec.md`, relevant docs, `docs/handoff.md`, `docs/roadmap.md`, and constitution.
4. Load stack skills from `.agents/skills/` only when relevant to the planned work.
5. Preserve architecture boundaries already documented in `docs/architecture.md`.
6. Include validation, migration/contract, docs, deploy/config, and operational impacts when relevant.
7. Add explicit closeout requirements for affected docs, `docs/handoff.md`, `docs/roadmap.md`, and
   `docs/next-spec-prompt.md`.

