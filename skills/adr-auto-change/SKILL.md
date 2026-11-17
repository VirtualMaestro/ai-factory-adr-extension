---
name: adr-auto-change
description: Run a change without an ADR from a topic, full plan or ultra bundle — plan with reviewed rounds, then implement each task on its own branch with a Coder, read-only reviews, checks, commits and pushes, update LIVE.md, archive and merge. `plan` stops at a committed plan; `implement` builds one.
---

mode: plan_change_run

purpose:
- carry 1 change that needs no ADR from a topic or an unlinked plan to tested code, an archived plan and a merge into the base
- split the change into 2 runs when the operator reviews the plan first: a `plan` run commits the reviewed plan, an `implement` run builds it
- replace the manual sequence `aif-plan full`, `aif-improve`, `aif-implement`, `aif-qa`, `aif-verify`, `aif-review`, live apply, `aif-archive`, `aif-commit`
- split the writing from the judging: an Author writes the plan, a Coder writes each task, a reviewer in a fresh context checks each round, and this session triages
- keep a partial change off the base: the implementation phase works on `change/<plan-stem>` and reaches the base only through a merge
- stop on a blocker instead of asking the operator to repair the plan during implementation

inputs:
- 1 topic, full plan file, ultra bundle directory or its `index.md`, without `implements:`
- an optional mode word before it, `plan` or `implement`; without one the run covers both phases
- `implement --resume <plan-file>`: continue the claimed plan of an earlier run from the state of its branch

run_modes:
- `plan`: run steps 1, 3 to 5, 8 to 16 and 18 to 23, then steps 58 to 60: the run reviews the plan, commits it and writes no code
- `implement`: run steps 1 to 14, 20 and 24 to 60 on an existing plan: the run takes the plan as approved and does not review it
- no mode word: run steps 1, 3 to 15, 17 to 20 and 24 to 60: both phases in 1 run, with no questions

principled_questions:
- a principled question changes what the plan rests on: its architecture, a tool or dependency, a public API, a data schema, a module boundary or a protocol
- a principled question changes the goal or the scope of the original request, or fills a gap no research of the code can close
- a principled question approves an action that deletes data or that no one can reverse
- any other question is minor, such as an edge case, a task order, a test case or a name: pick the scoped default, and record the pick and its ground for the report

roles:
- orchestrator: this session; it writes the commits, the pushes, the merge, the claim, the memory, the plan checkboxes, the live apply and the archive, and no code
- author: writes the plan and its edits, continued by message across the review rounds; it runs no transition and no commit
- coder: 1 per task, continued by message with each fix until the task is green
- reviewer_1: 1 review of the plan or of 1 task, read-only, through `ai-factory adr review`
- reviewer_2: 1 fresh review, read-only, on a finding at or above `escalate_at` and at the gate; a diagnosing instance on a red check lives to the end of its task
- a role whose runtime cannot run: take the next runtime of its fallback; with no subagents, do the role inline and state in the report that a check in the writing context is weaker

runtimes:
- `subagent`: start the host's subagent with the role's model and effort when the host takes them, and continue it by message, such as `SendMessage` to its id in Claude Code
- `codex-cli`: start `codex exec --json -s workspace-write -` with the brief on stdin, adding `-m <model>` and `-c model_reasoning_effort=<effort>` when set, and read `thread_id`
- continue a `codex-cli` writer with `codex exec resume <thread_id> -` and the message on stdin; do not start a writer with `--ephemeral`, which no resume reaches
- `claude-cli`: start `claude -p --session-id <uuid> --permission-mode acceptEdits` with the brief on stdin, adding `--model` and `--effort` when set; continue it with `claude -p --resume <uuid>`
- a reviewer of any runtime runs through `ai-factory adr review`, which holds its read-only flags and its timeout

coder_brief:
- state the plan stem, the task id and where its requirements sit in the plan, the files and modules it touches, the rules of `AGENTS.md`, `CLAUDE.md` and the memory, and the checks to run before it reports
- on a resume, name the `wip(change):` commit it continues
- rules: the smallest change that closes the whole task; reuse what the code has; no new dependency; no module outside the task; no real API, paid agent or production data in a test
- each fixed defect gets a test that fails on the code without the fix; a fix no harness of the project can test goes to its report
- apply `aif-implement` semantics to the task without its completion injection and artifact cleanup, and `aif-qa` to its change: record each case no harness can check as `needs <harness>` or `manual`
- it does not commit, stage, stash or push
- its report lists the changed files, how each requirement is met or why not, the tests it added, its `aif-qa` records, and the check commands with their results

remote_policy:
- run a remote operation, such as a fetch, a push of the base, or a push or deletion of the change branch, only when `git.enabled` is true, the base has an upstream, and `git.skip_push_after_commit` is not true
- otherwise the run is local: the claim locks only this clone, and the report says so
- push with `git push --porcelain`: `[rejected]` means the remote moved, and the step that pushed says what to redo; `[remote rejected]` is a policy, and the run does not retry it
- a fetch of the base also fast-forwards the local base to its remote; a base that diverged stops the run

run_states:
- derive the state by the first row that matches, in this order
- stale: the claim names a branch that exists neither locally nor on the remote; stop and name `ai-factory adr unclaim <plan-file>`
- merged: the plan sits in the archive on the base and the base contains the branch; push the base when its remote lacks the merge, then go on from step 57
- dirty: the tree has changes on the change branch; commit them as `wip(change): <plan-stem> — recovered`, then derive the state again
- wip: HEAD of the branch is a `wip(change):` commit; keep it, and let the Coder continue the task it names on top of it, from step 30
- tasks: the plan on the branch is neither `done` nor archived, a core plan with no status included, and an unchecked task remains; go on from step 30 with the first unchecked task
- gate: the plan has no unchecked task and its fence has no `applied:`; go on from step 41
- applied: the plan sits in the archive on the branch with `applied:`, and the remote lacks the apply commit; go on from step 53
- awaiting merge: the plan sits in the archive on the branch and the remote holds the apply commit; stop: the operator merges

stop_procedure:
- in the implementation phase, commit the unfinished task, when the tree has changes, as `wip(change): <plan-stem> task <task-id> — <reason>`, on the change branch only
- push the change branch under `remote_policy:`, switch back to the base, and leave the claim on the base
- in the planning phase, and before the claim, commit nothing

forbidden_behaviors:
- do not ask the operator anything outside step 16: pick the scoped default for a minor question and report it
- do not pick a default for a principled question outside a `plan` run, at any step: stop, report it with its options, and commit nothing
- do not ask a minor question in step 16, such as a planning preference, a commit checkpoint or whether to push
- do not create an ADR, accept a decision or change an ADR's lifecycle status: route a standing decision to `adr-propose` and stop
- do not take the configured fast plan (`paths.plan`, default `.ai-factory/PLAN.md`): `aif-archive` does not archive it
- do not implement or apply a plan with `implements:`: route it to `adr-auto-implement`
- do not create or switch branches in the planning phase: only the implementation phase works on `change/<plan-stem>`
- commit on the base only the plan, its claim, a release or the merge of the change branch
- do not write the plan or code in this session: the Author writes the plan and the Coder writes the code
- do not call other skills as nested calls: the Author and the Coder apply each named skill's workflow in their own context, and this session applies the live apply and the archive
- do not apply the completion injection of `aif-implement` or delete the plan: step 49 is the sole live apply, and step 50 owns archive
- do not change the plan's scope or original request to make a finding pass: a finding the plan cannot meet stops the run; ticking a task is the only plan edit of the implementation phase
- do not skip, disable or weaken a failing test, or rerun it until it passes: a flaky failure is a finding
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and the commit body
- do not let a reviewer write: a review whose `ai-factory adr review end` exits non-zero does not count, and an `end` that reports a changed tree stops the run by `stop_procedure:`, since this session cannot tell that write from the Coder's
- do not let the exploratory subagent change a file of the repository, or reach a paid or remote service the instructions file does not allow
- do not write a capability list into `.ai-factory/DESCRIPTION.md`: the capabilities live in `LIVE.md`
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not write code, tests, documents or `LIVE.md` in a `plan` run: its commit holds the plan alone
- do not push the apply commit before its merge, and do not push with `--force` or drop a pushed commit
- do not resume a claimed plan that the operator did not name with `--resume`

workflow:
1. read the mode from the first word of the input, `plan` or `implement`, and take only the steps `run_modes` names for it
2. stop on an `implement` input that names no plan file or ultra bundle: the mode builds an approved plan and makes none; name the rewording for a topic
3. read `.ai-factory/config.yaml`, resolve the plan, plans, QA, archive and live paths and the git settings, and run `ai-factory adr auto config --check`; stop on an error and record the roles with each fallback
4. run `git status` when `git.enabled` is true, and stop when any change sits outside the plans directory and the QA directory, or `LIVE.md` is dirty; on a resume, a dirty change branch is the `dirty` state
5. record the exact pre-existing plan and QA paths: stage only this run's changed files later, not unrelated artifacts already present
6. run `adr.acceptance.command` once on the base when it is set, and stop when it fails; skip it on a resume that starts on the change branch, which holds work in progress
7. stop when `adr.acceptance.exploratory.instructions` names a missing file; use its `rounds` limit when configured
8. read `ai-factory adr live` and `ai-factory adr decisions`; stop and report its `next:` line when `ai-factory adr live` exits 1
9. stop on an input fast plan or a plan with `implements:`, and name the route from `forbidden_behaviors`
10. inspect the topic or existing plan against the active decisions: stop and recommend `adr-propose` when it binds work beyond this change
11. name an active ADR whose capability the change alters or removes, and continue: live apply records removal debt, which the report routes to `adr-auto-plan`
12. for a topic, start an Author with the `author` role to make a full plan by `aif-plan full` semantics on the current branch; otherwise take the given full file or ultra entrypoint and validate its marker and phase links
13. let the Author write 1 `adr-live` fence after the entrypoint's title when it has none, keeping a Handoff line first: use `changes:` with double-quoted summaries or `none:` with the reason
14. let the Author read `ai-factory adr format` and reuse the capability ids in LIVE.md, writing summaries with its lexicon and durable refs for code the plan describes
15. plan round: write a brief outside the tree, run `ai-factory adr review begin --role reviewer_1 --phase plan --prompt <brief> --files <entrypoint and phase files> --rubric plan`, then `run` or a subagent, then `end`
16. ask the operator each principled question as it arises in steps 12 and 15, send the answer to the Author by message, then repeat step 15 with its round count reset to 0
17. stop on a principled question of steps 12 and 15 and report it with its options: only a `plan` run asks the operator
18. triage each finding against the plan and the code, let the Author fix each confirmed one and preserve the original request and the first fence, then run `ai-factory adr live apply <entrypoint> --dry-run`
19. stop improvement after a round leaves the dry run green and no confirmed finding at or above `medium`; stop the run when one remains after round `max_rounds`
20. run `ai-factory adr live apply <entrypoint> --dry-run` before the plan commit or implementation, and stop if the corrected delta still fails
21. stage by name the plan entrypoint and each phase file it links, inspect `git diff --cached --name-only`, and stop on an unrelated staged file
22. commit the plan by `aif-commit` semantics without its push step, in 1 commit that holds no code
23. push the plan commit under `remote_policy:`; skip steps 21 to 23 when `git.enabled` is false or step 21 stages no change; then continue at step 58
24. stop unless `git.enabled` is true: the implementation phase runs on its own branch; on `--resume`, switch to the branch of the claim, derive its state by `run_states:`, and go on from its row
25. record the base, the current branch, and fetch it under `remote_policy:`; commit an uncommitted plan, the entrypoint and each phase file it links, by name on the base as `docs(plan): add <plan-stem>`
26. claim: run `ai-factory adr claim <entrypoint> --base <base>`, which prints `change/<plan-stem>`, and commit only the entrypoint on the base as `chore(plan): start <plan-stem> on <branch>`
27. switch: when the branch exists, switch to it and merge the base into it; otherwise run `git switch -c <branch>`
28. push the branch with `-u` under `remote_policy:`; on `[rejected]`, another clone holds it: switch to the base, delete the local branch, run `git reset --keep HEAD~1` to drop the claim commit, and stop
29. push the base under `remote_policy:`; on `[rejected]`, undo steps 26 to 28 on both sides, run `git pull --rebase` on the base, and repeat from step 26 once; on `[remote rejected]`, keep the claim local and record it
30. take each unchecked task of the plan in plan order, and start a Coder with the `coder` role and a brief by `coder_brief:`
31. write the Reviewer_1 brief outside the tree: the task and its acceptance, the changed files, `git diff HEAD` and the untracked files, and the Coder's contested decisions and checks, each as a claim to verify
32. run `ai-factory adr review begin --role reviewer_1 --prompt <brief>`, then `run` or a subagent, then `end`; on a non-zero `end`, repeat with `--runtime` set to the next runtime of the fallback, and record it
33. triage each finding against the code: confirmed goes to the Coder with a test that fails without the fix; record a rejected one with its reason and a code reference; disputed goes to the Coder, and this session decides
34. stop by `stop_procedure:` on a finding that changes the scope of the task or the original request
35. when a confirmed finding reaches `escalate_at`, start a fresh Reviewer_2 over the whole task diff after the Coder's fixes, as in steps 31 and 32 with `--role reviewer_2`, and triage it by step 33
36. run `checks.task`, or the project test suite when it is empty, and `adr.acceptance.command` when it is set; read each exit code
37. on a red check, let Reviewer_2 diagnose it, starting it when it has not run, let the Coder fix it, and repeat step 36; a test that fails only in the full run is a failure too
38. stop by `stop_procedure:` when the review rounds or the red-check rounds of the task exceed `max_rounds`
39. on green, release the Coder, tick the task, commit by name the files of the task and the plan with 1 line `Untested: <case> — <needs harness or manual>` per record of the Coder, and push the branch under `remote_policy:`
40. stop by `stop_procedure:` when `git status --porcelain` is not empty after the commit
41. gate: merge the base into the branch; on a conflict, run `git merge --abort` and stop by `stop_procedure:`; from here the branch holds the tree the base will receive
42. run `checks.full`, or the project test suite when it is empty, and `adr.acceptance.command`; a red check is a fix cycle of step 46
43. on green, in parallel and read-only, through `ai-factory adr review`: a fresh subagent with `--runtime subagent` applies `aif-verify` against the original request and the tasks, and a fresh Reviewer_2 reviews `git diff <base>...HEAD`
44. after both reviews end, when `adr.acceptance.exploratory` is set and rounds remain, start the exploratory subagent with the instructions file, the original request, the scenario tasks and the active obligations
45. record an anomaly no test reproduces, with its steps, and do not fix it: the exploratory subagent is not deterministic; a Coder writes a test for each anomaly, and an anomaly whose test fails is a gate finding
46. triage the gate findings by step 33, and send all confirmed findings of 1 gate round to a Coder as 1 fix cycle through steps 31 to 40; repeat from step 41 until the gate is clean, with gate rounds <= `max_rounds`
47. update each document the change makes incorrect by `aif-docs` semantics, and the memory file when it lives in the repository; commit both by name and push the branch
48. under `remote_policy:`, fetch the base; when the branch does not contain the tip of the base, go back to step 41
49. compare the fence with the built behaviour, correct it, then run `ai-factory adr live apply <entrypoint>` exactly once successfully; stop on failure; record its operations and warnings
50. run `ai-factory adr claim --release <entrypoint>`, then archive the plan by `aif-archive` semantics, preserving the fence and `applied:`; move a tracked plan with `git mv`; stop on archive failure
51. run `ai-factory adr live check`: the plan stem must resolve in the archive; stop on new broken refs; report active-ADR removal debt as `next: adr-auto-plan to supersede it`
52. stage by name `LIVE.md`, the archived plan and its archive metadata, inspect `git diff --cached --name-only`, commit by `aif-commit` semantics without its push step, and do not push this commit
53. under `remote_policy:`, fetch the base; when the branch does not contain its tip, run `git reset --keep HEAD~1` to drop the apply commit and go back to step 41
54. switch to the base and run `git merge --no-ff <branch>`, with a body listing every `Untested:` line of the commits of the branch
55. run `ai-factory adr status --check` and `ai-factory adr live check`, and read both outputs; on an issue, run `git reset --keep ORIG_HEAD`, switch to the branch, drop the unpushed apply commit, and stop by `stop_procedure:`
56. push the base under `remote_policy:`; on `[rejected]`, undo the merge as in step 55, drop the apply commit, and go back to step 41, with merge rounds <= `max_rounds`; on `[remote rejected]`, undo the merge, push the branch and stop
57. when the remote base holds the merge, or the run is local, delete the branch locally and on the remote when `branch.delete_after_merge` is true, then update the memory that lives outside the repository
58. record 1 row per stage, task and round as it ends, with the runtime of each review, counts, changed paths and commit ids, and a reason for each skipped stage
59. report `report_format`, the minor picks and their grounds, the findings rejected or not fixed, the anomalies no test reproduced, and the stop reason with the state of `run_states:`
60. report the status footer

report_format:
```text
| Step | Stage | Task | Round | Reviewer | Result |
|---|---|---|---|---|---|
| 1 | mode | — | — | — | plan, implement or full |
| 3 | config | — | — | — | author, coder, reviewer_1, reviewer_2 with their runtimes and fallbacks |
| 6 | acceptance baseline | — | — | — | `<command>`: exit <code>, or skipped: not configured or `plan` mode |
| 12 | plan | — | — | — | `<stem>`; created full or reused full/ultra |
| 15 | plan round | — | 1 | reviewer_1, codex-cli | 2 confirmed; tasks <ids> changed |
| 16 | question | — | 1 | — | <question> — <operator's answer>; or none |
| 22 | plan commit | — | — | — | `<sha>`, or skipped: <reason> |
| 26 | claim | — | — | — | `change/<stem>` from `<base>`, pushed, or local: <reason> |
| 39 | task commit | 1 | 2 | reviewer_1, codex-cli | `<sha>`; checks green; untested: <k> |
| 43 | gate | — | 1 | reviewer_2, subagent; verify, subagent | <k> confirmed |
| 44 | exploratory | — | 1 | subagent | <k> anomalies, <r> reproduced; or skipped: <reason> |
| 47 | docs | — | — | — | `<paths>`, or none |
| 49 | apply | — | — | — | LIVE.md: <op> <capability-id>, or skipped: <reason>; warnings: <debt> |
| 50 | archive | — | — | — | `<archived-entrypoint>` |
| 54 | merge | — | 1 | — | `<sha>` into `<base>`, pushed, or skipped: <reason> |
```

status_footer:
  format: "✔ adr-auto-change <plan, implement or full>: <capability-id, ...> · plan: <stem> · branch: <change/stem or none> · untested: <k> · stopped at: <step or none> · pushed: <base or no>"
  source: the step 49 apply output for capability ids, or the step 20 dry run in a `plan` run; git for the branch, and this run's records for untested
  note: use `none` for capability ids on a no-op or stop before apply; report the actual stop step and count every untested case, even on a stopped run

invocation:
- Claude Code: `/adr-auto-change [plan|implement] <topic or @full-plan or @ultra-bundle>`, or `/adr-auto-change implement --resume @full-plan`
- Codex: `$adr-auto-change [plan|implement] <topic or @full-plan or @ultra-bundle>`, or `$adr-auto-change implement --resume @full-plan`
