---
name: aif-adr-next
description: Recommend which ADR to implement next — reads the dependency-ordered plan and points at the ready ADR to pick up. Read-only.
---

# aif-adr-next

Answer *"which ADR do I implement next, and in what order?"* when a project has many ADRs with
`depends_on` links and the sequence is not obvious. This skill is **read-only**: it reports and
recommends, it never transitions or edits anything.

## Workflow

1. **Compute the order.** Run `ai-factory adr order` (add `--json` for the raw structure). It
   returns:
   - `next` — ready now: `accepted` ADRs whose every dependency is already `active`;
   - `order` — the full topological order of the schedulable backlog (each with what it waits on);
   - `blocked` — ADRs no order can reach yet (a dependency is `superseded`, or they sit behind a
     cycle);
   - `cycles` — dependency cycles, if any;
   - `active` — already-implemented decisions (context).

2. **Cycles first.** If `cycles` is non-empty, no valid order exists. Report the cycle and
   recommend breaking it — revisit one decision via `aif-adr-refine`, or replace one with
   `aif-adr-supersede` — then re-run. Stop here.

3. **Recommend the next ADR.** From `next`, pick the one to start with. Prefer the ADR that
   **unblocks the most downstream ADRs** (scan `order`/`blocked` for entries waiting on it) — that
   keeps the frontier moving. State the pick and why, then hand off:
   `aif-adr-plan` → `aif-adr-implement` → `aif-adr-finalize` for that ADR.

4. **Nothing ready?** If `next` is empty but `order`/`blocked` is not, the frontier is waiting on
   an upstream decision — either finalize the dependency it names, or, if the blocker is still a
   `draft`/`proposed`, move it forward first (`aif-adr-refine`/`aif-adr-accept`). Recommend that,
   don't invent work.

Do not call other skills as nested skills — apply their semantics inline in this run.

## Invocation

Claude Code: `/aif-adr-next` · Codex: `$aif-adr-next`.
