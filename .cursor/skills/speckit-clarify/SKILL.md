---
name: speckit-clarify
description: Project overlay for speckit.clarify. Use when resolving ambiguities in a Spec Kit feature before planning, especially where docs, prototype behavior, roadmap, or implementation constraints could diverge.
---

# Speckit Clarify Overlay

Use this overlay before running the underlying GitHub Spec Kit clarify workflow.

1. Load `.cursor/skills/project-context/SKILL.md`.
2. Load `.cursor/skills/specify-prompt-engineer/SKILL.md` if the clarification request is informal.
3. Read the active `spec.md`, relevant docs, `docs/handoff.md`, and the constitution.
4. Ask only clarifications that materially affect scope, data model, UX, operations, validation, or
   compatibility.
5. Encode accepted answers back into the spec so later plan/tasks do not need to rediscover them.

