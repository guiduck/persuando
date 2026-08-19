---
name: change-impact-review
description: Review proposed code or product changes for project health, backward compatibility, regression risk, artifact drift, and cross-module impact before implementation. Use when planning a feature, reviewing a prompt, or checking whether a change is safe to execute.
---

# Change Impact Review

Use this skill before implementation when the change could affect contracts, schemas, UI flows,
architecture boundaries, or project documentation.

## Review Inputs

Read only what is needed:

- the user request or structured prompt
- `docs/handoff.md`
- `docs/roadmap.md`
- relevant `docs/*.md`
- active `specs/**` artifacts
- nearby code/contracts/migrations when implementation files are known

## Review Checklist

Check:

- public API or data contract compatibility
- schema/migration impact
- auth, ownership, privacy, and secrets impact
- worker/background job effects
- UI state, loading, error, empty, and accessibility impact
- docs, roadmap, handoff, and next-spec prompt drift
- validation coverage and manual smoke needs

## Output

Lead with risks and decisions:

```markdown
## Findings
- [Severity] [Risk or issue] - [file/artifact when known]

## Required Adjustments
- [Scope, validation, doc, or compatibility adjustment]

## Assumptions
- [Assumption to confirm or document]

## Validation
- [Suggested tests or manual checks]
```

If no meaningful risk is found, say that clearly and mention residual validation needs.

