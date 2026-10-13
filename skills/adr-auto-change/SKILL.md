---
name: adr-auto-change
description: Run a change without an ADR from a topic, full plan or ultra bundle — plan, improve, implement, test, verify, review, update LIVE.md, archive, commit and push. `plan` stops at a committed plan; `implement` builds one.
---

mode: plan_change_run

purpose:
- carry 1 change that needs no ADR from a topic or an unlinked plan to tested code, an archived plan and 1 commit
- split the change into 2 runs when the operator reviews the plan first: a `plan` run commits the improved plan, an `implement` run builds it
- replace the manual sequence `aif-plan full`, `aif-improve`, `aif-implement`, `aif-qa`, `aif-verify`, `aif-review`, live apply, `aif-archive`, `aif-commit`
- stop on a blocker instead of asking the operator to repair the plan during implementation

inputs:
- 1 topic, full plan file, ultra bundle directory or its `index.md`, without `implements:`
- an optional mode word before it, `plan` or `implement`; without one the run covers both phases

run_modes:
- `plan`: run steps 1, 3 to 5, 8 to 16 and 18 to 23, then steps 56 to 58: the run improves the plan, commits it and writes no code
- `implement`: run steps 1 to 14, 20 and 24 to 58 on an existing plan: the run takes the plan as approved and does not improve it
- no mode word: run steps 1, 3 to 15, 17 to 20 and 24 to 58: both phases in 1 run and 1 commit, with no questions

principled_questions:
- a principled question changes what the plan rests on: its architecture, a tool or dependency, a public API, a data schema, a module boundary or a protocol
- a principled question changes the goal or the scope of the original request, or fills a gap no research of the code can close
- a principled question approves an action that deletes data or that no one can reverse
- any other question is minor, such as an edge case, a task order, a test case or a name: pick the scoped default, and record the pick and its ground for the report

forbidden_behaviors:
- do not ask the operator anything outside step 16: pick the scoped default for a minor question and report it
- do not pick a default for a principled question outside a `plan` run, at any step: stop, report it with its options, and commit nothing
- do not ask a minor question in step 16, such as a planning preference, a commit checkpoint or whether to push
- do not create an ADR, accept a decision or change an ADR's lifecycle status: route a standing decision to `adr-propose` and stop
- do not take the configured fast plan (`paths.plan`, default `.ai-factory/PLAN.md`): `aif-archive` does not archive it
- do not implement or apply a plan with `implements:`: route it to `adr-auto-implement`
- do not create or switch branches: the operator picks the branch before the run
- do not call other skills as nested calls: read each named skill and apply its workflow inline, or in a subagent where a step says so
- do not apply the completion injection of `aif-implement`, delete the plan or commit between tasks: step 46 is the sole live apply, and step 48 owns archive
- do not change the plan's scope or original request to make a finding pass: a finding the plan cannot meet stops the run
- do not skip, disable or weaken a failing test, or rerun it until it passes: a flaky failure is a finding
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and the commit body
- do not let the exploratory subagent change a file of the repository, or reach a paid or remote service the instructions file does not allow
- do not report a fresh subagent without its runtime invocation and returned result: a separate check in this context is inline
- do not write a capability list into `.ai-factory/DESCRIPTION.md`: the capabilities live in `LIVE.md`
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not write code, tests, documents or `LIVE.md` in a `plan` run: its commit holds the plan alone
- do not split the implementation across commits: code, tests, QA, documents, memory, archived plan and `LIVE.md` land together
- do not push with `--force`

workflow:
1. read the mode from the first word of the input, `plan` or `implement`, and take only the steps `run_modes` names for it
2. stop on an `implement` input that names no plan file or ultra bundle: the mode builds an approved plan and makes none; name the rewording for a topic
3. read `.ai-factory/config.yaml` and `.ai-factory/adr-extension.yaml`: resolve the plan, plans, QA, archive and live paths, git settings and optional `adr.acceptance` configuration
4. run `git status` when `git.enabled` is true, and stop when any change sits outside the plans directory and the QA directory; stop on a dirty `LIVE.md` too
5. record the exact pre-existing plan and QA paths: stage only this run's changed files later, not unrelated artifacts already present
6. run `adr.acceptance.command` once when it is set, and stop when it fails: the run did not cause that failure
7. stop when `adr.acceptance.exploratory.instructions` names a missing file; use its `rounds` limit when configured
8. read `ai-factory adr live` and `ai-factory adr decisions`; stop and report its `next:` line when `ai-factory adr live` exits 1
9. stop on an input fast plan or a plan with `implements:`, and name the route from `forbidden_behaviors`
10. inspect the topic or existing plan against the active decisions: stop and recommend `adr-propose` when it binds work beyond this change
11. name an active ADR whose capability the change alters or removes, and continue: live apply records removal debt, which the report routes to `adr-auto-plan`
12. make a full plan by `aif-plan full` semantics for a topic, on the current branch, or take the given full file or ultra entrypoint; validate the ultra marker and phase links by core plan semantics
13. write 1 `adr-live` fence after the entrypoint's title when it has none, keeping a Handoff line first: use `changes:` with double-quoted summaries or `none:` with the reason
14. read `ai-factory adr format` and reuse the capability ids in LIVE.md; write summaries with its lexicon and name durable refs for code the plan describes
15. apply `aif-improve` semantics to the plan, picking a scoped default for each minor question, with passes per plan <= 5; preserve its original request and the first fence
16. ask the operator each principled question as it arises in steps 12 and 15, apply the answer to the plan, then repeat step 15 with its pass count reset to 0
17. stop on a principled question of steps 12 and 15 and report it with its options: only a `plan` run asks the operator
18. run `ai-factory adr live apply <entrypoint> --dry-run` after each pass; correct the fence as the error says, and stop if it still fails
19. stop improvement after a pass changes no task; stop the run if tasks still change after pass 5
20. run `ai-factory adr live apply <entrypoint> --dry-run` before the plan commit or implementation, and stop if the corrected delta still fails
21. stage by name the plan entrypoint and each phase file it links, inspect `git diff --cached --name-only`, and stop on an unrelated staged file
22. commit the plan by `aif-commit` semantics without its push step, in 1 commit that holds no code
23. push the plan commit as steps 54 and 55 state; skip steps 21 to 23 when `git.enabled` is false or step 21 stages no change; then continue at step 56
24. apply `aif-implement` semantics to every task inline, suppressing its injected live apply and artifact cleanup; keep the entrypoint and fence for step 46
25. apply `aif-qa --all` to the uncommitted change, then write an automated test for each test case a harness of the project can check
26. record each other test case as `needs <harness>`, or as `manual` when no code can check it
27. run the project's test suite
28. run `adr.acceptance.command` when set: a non-zero exit is a failing test of this round
29. start 2 fresh read-only subagents in parallel over the change: 1 applies `aif-verify` against the original request and tasks, 1 applies `aif-review`
30. start a fresh exploratory subagent in the same batch when configured, steps 27 and 28 pass, and exploratory rounds remain
31. pass it the instructions file, the original request, scenario tasks and relevant active obligations; let it start, drive and stop the product only as that file allows
32. run step 29 inline when the runtime exposes no subagent API or every launch fails; skip exploratory and report the weaker checks in the writing context
33. fix every failing test by `aif-fix` fix-now semantics: the failing test is the regression test of its fix
34. write a test for each exploratory anomaly, in the acceptance suite when the project has one, and run it: an anomaly whose test fails is a finding of this round
35. record an anomaly no test reproduces, with its steps, and do not fix it: the exploratory subagent is not deterministic
36. list every plan deviation from verify, bug or security finding from review, and reproduced anomaly as a finding to fix
37. write a test for each listed behavioural finding, and see it fail on the unfixed code; a structural deviation needs no test since verify checks it each round
38. put a test of a finding that shows only in the running product in the acceptance suite when the project has one
39. write a test for each outcome a fix must keep when it changes a condition, a `catch` or a status code
40. fix every listed finding, then run its tests and see them pass
41. record review findings left off the list and each fix no harness can test as `needs <harness>` or `manual`
42. repeat steps 27 to 41 until tests and acceptance pass and no check reports a finding to fix, with rounds per change <= 3
43. stop when round 3 ends with a finding to fix, or a fix needs a scope change to the plan: leave the artifacts and commit nothing
44. update each document the change makes incorrect by `aif-docs` semantics: DESCRIPTION.md, ARCHITECTURE.md, AGENTS.md, README.md and the docs directory
45. update the runtime's project memory with each durable fact the change adds, such as a module or convention
46. compare the fence with the built behaviour, correct it, then run `ai-factory adr live apply <entrypoint>` exactly once successfully; stop on failure and commit nothing
47. record its operations and warnings, then run `ai-factory adr live check`; report active-ADR removal debt as `next: adr-auto-plan to supersede it`
48. archive the completed plan by `aif-archive` semantics, preserving the fence and `applied:`; move a tracked plan with `git mv`; stop on archive failure and commit nothing
49. run `ai-factory adr live check` again: the plan stem must resolve in the archive; stop on new broken refs caused by this archive
50. stage by name code, tests, QA, documents, the archived plan, LIVE.md when changed and the memory file when it lives in the repository
51. inspect `git diff --cached --name-only` and the staged diff: include exactly the run's files, including archive metadata; stop on staging failure or an unrelated staged file
52. write 1 commit-body line `Untested: <case> — <needs harness or manual>` per record of steps 26 and 41
53. commit the change by `aif-commit` semantics without its push step, in 1 commit with that body
54. push the current branch with `git push`, or `git push -u origin <branch>` without an upstream
55. skip step 54 when `git.skip_push_after_commit` is true, and skip steps 50 to 54 when `git.enabled` is false; report each skip and any operator override
56. record 1 row per stage, pass and round as it ends, with counts, changed paths and commit ids, and a reason for each skipped stage
57. report `report_format`, the minor picks and their grounds, findings not fixed, anomalies no test reproduced, and the stop reason
58. report the status footer

report_format:
```text
| Step | Stage | Pass / round | Result |
|---|---|---|---|
| 1 | mode | — | plan, implement or full |
| 6 | acceptance baseline | — | `<command>`: exit <code>, or skipped: not configured or `plan` mode |
| 12 | plan | — | `<stem>`; created full or reused full/ultra |
| 15 | improve | 1 | tasks <ids> changed, or none; converged or stopped; or skipped: `implement` mode |
| 16 | question | 1 | <question> — <operator's answer>; or none |
| 22 | plan commit | — | `<sha>`, or skipped: <reason> |
| 23 | plan push | — | `<branch>`, or skipped: <reason> |
| 24 | implement | — | tasks <done>/<total> |
| 25 | tests | — | <n> written from <m> test cases |
| 27 | test run | 1 | `<command>`: <passed>/<total> |
| 28 | acceptance | 1 | `<command>`: exit <code>, or skipped: not configured |
| 29 | verify | 1 | <k> deviations; subagent or inline |
| 29 | review | 1 | <k> to fix, <j> recorded; subagent or inline |
| 30 | exploratory | 1 | <k> anomalies, <r> reproduced; or skipped: <reason> |
| 40 | fix | 1 | <what changed>; regression tests: `<file>` <test name>, each failed before its fix |
| 41 | untested | — | <k>: <case> — needs <harness> or manual; or none |
| 44 | docs | — | `<paths>`, or none |
| 45 | memory | — | <facts>, or none |
| 46 | apply | — | LIVE.md: <op> <capability-id>, or skipped: <reason>; warnings: <debt> |
| 48 | archive | — | `<archived-entrypoint>` |
| 53 | commit | — | `<sha>`, or skipped: <reason> |
| 54 | push | — | `<branch>`, or skipped: <reason> |
```

status_footer:
  format: "✔ adr-auto-change <plan, implement or full>: <capability-id, ...> · plan: <stem> · untested: <k> · stopped at: <step or none> · pushed: <branch or no>"
  source: the step 46 apply output for capability ids, or the step 20 dry run in a `plan` run; git for the branch, and this run's records for untested
  note: use `none` for capability ids on a no-op or stop before apply; report the actual stop step and count every untested case, even on a stopped run

invocation:
- Claude Code: `/adr-auto-change [plan|implement] <topic or @full-plan or @ultra-bundle>`
- Codex: `$adr-auto-change [plan|implement] <topic or @full-plan or @ultra-bundle>`
