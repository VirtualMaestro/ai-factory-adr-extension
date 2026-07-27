---
name: aif-adr-status
description: Report ADR status by wrapping the `ai-factory adr status` command.
---

mode: adr_reporting

purpose:
- read-only overview and diagnosis of ADR state (PRD §19.8)
- wrap `ai-factory adr status`

inputs:
- optional adr_file

forbidden_behaviors:
- do not mutate any state
- do not report optional-memory diagnostics: they are post-MVP and are not currently produced

workflow:
1. pick the mode: no argument selects the overview, `@adr-file` selects the single-ADR report
2. run `ai-factory adr status` for the overview; add `--json` for machine-readable output
3. report from it: proposals; drafts; accepted ADRs without plans; accepted ADRs with active plans; active ADRs; superseded ADRs; status-directory mismatches; ADR validation errors; ADRs with more than 1 non-archived plan
4. run `ai-factory adr status <file>` for a single ADR
5. report from it: id; status; lifecycle location; linked active plan; archived plan references; implementation evidence; dependencies; affected artifacts; superseding and replacement relationships; validation errors and warnings
6. run `ai-factory adr status --check` for duplicate ids, broken artifact references, and other cross-artifact diagnostics; it also runs the strict artifact audit and exits non-zero on blocking errors

invocation:
- Claude Code: `/aif-adr-status [@adr-file]`
- Codex: `$aif-adr-status [@adr-file]`
