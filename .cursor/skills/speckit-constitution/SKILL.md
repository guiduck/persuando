---
name: speckit-constitution
description: Project overlay for speckit.constitution. Use when creating or updating the Spec Kit constitution so docs-first discovery, prototype-first UI validation, Cursor/Codex skill alignment, and documentation closeout rules are encoded before other Spec Kit work.
---

# Speckit Constitution Overlay

Use this overlay before running the underlying GitHub Spec Kit constitution workflow.

1. Load `.cursor/skills/project-context/SKILL.md`.
2. Load `.cursor/skills/specify-prompt-engineer/SKILL.md` when the user input is informal.
3. Read relevant `docs/`, especially `docs/vision.md`, `docs/roadmap.md`, and `docs/handoff.md`.
4. Ensure the constitution includes:
   - docs-first product direction
   - prototype/reference UI before scalable frontend implementation
   - Spec Kit traceability through `.specify/` and `specs/`
   - Cursor/Codex mirrored skills and rules
   - compatibility by default
   - required implementation closeout docs
5. After constitution changes, update any affected rules, skills, or docs that would otherwise drift.

