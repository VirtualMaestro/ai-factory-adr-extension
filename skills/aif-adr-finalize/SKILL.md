---
name: aif-adr-finalize
description: Finalize an ADR — run strict verification, then activate the ADR and archive its plan on success.
---

# aif-adr-finalize

Verify the implementation and activate the decision (PRD §19.6): move an `accepted` ADR to
`active`. The `ai-factory adr finalize` command does the deterministic file mechanics
(evidence, atomic move, plan archival); **this skill owns the judgment** — strict verification
and the contradiction check — that must pass first.

## Preconditions

- the ADR status is `accepted` and it is not superseded;
- a linked plan exists **or** the ADR explicitly states no implementation is required.

## Plan-backed workflow

1. **Resolve the plan.** `ai-factory adr resolve-plan <adr-file>` — verification must target
   this plan unambiguously.
2. **Verify strictly.** Apply strict `aif-verify` semantics in this run; do not invoke
   `aif-verify` as a nested skill. Require a **non-blocking pass**. Check that the implementation
   matches the ADR **Decision** and, where testable, its known Consequences and risks.
3. **On a verification failure, stop** and leave the ADR `accepted`. Report what failed.
4. **If the implementation contradicts the accepted Decision, finalization must fail.**
   Recommend returning the ADR to draft via `aif-adr-refine` — **never** silently rewrite the
   Decision to match the code.
5. **Record evidence** in the ADR frontmatter — a short string, e.g.:

   ```yaml
   evidence: implemented, commit abc1234, verified by tests+lint
   ```

   Detailed implementation notes (commit lists, verification steps) stay as prose in the ADR
   body, not in `evidence:`; a tracker link goes in the frontmatter `issue:` field. Also fill
   the frontmatter `code:` array — the primary
   entry-point anchors an agent starts tracing from, not every touched file. Convention:
   paths relative to the repo root, POSIX `/` separators, optional `#symbol` suffix
   (`src/status.js#validateDirStatus`); verify each anchor exists before writing it.
   This happens **before** step 6, so the ADR transitions with its anchors in place.

6. **Finalize** — one deterministic call:

   ```text
   ai-factory adr finalize <adr-file>
   ```

   It sets `evidence: implemented` **only if** the frontmatter `evidence:` field is still
   empty — an authored value (commit refs, verification notes) is preserved —
   then atomically moves the ADR to `active/`, and archives the
   plan following `aif-archive` semantics (→ `paths.archive/plans/`, `status: done`,
   `archived: YYYY-MM-DD`, filename preserved).
7. **Audit** — `ai-factory adr status --check`. Resolve any failures.

## Documentation-only ADRs

An ADR with `evidence: documentation-only` (or `documentation-only decision`) in its
frontmatter skips verification and the plan steps entirely. Set that field, then run
`ai-factory adr finalize <adr-file>` directly: with no plan and a documentation-only
`evidence:` it activates the ADR without a plan. `plan:` stays empty.

## Invocation

Claude Code: `/aif-adr-finalize @adr-file` · Codex: `$aif-adr-finalize @adr-file`.
