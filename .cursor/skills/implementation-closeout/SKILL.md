---
name: implementation-closeout
description: Complete the required documentation and handoff closeout after implementation. Use before reporting any implementation complete, especially after Spec Kit tasks, code changes, migrations, tests, deploy/config changes, or user-facing behavior changes.
---

# Implementation Closeout

Use this skill before finalizing implementation work.

## Required Updates

Update all docs affected by the change, then always update:

- `docs/handoff.md`
- `docs/roadmap.md`
- `docs/next-spec-prompt.md`

## Handoff Requirements

`docs/handoff.md` must include:

- current status
- recent decision or change
- latest validation commands and outcomes
- remaining work
- recommended next Spec Kit step

## Roadmap Requirements

`docs/roadmap.md` must reflect:

- which phase or milestone changed
- what is done now
- what gates remain
- any explicit non-goals or deferred work

## Next Spec Prompt Requirements

`docs/next-spec-prompt.md` must be a command-ready prompt for the next useful `/speckit-specify`.
It should include:

- command
- objective
- source request/context
- project context
- requirements
- artifact considerations
- risks/assumptions
- expected output

## Final Check

Before final response:

- verify tests/validation were run or state why not
- confirm affected docs were updated
- mention any residual manual smoke or follow-up

