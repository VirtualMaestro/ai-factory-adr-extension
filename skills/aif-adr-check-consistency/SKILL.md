---
name: aif-adr-check-consistency
description: Check the accepted and active ADRs against each other — read the decision digest in one pass, name the pairs that overlap, and report contradictions, redundancy and shared areas. Read-only; reports verdicts, never rewrites.
---

mode: adr_consistency_sweep

purpose:
- answer whether the decisions the project has already accepted can all hold at once
- name the pairs that contradict, duplicate, or share an area
- be the decision-against-decision counterpart of `aif-adr-verify-all`, which checks decisions against code

inputs:
- none: the skill discovers the corpus itself

scope:
- accepted and active ADRs
- read-only inspection and 1 aggregated table

targeting_rationale:
- `ai-factory adr decisions` prints what every accepted and active ADR obliges, so the whole corpus costs 1 read
- a `proposed` or `draft` ADR is not a rule yet: 2 drafts in flight stop conflicting at `aif-adr-accept`, which reads the same digest before the transition
- a `superseded` ADR is history, and its obligations bind nothing
- structural checks are owned elsewhere: duplicate ids, broken references and cycles by `audit-artifacts`, dependency order by `ai-factory adr order`

forbidden_behaviors:
- do not edit any ADR
- do not edit the code
- do not reshape a Decision to make a pair agree
- do not assign a verdict from the digest alone: it carries no `out_of_scope`, no `alternatives`, and no grounds
- do not recommend `depends_on` for an overlap: it orders implementation, and a spurious edge blocks `ai-factory adr order` with a cycle
- do not call other skills as nested calls: apply their semantics inline in this run

outputs:
- 1 table, a row per reported pair
- per-pair follow-up recommendations

verdicts:
- contradiction: the obligations of the pair cannot both be met, in `decision:`, `constraints:`, `scope:` or `rules:`
- redundant: 1 ADR obliges nothing the other does not already oblige, across all 4 blocks
- shared-area: both rule 1 area and both sets of obligations hold together; a line in the report, not a defect

quality_rules:
- the architectural decision is already made: do not re-litigate it
- ground every verdict in a concrete rule, ADR clause, plan step, or code location
- no ground named, no verdict: research until you can name it, never guess
- report code or a plan diverging from the Decision as a deviation, with evidence
- do not resolve a deviation by reshaping the judgment to fit it
- do not excuse a deviation because fixing it would be laborious
- follow the project's existing conventions and invariants for tactical choices
- do not accept agent convenience — "faster", "easier" for this session — as an argument
- revise a verdict only on a new fact, a found reasoning error, or an explicit operator decision, and name what changed
- disagreement alone is not new information

workflow:
1. run `ai-factory adr decisions`
2. stop and report the `issues:` lines when it prints any: a sweep over a corpus with a hole gives a verdict nobody can act on
3. report that there is nothing to check and stop when the digest holds fewer than 2 ADRs
4. read the whole digest in 1 pass and name every pair whose obligations look like they touch the same subject; judge by what each pair obliges, never by the words it obliges it in, because 2 ADRs collide through their subject and name it differently
5. open both ADRs in full for every pair you named
6. assign 1 verdict per pair from the full documents, and drop the pair from the report when the reading clears it
7. aggregate 1 table, sorted worst-first: contradiction, then redundant, then shared-area
8. state each verdict with the block of each ADR it rests on, quoted
9. report the status footer

report_format:
```text
| Pair | Verdict | Evidence |
|---|---|---|
| `<id-a>` + `<id-b>` | contradiction | `<the obligation of each that cannot both hold>` |
```

follow_up:
- contradiction where 1 ADR is `accepted` and the other `active`: recommend `aif-adr-refine` on the `accepted` one, which is not implemented, while the `active` one is protected (PRD §18.3)
- contradiction where both are `accepted`: name it and stop; which decision yields is the operator's call, and both may need refining
- contradiction where both are `active`: name it and stop; both are implemented and protected, and the direction of replacement does not follow from the conflict
- redundant: name the overlap and stop; `aif-adr-supersede` takes an explicit old and new ADR, which coverage alone does not supply
- shared-area: no action; the row exists so the author of each ADR knows about the neighbour
- `aif-adr-supersede` runs after the operator names the pair, never before

status_footer:
  format: "✔ aif-adr-check-consistency · pairs: <n> · contradiction <a> · redundant <b> · shared-area <c>"
  source: the verdicts you assigned

invocation:
- Claude Code: `/aif-adr-check-consistency`
- Codex: `$aif-adr-check-consistency`
