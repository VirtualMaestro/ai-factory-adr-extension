---
name: adr-supersede
description: Supersede an old ADR with a newer one — reciprocal supersedes/Replaced-by links and an atomic move to superseded, preserving history.
---

mode: adr_supersession

purpose:
- replace an accepted or active decision while preserving history (PRD §19.7)
- link the new ADR to the old, move the old one to `superseded/`, and dispose of any orphaned plan
- own the judgment — confirming the replacement truly supersedes, and choosing the plan disposition — while `ai-factory adr supersede` owns the file mechanics

inputs:
- old_adr_file
- new_adr_file

preconditions:
- the old ADR status is `accepted` or `active`
- the replacement ADR exists and is already `accepted` or `active`
- the two ids differ
- the new decision genuinely replaces the old one, rather than duplicating it or changing something tangential

forbidden_behaviors:
- do not supersede to paper over a conflict: if the two ADRs are in tension, resolve that first by refining or by a fresh proposal
- do not pick the plan disposition silently: the user chooses explicitly
- do not move files by hand: the command owns the atomic move
- do not attempt optional memory synchronization: it is post-MVP and not provided by this skill

when_to_supersede_instead_of_editing:
- edit an active ADR directly only for non-material changes: code links, commit and PR references, implementation evidence, `live:`, file paths, spelling, formatting
- a rewrite of the body into CNL-P is a non-material change: it restates the same decision, so `adr-migrate` does it in place
- a material change to the Decision, constraints, scope, or consequences is not an in-place edit: it requires a new ADR that supersedes the current one (PRD §18.3)
- that is the reason to reach for this skill instead of rewriting an active decision

plan_disposition:
- `--archive-plan`: archive it with a superseded note, `archived_reason: superseded by <new-id>`, into `paths.archive/plans/`
- `--delete-plan`: delete it

workflow:
1. search accepted, active, and superseded ADRs for context; apply `code_intelligence` from `adr-overview` for replacement impact
2. verify every precondition; stop and accept the replacement via `adr-accept` first when it is still `proposed` or `draft`
3. ask the user to choose the plan disposition when the old ADR still has a non-archived plan
4. run `ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]`
5. report the `LIVE.md` entries whose refs the command rewrote
6. run `ai-factory adr status --check` and resolve any failures
7. verify the old ADR appears under `superseded` and the reciprocal links validate
8. run `ai-factory adr live check` and report the issues it lists
9. report the status footer

command_behaviour:
- adds `supersedes: [<old-id>]` to the new ADR
- sets `replaced_by: <new-id>` in the old ADR's frontmatter
- atomically moves the old ADR to `superseded/`, staged in Git as a rename
- disposes the plan per the flag
- rewrites every `LIVE.md` ref to the old id into the new id and stages `LIVE.md`, when the project keeps one and the replacement is already `active`
- leaves `LIVE.md` alone while the replacement is `accepted`: its finalize rewrites the refs, and until then the old code still runs
- changes nothing if a precondition fails (PRD §27): fix the cause and retry

retrieval_order_afterwards:
- a superseded ADR stays in Git as history, not as a rule (PRD §23)
- read active ADRs first
- treat accepted ADRs as pending decisions
- use superseded ADRs only for historical reasoning
- always open the source Markdown after any semantic lookup
- resolve contradictions in favor of the authoritative file and its lifecycle status

status_footer:
  format: "✔ adr-supersede · ADR: <old-id> [superseded] → <new-id> [<new-status>]"
  source: `ai-factory adr status <old-file>` and `ai-factory adr status <new-file>`

invocation:
- Claude Code: `/adr-supersede @old-adr @new-adr`
- Codex: `$adr-supersede @old-adr @new-adr`
