---
name: adr-auto-plan
description: Run the ADR planning phase end to end for 1 or more ADRs — an Author writes each ADR and its plan, read-only reviewers check every round, the operator answers the principled questions and approves each draft, then 1 commit and push.
---

mode: adr_planning_run

purpose:
- carry 1 or more decisions from a topic, or from their current status, to an `accepted` ADR with a reviewed plan, in 1 pushed commit
- replace the manual sequence `adr-propose`, `adr-improve`, `adr-accept`, `adr-plan`, `adr-plan-improve` with 1 run
- split the writing from the judging: an Author writes, a reviewer in a fresh context checks each round, and this session triages and runs the checks
- ask the operator only what the operator alone can decide, and decide the rest inside the run

inputs:
- topics, ADR files, or both: a topic starts a new ADR, and a file continues from its current status

principled_questions:
- a principled question picks between viable options that a `git revert` does not undo: a public API, a data schema, a module boundary, a protocol, a dependency
- a principled question approves an action that deletes data or that no one can reverse
- a principled question fills a gap no research can close: the goal or the scope of the decision is unknown
- a contradiction between 2 ADRs of the batch is a principled question
- a plan finding that changes an accepted decision is a principled question
- any other question is minor: pick the option the applied skill recommends, and record the pick and its ground for the report

roles:
- orchestrator: this session; it writes the transitions, the commit, the push and the memory, and no ADR or plan text
- author: 1 per ADR, from its input to its reviewed plan, continued by message across the operator's stops; it writes the ADR and its plan and runs no transition
- reviewer_1: 1 review of 1 ADR or 1 plan, read-only, through `ai-factory adr review`
- reviewer_2: 1 fresh review, read-only, on a finding at or above `escalate_at`, and 1 read of the whole batch
- an Author the runtime cannot continue: start a fresh one with the ADR, its plan and the last review, and record it for the report
- a role whose runtime cannot run: take the next runtime of its fallback; with no subagents, do the role inline and state in the report that a check in the writing context is weaker

runtimes:
- `subagent`: start the host's subagent with the role's model and effort when the host takes them, and continue it by message, such as `SendMessage` to its id in Claude Code
- `codex-cli`: start `codex exec --json -s workspace-write -` with the brief on stdin, adding `-m <model>` and `-c model_reasoning_effort=<effort>` when set, and read `thread_id`
- continue a `codex-cli` writer with `codex exec resume <thread_id> -` and the message on stdin; do not start a writer with `--ephemeral`, which no resume reaches
- `claude-cli`: start `claude -p --session-id <uuid> --permission-mode acceptEdits` with the brief on stdin, adding `--model` and `--effort` when set; continue it with `claude -p --resume <uuid>`
- a reviewer of any runtime runs through `ai-factory adr review`, which holds its read-only flags and its timeout

routes:
- a topic: steps 5 to 44
- a `proposed` or `draft` ADR: steps 5 to 44 without step 6
- an `accepted` ADR without a plan: steps 25 to 44
- an `accepted` ADR with a plan: steps 28 to 44, on that plan
- a claimed ADR: stop at step 3

forbidden_behaviors:
- do not ask a minor question: the run exists so that the operator answers only principled ones
- do not accept an ADR without the operator's approval at the stop in step 19: accepting is the decision itself
- do not accept a draft that the batch read of step 18 has not seen
- do not implement the decision or write production code: that is `adr-auto-implement`
- do not write an ADR or a plan in this session: the Author writes them, and this session triages
- do not let a reviewer write: a review whose `ai-factory adr review end` exits non-zero does not count
- do not count a round that changed nothing as converged: a round converges on its checks and its review
- do not call other skills as nested calls: the Author applies each named skill's workflow in its own context
- do not write `depends_on` to order decisions: it orders implementation, and a spurious edge blocks `ai-factory adr order` with a cycle
- do not create or switch branches: the planning phase lands on the current branch
- do not commit or push before the operator approves every draft of the batch: a rejected draft interrupts the phase
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not push with `--force`
- do not write a capability list into `.ai-factory/DESCRIPTION.md`: the capabilities live in `LIVE.md`, which the finalize of each ADR updates

workflow:
1. run `ai-factory adr auto config --check` and stop on an error; record the `plan` roles it prints, with each fallback, for the report
2. run `ai-factory adr status <file>` for each input file, read its status and its `plan:` field, and route it by `routes:`
3. run `ai-factory adr claim --check <file>` for each input file, and stop at a refusal: another run holds that ADR on its branch
4. order the batch so that an ADR whose decision rests on the decision of another ADR of the batch follows that ADR
5. start 1 Author per ADR with the `author` role; brief it with the topic or the ADR file, the batch, the output of `ai-factory adr decisions`, and the rules of `AGENTS.md` and the memory
6. let the Author apply `adr-propose` to its topic, and drop a topic whose preconditions fail, recording where the fact belongs instead
7. improve round: let the Author apply the edits of `adr-improve` to its ADR, without the transitions and the convergence check of that skill: this session owns both
8. run `ai-factory adr validate <adr-file>` and `ai-factory adr live apply <adr-file> --dry-run`; send a failure back to the Author with its output, and repeat step 8
9. write the review brief to a file outside the tree: the ADR id, what this round changed, and the Author's contested picks, each as a claim to verify
10. run `ai-factory adr review begin --role reviewer_1 --phase plan --prompt <brief> --files <adr-file> --rubric adr --json`
11. for a `subagent` runtime, start a fresh read-only subagent with the prompt `begin` printed and write its answer to a file outside the tree; for a CLI runtime, run `ai-factory adr review run <id>`
12. run `ai-factory adr review end <id>`, with `--result <file>` for a subagent; on a non-zero exit, repeat from step 10 with `--runtime` set to the next runtime of the fallback, and record it
13. triage each finding against the ADR, `ai-factory adr decisions` and the code: confirmed, rejected with a reason and a reference, disputed, or principled by `principled_questions:`
14. park the ADR on a principled finding, and continue with the ADRs that do not rest on it
15. send the confirmed and disputed findings to the same Author by message: it fixes each confirmed one and answers each disputed one with evidence; decide each dispute, and record each minor pick with its ground
16. start a fresh Reviewer_2 over the ADR, as in steps 9 to 12 with `--role reviewer_2`, when a confirmed finding reaches `escalate_at`, after the Author's fixes; triage its findings by step 13
17. repeat steps 7 to 16 until the checks pass and no confirmed finding at or above `medium` remains, with rounds per ADR <= `max_rounds`; mark an ADR that still has one unsettled
18. start a fresh Reviewer_2 with every draft of the batch and `ai-factory adr decisions` once each ADR converged or parked, and record each contradiction it confirms as a principled question
19. stop when no ADR of the batch can advance without the operator: present every open principled question, then every draft ready for acceptance
20. present each draft ready for acceptance with its `decision:`, its minor picks with the finding each answers, and its unsettled mark if it has one
21. send each answer of the operator to the Author of its ADR by message, run steps 7 to 17 on that ADR and step 18 for the batch, then repeat from step 19
22. interrupt the phase when the operator rejects a draft: accept nothing, commit nothing, wait for the operator's instructions, and apply them as in step 21
23. keep the approval of a draft that the rounds after it leave unchanged, and present a changed draft for approval again
24. move each approved ADR still `proposed` to `draft` with `ai-factory adr transition`, apply `adr-accept` to each approved draft, and keep one whose preconditions fail in `draft` for the report
25. let the Author of each `accepted` ADR without a plan apply `adr-plan`, in the order `ai-factory adr order` reports; skip a documentation-only ADR: `adr-auto-implement` finalizes it with no plan
26. run `ai-factory adr resolve-plan <adr-file>` and `ai-factory adr format plan --check <plan-file>` for each plan of step 25, then `ai-factory adr status --check` and `ai-factory adr order`; send a failure back to the Author, and stop on a cycle
27. record the dependency warnings `adr-plan` states and continue: a plan may rest on an ADR not yet implemented, and the implementation phase waits for it
28. plan round: review each plan of step 25 as in steps 9 to 12, with `--files <plan-file> --rubric plan`; the brief asks the reviewer to map each `rules:` line of the ADR to a task or a test
29. the brief also asks the reviewer to check that each file a task names exists or that the task names it as new, and that each task meets `task_rules:` of `adr-plan`
30. triage as in step 13, let the Author apply the edits of `adr-plan-improve` for the confirmed findings, escalate as in step 16, run the checks of step 26, and repeat from step 28 until converged as in step 17
31. treat a plan finding that changes the accepted decision as a principled question, and stop for the operator once more before the commit
32. on "change the decision", remove the plan this run wrote, clear `plan:` in the ADR, run `ai-factory adr transition <adr-file> draft`, and run steps 7 to 30 for that ADR again
33. on "keep the decision", record the finding for the report, and let the Author write it into the risks of the plan
34. report a finding that changes the decision of a plan that existed before the run, and leave that ADR to the operator: this run removes no plan it did not write
35. release each Author when its ADR has a converged plan, or when the run stops
36. update each project document that an accepted decision makes incorrect, applying `aif-docs` semantics inline: `.ai-factory/DESCRIPTION.md`, `.ai-factory/ARCHITECTURE.md`, `AGENTS.md`, `README.md`, the docs directory
37. leave a document that describes current behaviour for the implementation phase: the code does not change in this run
38. update the project memory the runtime keeps with each durable fact of the run that it lacks, such as a convention the operator stated
39. stage by name the ADR files, plans and documents this run changed, `cnlp.config.json` when an accept added its corpus entry, and the memory file in the repository, and commit them in 1 commit by applying `aif-commit` without its push step
40. push the current branch: `git push`, or `git push -u origin <branch>` when the branch has no upstream
41. skip step 40 when `git.skip_push_after_commit` is true in `.ai-factory/config.yaml`, and skip steps 39 and 40 when `git.enabled` is false
42. record 1 row per stage and per round as it ends, naming the blocks or tasks it changed and the runtime of each review, and 1 row with its reason for each stage the run skips
43. report the rows in `report_format`, then the minor picks with their grounds, then the rejected findings with their reasons, then the warnings recorded
44. report the status footer

report_format:
```text
| ADR | Stage | Round | Reviewer | Changed | Result |
|---|---|---|---|---|---|
| — | config | — | — | — | author: subagent; reviewer_1: codex-cli → subagent; reviewer_2: subagent |
| `<adr-id>` | propose | — | — | created | `proposed` |
| `<adr-id>` | improve | 1 | reviewer_1, codex-cli | `decision:`, `rules:` | 2 confirmed, 1 rejected |
| `<adr-id>` | escalate | 1 | reviewer_2, subagent | — | 0 confirmed |
| `<adr-id>` | improve | 2 | reviewer_1, codex-cli | `scope:` | converged: 0 at or above medium |
| — | batch read | — | reviewer_2, subagent | — | 0 contradictions |
| `<adr-id>` | accept | — | — | — | `accepted`, approved by the operator |
| `<adr-id>` | plan | — | — | created `<plan-id>` | — |
| `<adr-id>` | plan round | 1 | reviewer_1, codex-cli | tasks 2, 5 | 3 confirmed |
| `<adr-id>` | plan round | 2 | reviewer_1, codex-cli | none | converged |
| — | docs | — | — | `README.md`, or none | — |
| — | memory | — | — | 1 fact, or none | — |
| — | commit | — | — | — | `<sha>` |
| — | push | — | — | — | `<branch>`, or skipped: <reason> |

Minor picks:
- `<adr-id>`: <finding> → <pick>: <ground>

Rejected findings:
- `<adr-id>` round <n>: <finding> — <reason>, <file:line>
```

status_footer:
  format: "✔ adr-auto-plan: <adr-id, ...> · planned: <n> · waiting: <m> · dropped: <k> · unsettled: <u> · pushed: <branch or no> → adr-auto-implement"
  source: `ai-factory adr status` for each ADR of the batch, where waiting counts the ADRs still `proposed` or `draft`
  note: the list names each ADR of the batch, in batch order; a rerun on the files the report lists continues each ADR from its status

invocation:
- Claude Code: `/adr-auto-plan <topic or @adr-file> ...`
- Codex: `$adr-auto-plan <topic or @adr-file> ...`
