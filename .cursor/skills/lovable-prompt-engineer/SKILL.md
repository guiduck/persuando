---
name: lovable-prompt-engineer
description: Generate Lovable-ready super prompts from project docs, prototype goals, templates, and visual references. Use when the user asks for a Lovable prompt, super prompt, UI prototype prompt, landing page prompt, MVP prompt, or wants to adapt docs/ and references/lovable-template/ into a navigable prototype.
---

# Lovable Prompt Engineer

Generate project-aware Lovable super prompts that follow the repository's docs, product direction, and
reference templates.

## Required Context

Before producing the prompt, gather relevant context from:

- `docs/overview.md`
- `docs/vision.md`
- `docs/roadmap.md`
- `docs/handoff.md`
- `docs/domain-model.md` when entities matter
- `docs/reference-ui.md` or `docs/prototype.md` when available
- `docs/lovable-prompt-base.md`
- `references/lovable-template/`
- `references/images/` when visual references exist
- `README.md` when setup or positioning is needed

If some referenced files are missing, say which context was unavailable and proceed with explicit
assumptions.

## Core Goal

Do not summarize docs. Produce a complete Lovable-ready prompt that tells Lovable exactly what to
build, why it matters, what visual direction to follow, and how the prototype should behave.

The generated prompt should:

1. match the structure and specificity of the Lovable templates
2. adapt content to the current project
3. include screens, components, states, data, interactions, CTAs, and responsive behavior
4. use reference images as inspiration, not as owned assets unless the user says otherwise
5. ask for complete, production-ready prototype code unless the user requests planning only

## Prompt Shape

Use this structure by default:

```text
Create a complete, navigable, production-quality prototype for "{{PROJECT_OR_FEATURE_NAME}}".

=========================================================
PROJECT CONTEXT
=========================================================
[What the project does, who it serves, current phase, and business goal.]

=========================================================
PRODUCT GOAL
=========================================================
- Main objective:
- Primary user:
- Success outcome:
- Primary action:
- Secondary actions:

=========================================================
REFERENCE MATERIAL TO FOLLOW
=========================================================
- Use docs/ as product truth.
- Use references/lovable-template/ as prompt structure inspiration.
- Use references/images/ as visual inspiration when present.
- Do not copy unrelated business content.

=========================================================
INFORMATION ARCHITECTURE / SCREENS
=========================================================
[Screens, sections, purpose, content, components, interactions, states.]

=========================================================
CORE FEATURES
=========================================================
[Feature requirements grounded in docs.]

=========================================================
DESIGN SYSTEM
=========================================================
Colors:
Typography:
Spacing and Layout:
Components:
Motion:

=========================================================
RESPONSIVE REQUIREMENTS
=========================================================
[Desktop, tablet, mobile behavior.]

=========================================================
DATA MODEL AND CONTENT
=========================================================
[Realistic fields, labels, statuses, sample records, and copy.]

=========================================================
ACCESSIBILITY / PERFORMANCE
=========================================================
[Keyboard, focus, contrast, reduced motion, performance expectations.]

=========================================================
TECH STACK
=========================================================
Use React, TypeScript, Vite or Next.js as appropriate, Tailwind CSS, and Lucide icons unless project
docs specify another stack.

COMPLETE, NAVIGABLE PROTOTYPE.
```

If the user asks in Portuguese, produce the final Lovable prompt in Portuguese unless they request
English.

