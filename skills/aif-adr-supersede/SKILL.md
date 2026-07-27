---
name: aif-adr-supersede
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
- do not supersede before the replacement is accepted: if the new ADR is still `proposed` or `draft`, stop and accept it via `aif-adr-accept` first
- do not supersede to paper over a conflict: if the two ADRs are in tension, resolve that first by refining or by a fresh proposal
- do not pick the plan disposition silently: the user chooses explicitly
- do not move files by hand: the command owns the atomic move
- do not attempt optional memory synchronization: it is post-MVP and not provided by this skill

when_to_supersede_instead_of_editing:
- an active ADR may be edited directly only for non-material changes: code links, commit and PR references, implementation evidence, file paths, spelling, formatting
- a material change to the Decision, constraints, scope, or consequences is not an in-place edit: it requires a new ADR that supersedes the current one (PRD §18.3)
- that is the reason to reach for this skill instead of rewriting an active decision

plan_disposition:
- `--archive-plan`: archive it with a superseded note, `archived_reason: superseded by <new-id>`, into `paths.archive/plans/`
- `--delete-plan`: delete it

outputs:
- reciprocal `supersedes` and `replaced_by` links
- the old ADR in `superseded/`
- the plan disposed per the chosen flag
- status footer

workflow:
1. search accepted, active, and superseded ADRs for context
2. confirm the replacement supersedes the old decision rather than conflicting with or duplicating it
3. confirm the replacement is `accepted` or `active`
4. ask the user to choose the plan disposition when the old ADR still has a non-archived plan
5. run `ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]`
6. run `ai-factory adr status --check` and resolve any failures
7. confirm the old ADR appears under `superseded` and the reciprocal links validate
8. report the status footer

command_behaviour:
- adds `supersedes: [<old-id>]` to the new ADR
- sets `replaced_by: <new-id>` in the old ADR's frontmatter
- atomically moves the old ADR to `superseded/`
- disposes the plan per the flag
- changes nothing if a precondition fails (PRD §27): fix the cause and retry

retrieval_order_afterwards:
- a superseded ADR stays in Git as history, not as a rule (PRD §23)
- read active ADRs first
- treat accepted ADRs as pending decisions
- use superseded ADRs only for historical reasoning
- always open the source Markdown after any semantic lookup
- resolve contradictions in favor of the authoritative file and its lifecycle status

status_footer:
format: "✔ aif-adr-supersede · ADR: <old-id> [superseded] → <new-id> [<new-status>]"
source: `ai-factory adr status <old-file>` and `ai-factory adr status <new-file>`

invocation:
- Claude Code: `/aif-adr-supersede @old-adr @new-adr`
- Codex: `$aif-adr-supersede @old-adr @new-adr`
