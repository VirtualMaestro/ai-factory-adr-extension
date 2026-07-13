---
name: aif-adr-implement
description: Implement an ADR's plan — resolve the plan by metadata, validate reciprocal links, keep the ADR accepted.
---

# aif-adr-implement

Start or continue implementation from an accepted decision (PRD §19.5). This skill drives the
work against the linked plan; it **never** advances the ADR — completing implementation is not
the same as finalizing the decision (that is `aif-adr-finalize`).

## Preconditions

Do not implement unless **all** hold:

- the ADR status is `accepted` and it is not superseded;
- exactly one non-archived plan implements it;
- the ADR↔plan links are reciprocal.

## Workflow

1. **Resolve the plan by metadata**, never by filename guessing:

   ```text
   ai-factory adr resolve-plan <adr-file>
   ```

   It resolves via the plan's `implements` frontmatter and exits non-zero if more than one
   non-archived plan matches (inv 7) — stop and fix that before continuing.
2. **Validate the links.** `ai-factory adr status --check` covers ADR invariants and runs
   the artifact audit using the configured ADR root. The `implements` side is also confirmed
   by `resolve-plan`. Do not proceed on a mismatch.
3. **Implement** the resolved plan by applying `aif-implement` semantics in this run; do not
   invoke `aif-implement` as a nested skill.
4. **Keep the ADR `accepted`.** Do not transition it merely because implementation work
   finished.
5. **Report the plan used** (its id and path).

## Invocation

Claude Code: `/aif-adr-implement @adr-file` · Codex: `$aif-adr-implement @adr-file`.
