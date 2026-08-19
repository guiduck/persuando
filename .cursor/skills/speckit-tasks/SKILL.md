---
name: speckit-tasks
description: Project overlay for speckit.tasks. Use when generating task breakdowns from a Spec Kit plan so implementation work includes validation, docs, handoff, roadmap, and next-spec closeout tasks.
---

# Speckit Tasks Overlay

Use this overlay before running the underlying GitHub Spec Kit tasks workflow.

1. Load `.cursor/skills/project-context/SKILL.md`.
2. Read active `plan.md`, `spec.md`, available contracts, data model, quickstart, and research.
3. Keep tasks independently executable and dependency ordered.
4. Include tests before implementation when the plan calls for TDD or contract safety.
5. Include documentation tasks for every affected doc.
6. Always include final tasks to update:
   - `docs/handoff.md`
   - `docs/roadmap.md`
   - `docs/next-spec-prompt.md`
7. Include manual smoke tasks when UI, OAuth, deployment, browser extension, external service, or
   operational behavior changed.

