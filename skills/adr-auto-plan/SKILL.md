---
name: adr-auto-plan
description: Run the ADR planning phase end to end for 1 or more ADRs — propose, improve, accept, plan, update the docs, commit and push in one run, stopping only for principled questions and the acceptance decision.
---

mode: adr_planning_run

purpose:
- carry 1 or more decisions from a topic, or from their current status, to an `accepted` ADR with an improved plan, in 1 pushed commit
- replace the manual sequence `adr-propose`, `adr-improve`, `adr-accept`, `adr-plan`, `adr-plan-improve` with 1 run
- ask the operator only what the operator alone can decide, and decide the rest inside the run

inputs:
- topics, ADR files, or both: a topic starts a new ADR, and a file continues from its current status

principled_questions:
- a principled question picks between viable options that a `git revert` does not undo: a public API, a data schema, a module boundary, a protocol, a dependency
- a principled question approves an action that deletes data or that no one can reverse
- a principled question fills a gap no research can close: the goal or the scope of the decision is unknown
- a contradiction between 2 ADRs of the batch is a principled question
- any other question is minor: pick the option the applied skill recommends, and record the pick and its ground for the report

forbidden_behaviors:
- do not ask a minor question: the run exists so that the operator answers only principled ones
- do not accept an ADR without the operator's approval at the stop in step 8: accepting is the decision itself
- do not implement the decision or write production code: that is `adr-auto-implement`
- do not call other skills as nested calls: read each named skill and apply its workflow inline in this run
- do not write `depends_on` to order decisions: it orders implementation, and a spurious edge blocks `ai-factory adr order` with a cycle
- do not create or switch branches
- do not commit or push before the operator approves every draft of the batch: a rejected draft interrupts the phase
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not push with `--force`

workflow:
1. run `ai-factory adr status <file>` for each input file, and read its status and its `plan:` field
2. apply `adr-propose` to each topic, and drop a topic whose preconditions fail, recording where the fact belongs instead
3. order the batch so that an ADR whose decision rests on the decision of another ADR of the batch follows that ADR
4. apply `adr-improve` to each `proposed` or `draft` ADR in batch order, and repeat the pass until 1 pass changes no `decision:`, `scope:`, `constraints:` or `rules:` line
5. stop the passes on an ADR after pass 3, and mark it unsettled for the stop in step 8
6. park an ADR on a principled question at any stage, and continue with the ADRs that do not rest on it
7. read each draft of the batch in full against every other draft, and record each contradiction as a principled question
8. stop when no ADR of the batch can advance without the operator: present every open principled question, then every draft ready for acceptance
9. present each draft ready for acceptance with its `decision:`, its minor picks, and its unsettled mark if it has one
10. apply each answer of the operator through `adr-improve` on the ADR it concerns, with steps 4 and 5, then repeat from step 7
11. interrupt the phase when the operator rejects a draft: accept nothing, commit nothing, and wait for the operator's instructions
12. apply the instructions through `adr-improve` on the draft they concern, with steps 4 and 5, then repeat from step 7
13. keep the approval of a draft that the passes after it leave unchanged, and present a changed draft for approval again
14. apply `adr-accept` to each draft the operator approved, and keep a draft whose preconditions fail in `draft` for the report
15. apply `adr-plan` to each `accepted` ADR without a plan, in the order `ai-factory adr order` reports
16. skip `adr-plan` for a documentation-only ADR: `adr-auto-implement` finalizes it with no plan
17. record the dependency warnings `adr-plan` states and continue: a plan may rest on an ADR not yet implemented, and the implementation phase waits for it
18. apply `adr-plan-improve` to each plan this run created, and repeat the pass until 1 pass changes no task, with plan passes per plan <= 2
19. update each project document that an accepted decision makes incorrect, applying `aif-docs` semantics inline: `.ai-factory/DESCRIPTION.md`, `.ai-factory/ARCHITECTURE.md`, `AGENTS.md`, `README.md`, the docs directory
20. leave a document that describes current behaviour for the implementation phase: the code does not change in this run
21. update the project memory the runtime keeps with each durable fact of the run that it lacks, such as a convention the operator stated
22. stage by name the ADR files, plans and documents this run changed, with the memory file when it lives in the repository, and commit them in 1 commit by applying `aif-commit` without its push step
23. push the current branch: `git push`, or `git push -u origin <branch>` when the branch has no upstream
24. skip step 23 when `git.skip_push_after_commit` is true in `.ai-factory/config.yaml`, and skip steps 22 and 23 when `git.enabled` is false
25. record 1 row per stage and per pass as it ends, naming the blocks or tasks it changed, and 1 row with its reason for each stage the run skips
26. report the rows in `report_format`, then the minor picks with their grounds, then the warnings recorded
27. report the status footer

report_format:
```text
| ADR | Stage | Pass | Changed | Result |
|---|---|---|---|---|
| `<adr-id>` | propose | — | created | `proposed` |
| `<adr-id>` | improve | 1 | `decision:`, `rules:` | `draft` |
| `<adr-id>` | improve | 2 | none | converged |
| `<adr-id>` | accept | — | — | `accepted`, approved by the operator |
| `<adr-id>` | plan | — | created `<plan-id>` | — |
| `<adr-id>` | plan-improve | 1 | tasks 2, 5 | — |
| `<adr-id>` | plan-improve | 2 | none | converged |
| — | docs | — | `README.md`, or none | — |
| — | memory | — | 1 fact, or none | — |
| — | commit | — | — | `<sha>` |
| — | push | — | — | `<branch>`, or skipped: <reason> |

Minor picks:
- `<adr-id>`: <question> → <pick>: <ground>
```

status_footer:
  format: "✔ adr-auto-plan · planned: <n> · waiting: <m> · dropped: <k> · pushed: <branch or no> → adr-auto-implement"
  source: `ai-factory adr status` for each ADR of the batch, where waiting counts the ADRs still `proposed` or `draft`
  note: a rerun on the files the report lists continues each ADR from its status

invocation:
- Claude Code: `/adr-auto-plan <topic or @adr-file> ...`
- Codex: `$adr-auto-plan <topic or @adr-file> ...`
