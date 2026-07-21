---
name: aif-adr-supersede
description: Supersede an old ADR with a newer one — reciprocal supersedes/Replaced-by links and an atomic move to superseded, preserving history.
---

# aif-adr-supersede

Replace an accepted or active decision **while preserving history** (PRD §19.7):
link the new ADR to the old, move the old one to `superseded/`, and dispose of
any orphaned plan. The `ai-factory adr supersede` command does the deterministic
file mechanics; **this skill owns the judgment** — confirming the replacement
truly supersedes and choosing the plan disposition.

## Preconditions

- old ADR status is `accepted` or `active`;
- the replacement ADR exists and is **already** `accepted` or `active` — never
  supersede before the replacement is accepted;
- the two IDs differ;
- the new decision genuinely replaces the old one (not a duplicate or a
  tangential change).

## When to supersede vs. edit in place (§18.3)

An **active** ADR may be edited directly only for non-material changes: code
links, commit/PR references, implementation evidence, file paths, spelling and
formatting. A **material** change to the Decision, constraints, scope, or
consequences is *not* an in-place edit — it requires a **new** ADR that
supersedes the current one. That is the reason to reach for this skill instead
of rewriting an active decision.

## Workflow

1. **Analyze.** Search accepted, active, and superseded ADRs for context.
   Confirm the replacement supersedes the old decision rather than conflicting
   with or duplicating it. If the two are actually in tension, resolve that first
   (refine or a fresh proposal) — do not supersede to paper over a conflict.
2. **Confirm the replacement is accepted.** If the new ADR is still `proposed`
   or `draft`, stop: accept it via `aif-adr-accept` before superseding.
3. **Decide the plan disposition.** If the old ADR still has a non-archived
   plan, the user must choose explicitly — **never** pick silently:
   - `--archive-plan` — archive it with a superseded note
     (`archived_reason: superseded by <new-id>`, → `paths.archive/plans/`);
   - `--delete-plan` — delete it.
4. **Supersede** — one deterministic call:

   ```text
   ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]
   ```

   It adds `supersedes: [<old-id>]` to the new ADR, sets `replaced_by: <new-id>`
   in the old ADR's frontmatter, atomically moves the old ADR to `superseded/`,
   and disposes the plan per the flag.
5. **Audit** — `ai-factory adr status --check`. Resolve any failures; the old
   ADR must appear under `superseded` and the reciprocal links must validate.
6. **Report the status footer** — end with one line naming both ADRs so what this run replaced is
   obvious at a glance:

   ```text
   ✔ aif-adr-supersede · ADR: <old-id> [superseded] → <new-id> [<new-status>]
   ```

   Fill it from `ai-factory adr status <old-file>` / `<new-file>`.

If a precondition fails the command changes nothing (§27) — fix the cause and
retry. Optional memory synchronization is post-MVP and is not provided by this skill.

## After superseding — retrieval order (§23)

A superseded ADR stays in Git as history, not as a rule. When reasoning over
ADRs later: read **active** ADRs first; treat **accepted** ones as pending
decisions; use **superseded** ones only for historical reasoning. Always open
the source Markdown after any semantic lookup, and resolve contradictions in
favor of the authoritative file and its lifecycle status.

## Invocation

Claude Code: `/aif-adr-supersede @old-adr @new-adr` ·
Codex: `$aif-adr-supersede @old-adr @new-adr`.
