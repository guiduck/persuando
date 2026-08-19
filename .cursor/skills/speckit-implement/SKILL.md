---
name: speckit-implement
description: Project overlay for speckit.implement. Use when executing tasks.md so implementation follows task order, validates changes, marks completed tasks, and performs mandatory documentation closeout before final status.
---

# Speckit Implement Overlay

Use this overlay while executing the underlying GitHub Spec Kit implementation workflow.

1. Run the standard Spec Kit prerequisite checks for the active feature.
2. Read active `tasks.md`, `plan.md`, `spec.md`, and available research/data-model/contracts/quickstart.
3. Execute tasks in dependency order. Respect parallel markers only when file ownership and
   dependencies allow it.
4. Mark a task complete in `tasks.md` only after implementation and validation for that task are done.
5. Preserve existing public contracts unless the task explicitly authorizes a breaking change.
6. Run focused tests and manual checks appropriate to the touched surface.
7. Before final status, load `.cursor/skills/implementation-closeout/SKILL.md` and complete the docs
   closeout.

