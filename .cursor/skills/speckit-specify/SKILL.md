---
name: speckit-specify
description: Project overlay for speckit.specify. Use when turning rough ideas, docs, or prototype learnings into Spec Kit feature specifications aligned with roadmap, handoff, constitution, and existing artifacts.
---

# Speckit Specify Overlay

Use this overlay before running the underlying GitHub Spec Kit specify workflow.

1. Load `.cursor/skills/project-context/SKILL.md`.
2. Load `.cursor/skills/specify-prompt-engineer/SKILL.md` to turn rough text into a structured
   command-ready prompt.
3. Read relevant `docs/`, `docs/handoff.md`, `docs/roadmap.md`, and `.specify/memory/constitution.md`.
4. If the feature is based on a prototype, read `docs/reference-ui.md`, `docs/lovable-prompt-base.md`,
   and relevant `references/lovable-template/` notes.
5. Keep the spec focused on user value, acceptance criteria, edge cases, non-goals, and success
   signals. Avoid implementation tasks until plan/tasks.
6. Surface conflicts between docs, constitution, and existing `specs/` before proceeding.

