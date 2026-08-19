---
name: project-prompt-engineer
description: Convert informal product or coding requests into structured prompts that preserve existing code patterns, protect backward compatibility, and account for project context. Use when the user writes casually, gives a rough idea, or wants a safer implementation prompt before changing code.
---

# Project Prompt Engineer

Turn informal requests into implementation-ready prompts that respect the existing project.

## Required Context

Before rewriting the prompt, gather only the relevant context from:

- `README.md`
- `docs/`
- existing files or symbols affected by the request
- current architecture and conventions already present in the repo

## Main Goal

Produce a prompt that:

1. captures the real intent
2. preserves existing code style and architectural direction
3. checks backward compatibility
4. identifies nearby files and flows that may also need changes
5. reduces regression risk

## Non-Negotiable Checks

Always consider:

- existing naming and folder conventions
- current abstractions and patterns already used
- public contract compatibility
- schema and migration impact
- docs and config drift
- tests or manual validation needed

## Output Format

```markdown
## Objective
[The real change to make]

## Context
- Relevant area: [backend, frontend, worker, docs, infra, mixed]
- Existing patterns to preserve: [naming, file layout, abstractions, API shape, UI conventions]
- Constraints: [compatibility, performance, scope, timeline]

## Requirements
- [Functional requirement]
- [Functional requirement]

## Existing Code Considerations
- [Pattern or convention that should be preserved]
- [Existing behavior that must remain compatible]

## Cross-Area Impact
- [Other modules, files, jobs, schemas, docs, or flows that may require updates]

## Risks
- [Regression or compatibility risk]
- [Assumption that should be validated]

## Acceptance Criteria
- [Observable result]
- [Observable result]

## Validation
- [Tests, lints, manual checks, migration checks, rollout checks]
```

