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
- status-directory mismatches and ADR validation errors;
- multiple non-archived plans for one ADR.

For duplicate IDs, broken artifact references, and other cross-artifact diagnostics, run
`ai-factory adr status --check`; it also runs the strict artifact audit and exits non-zero on
blocking errors. Optional-memory diagnostics are post-MVP and are not currently reported.

### Single ADR (`@adr-file`)

Run `ai-factory adr status <file>`. Report: ID; status; lifecycle location; linked active
plan; archived plan references; implementation evidence; dependencies; affected artifacts;
superseding and replacement relationships; validation errors and warnings.

## Invocation

Claude Code: `/aif-adr-status [@adr-file]` · Codex: `$aif-adr-status [@adr-file]`.
