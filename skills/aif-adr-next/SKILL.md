---
name: aif-adr-next
description: Recommend which ADR to implement next — reads the dependency-ordered plan and points at the ready ADR to pick up. Read-only.
---

mode: adr_scheduling

purpose:
- answer which ADR to implement next, and in what order, when a project has many ADRs with `depends_on` links and the sequence is not obvious

inputs:
- none; the skill reads the dependency graph itself

scope:
- read the computed order and recommend one ADR to start with

forbidden_behaviors:
- do not transition anything
- do not edit anything
- do not invent work when nothing is ready
- do not call other skills as nested calls: apply their semantics inline in this run

outputs:
- the recommended ADR and why
- the handoff for it
- status footer

order_fields:
- `next`: ready now, meaning `accepted` ADRs whose every dependency is already `active`
- `order`: the full topological order of the schedulable backlog, each with what it waits on
- `blocked`: ADRs no order can reach yet, because a dependency is `superseded` or they sit behind a cycle
- `cycles`: dependency cycles, if any
- `active`: already-implemented decisions, as context

workflow:
1. run `ai-factory adr order`; add `--json` for the raw structure
2. report the cycle and stop when `cycles` is non-empty: no valid order exists
3. recommend breaking the cycle by revisiting one decision via `aif-adr-refine` or replacing one via `aif-adr-supersede`, then re-running
4. pick from `next` the ADR that unblocks the most downstream ADRs, scanning `order` and `blocked` for entries waiting on it
5. state the pick and why, then hand off: `aif-adr-plan`, then `aif-adr-implement`, then `aif-adr-finalize`
6. recommend finalizing the named dependency when `next` is empty but `order` or `blocked` is not
7. recommend `aif-adr-refine` or `aif-adr-accept` instead when that blocker is still `draft` or `proposed`
8. report the status footer

status_footer:
format: "✔ aif-adr-next · Next: <adr-id> [accepted] → aif-adr-plan"
empty_form: "✔ aif-adr-next · Next: none (waiting on <adr-id>)"
source: the pick you made from `ai-factory adr order`

invocation:
- Claude Code: `/aif-adr-next`
- Codex: `$aif-adr-next`
