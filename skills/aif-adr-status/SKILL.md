---
name: aif-adr-status
description: Report ADR status by wrapping the `ai-factory adr status` command.
---

# aif-adr-status

Read-only overview and diagnosis of ADR state (PRD §19.8). This skill **wraps
`ai-factory adr status` and never mutates state.**

## Workflow

### Overview (no argument)

Run `ai-factory adr status` (add `--json` for machine-readable output). Report:

- proposals; drafts;
- accepted ADRs without plans; accepted ADRs with active plans;
- active ADRs; superseded ADRs;
- status-directory mismatches; duplicate IDs; broken artifact references;
- multiple non-archived plans for one ADR;
- stale optional-memory index state (when a memory adapter is configured).

For CI, `ai-factory adr status --check` exits non-zero on blocking errors (also runs the
strict artifact audit).

### Single ADR (`@adr-file`)

Run `ai-factory adr status <file>`. Report: ID; status; lifecycle location; linked active
plan; archived plan references; implementation evidence; dependencies; affected artifacts;
superseding and replacement relationships; validation errors and warnings.

## Invocation

Claude Code: `/aif-adr-status [@adr-file]` · Codex: `$aif-adr-status [@adr-file]`.
