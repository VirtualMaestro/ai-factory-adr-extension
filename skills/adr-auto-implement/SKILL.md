---
name: adr-auto-implement
description: Run the ADR implementation phase end to end for 1 or more accepted ADRs — each ADR on its own branch, each plan task written by a Coder, reviewed read-only, checked, committed and pushed, then a gate, finalize and a local merge into the base, with no questions to the operator.
---

mode: adr_implementation_run

purpose:
- carry 1 or more `accepted` ADRs with a plan to `active`, each on its own branch, with automated tests and independent reviews
- replace the manual sequence `adr-implement`, `aif-qa`, `adr-verify`, `aif-review`, `aif-fix`, `adr-finalize`, `aif-commit` with 1 run
- split the writing from the judging: a Coder writes each task, a reviewer in a fresh context checks it, and this session triages, runs the checks and commits
- keep a partial ADR off the base: the base receives an ADR only through a merge after its gate and its finalize pass
- rest on the planning phase: a question here means the plan left a gap, so the run stops instead of asking

inputs:
- ADR files, or none: with none, the run takes the `order` list of `ai-factory adr order`
- `--resume <adr-file>`: continue the claimed ADR of an earlier run from the state of its branch
- `--release`: after the last merge, run the release of `release_procedure:`; without it the run releases nothing

roles:
- orchestrator: this session; it writes the commits, the pushes, the merges, the claim, the memory and the plan checkboxes, and no code
- coder: 1 per task, continued by message with each fix until the task is green
- reviewer_1: 1 review of 1 task, read-only, through `ai-factory adr review`
- reviewer_2: 1 fresh review, read-only, on a finding at or above `escalate_at` and at the gate; a diagnosing instance on a red check lives to the end of its task
- a Coder the runtime cannot continue: start a fresh one with its last report and the current files, and record it for the report
- a role whose runtime cannot run: take the next runtime of its fallback; with no subagents, do the role inline and state in the report that a check in the writing context is weaker

runtimes:
- `inline`, the last step of a fallback, is no runtime of `ai-factory adr review`: begin the review with `--runtime subagent`, answer it in this session, and pass the answer to `end` with `--result`
- `subagent`: start the host's subagent with the role's model and effort when the host takes them, and continue it by message, such as `SendMessage` to its id in Claude Code
- `codex-cli`: start `codex exec --json -s workspace-write -` with the brief on stdin, adding `-m <model>` and `-c model_reasoning_effort=<effort>` when set, and read `thread_id`
- continue a `codex-cli` writer with `codex exec resume <thread_id> -` and the message on stdin; do not start a writer with `--ephemeral`, which no resume reaches
- `claude-cli`: start `claude -p --session-id <uuid> --permission-mode acceptEdits` with the brief on stdin, adding `--model` and `--effort` when set; continue it with `claude -p --resume <uuid>`
- a reviewer of any runtime runs through `ai-factory adr review`, which holds its read-only flags and its timeout

coder_brief:
- state the ADR id, the task id and where its requirements sit in the plan, the files and modules it touches, the rules of `AGENTS.md`, `CLAUDE.md` and the memory, and the checks to run before it reports
- on a resume, name the `wip(adr):` commit it continues
- rules: the smallest change that closes the whole task; reuse what the code has; no new dependency; no module outside the task; no real API, paid agent or production data in a test
- each fixed defect gets a test that fails on the code without the fix; a fix no harness of the project can test goes to its report
- apply `aif-qa` to the task: an automated test for each case a harness of the project can check, and each other case recorded as `needs <harness>`, or as `manual` when no code can check it
- it does not commit, stage, stash or push
- its report lists the changed files, how each requirement is met or why not, the tests it added, its `aif-qa` records, and the check commands with their results

remote_policy:
- a claim commit the base refuses with `[remote rejected]`: a protection rule guards the base; drop the commit from it with `git branch -f <base> <base>~1`, since the branch keeps it, and record it
- run a remote operation, such as a fetch, a push of the base, or a push or deletion of an ADR branch, only when `git.enabled` is true, the base has an upstream, and `git.skip_push_after_commit` is not true
- otherwise the run is local: the claim locks only this clone, and the report says so
- push with `git push --porcelain`: `[rejected]` means the remote moved, and the step that pushed says what to redo; `[remote rejected]` is a policy, and the run does not retry it
- a fetch of the base also fast-forwards the local base to its remote; a base that diverged stops the run

run_states:
- derive the state by the first row that matches, in this order
- take the base of a resume from `base:` of the claim; once finalize released it on the branch, run `git log -1 --format=%H --grep '^chore(adr): start <adr-id> on'` and read it from the ADR file of that commit
- stale: the claim names a branch that exists neither locally nor on the remote; stop and name `ai-factory adr unclaim <adr-file>`
- merged: the ADR is `active` on the base and the base contains the branch; push the base when its remote lacks the merge, then go on from step 46
- dirty: the tree has changes on the ADR branch; commit them as `wip(adr): <adr-id> — recovered`, then derive the state again
- wip: HEAD of the branch is a `wip(adr):` commit; keep it, and let the Coder continue the task it names on top of it, from step 20; with no unchecked task, it is a gate fix: let the Coder finish it, then go on from step 32
- tasks: the ADR on the branch is `accepted` and an unchecked task remains; go on from step 20 with the first unchecked task
- gate: the plan has no unchecked task and the ADR is `accepted`; go on from step 32
- finalized: the ADR on the branch is `active` and the remote lacks the finalize commit; go on from step 41
- awaiting merge: the ADR on the branch is `active` and the remote holds the finalize commit; stop: the operator merges

stop_procedure:
- commit the unfinished task, when the tree has changes, as `wip(adr): <adr-id> task <task-id> — <reason>`, on the ADR branch only
- push the ADR branch under `remote_policy:`, and switch back to the base
- leave the claim on the base, and take up no further ADR: a stop often has a cause the next ADR shares, such as a broken environment
- a stop before the claim of an ADR leaves nothing to commit

release_procedure:
- run it on the base, after the last merge of the run, only with `--release`, a set `release.command`, at least 1 merged ADR and no stop
- run `checks.full`, or the project test suite when it is empty; a red check stops the release
- review `git diff <run-start>...HEAD` with a fresh Reviewer_2 through `ai-factory adr review`, where `<run-start>` is the base commit step 6 recorded
- send the confirmed findings to a Coder on the branch `<branch.prefix>release-<date>` as 1 task, reviewed and checked by steps 21 to 29; finalize archived the plan, so tick nothing
- on green, commit by name the files of the fix as `fix(release): <summary>` with the `Untested:` lines of step 31, and push the branch under `remote_policy:`
- merge the base into the branch and run `checks.full`; on green, merge the branch into the base and push it by steps 42 to 46, where no finalize commit exists to drop
- repeat the review until it confirms no finding, with release rounds <= `max_rounds`, and stop the release when one remains
- run `release.command` and read its exit code: publishing is outward and no one can undo it, so a non-zero exit stops the run and nothing retries it

forbidden_behaviors:
- do not ask the operator anything, including whether to commit, push or merge
- do not write code in this session: the Coder writes it
- commit on the base only a claim, a release, a documentation-only finalize or an ADR merge
- do not merge an ADR whose gate is not clean
- do not push a finalize commit before its merge, except to hand a protected base to the operator in step 45
- do not push with `--force`, on any branch, and do not drop a pushed commit
- do not let a reviewer write: a review whose `ai-factory adr review end` exits non-zero does not count, and an `end` that reports a changed tree stops the run by `stop_procedure:`, since this session cannot tell that write from the Coder's
- do not resume a claimed ADR that the operator did not name with `--resume`
- do not run `release.command` without `--release`, or before the release review of `release_procedure:` confirms no finding
- do not write the memory outside the repository from an unmerged branch: a fact would outlive a branch that never lands
- do not write a capability list into `.ai-factory/DESCRIPTION.md`: the capabilities live in `LIVE.md`, which the finalize of each ADR updates
- do not stage files by pattern, such as `git add -A`: stage by name the paths of the task or the step
- do not call other skills as nested calls: the Coder applies `adr-implement` and `aif-qa` to its task, and this session applies `adr-finalize` inline
- do not change the plan or the ADR decision to make a finding pass: a finding the plan cannot meet stops the run; ticking a task is the only plan edit
- do not skip, disable or weaken a failing test, or rerun it until it passes: a flaky failure is a finding
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and the commit body
- do not let the exploratory subagent change a file of the repository, or reach a paid or remote service the instructions file does not allow

workflow:
1. stop unless `git.enabled` is true in `.ai-factory/config.yaml`: each ADR lives on its own branch
2. run `ai-factory adr auto config --check` and stop on an error; record the `implement` roles it prints, with each fallback, for the report
3. when the current branch starts with `branch.prefix` or is the branch of a claim, go on only with `--resume` for that ADR and take the base from its `base:`; otherwise stop and name the branch
4. stop on a dirty tree, naming the uncommitted files and saying to commit them; with `--resume` on the ADR branch, it is the `dirty` state of `run_states:` instead
5. stop when `git check-ignore` matches a path the run commits: the ADR root, the plans and archived plans directories, `LIVE.md`, the QA directory, and the memory file when it lives in the repository
6. record the base, the current branch or the claim's `base:` on a resume, and its commit as the run start; under `remote_policy:`, fetch it and fast-forward it, and stop when it diverged
7. run `ai-factory adr order` on the base, stop when its `cycles` list is non-empty, and take the input ADRs in its order, or its `order` list when no input is given
8. run `adr.acceptance.command` once on the base when it is set, and stop the run when it fails; skip it on a resume that starts on the ADR branch, which holds work in progress
9. stop the run when `adr.acceptance.exploratory.instructions` names a file that does not exist
10. on a resume, switch to the branch of the claim, derive its state by `run_states:`, and go on from the step its row names
11. take the next ADR; the checks of steps 12 to 15 run on the base
12. skip an ADR that `ai-factory adr order` lists `in work`, with every ADR that depends on it, and record each skip: a claim by another run is not a failure of this run
13. stop at an ADR whose status is not `accepted`, or whose dependency is not `active`: the planning phase left a gap
14. for a documentation-only ADR, apply `adr-finalize` on the base, commit it by name, push the base under `remote_policy:`, and continue from step 11
15. apply the preflight of `adr-implement`: `ai-factory adr resolve-plan <adr-file>` finds 1 plan, `ai-factory adr status --check` passes, and `ai-factory adr format plan --check <plan-file>` passes for a plan with `format: cnlp-plan`
16. claim: under `remote_policy:`, fetch the base; run `ai-factory adr claim <adr-file> --base <base>`, which prints the branch, and commit only the ADR file on the base as `chore(adr): start <adr-id> on <branch>`
17. switch: when the branch exists from an earlier `ai-factory adr unclaim`, switch to it and merge the base into it; otherwise run `git switch -c <branch>`
18. push the branch with `-u` under `remote_policy:`; on `[rejected]`, another clone holds it: switch to the base, delete the local branch, run `git reset --keep HEAD~1`, and skip the ADR as in step 12
19. push the base under `remote_policy:`; on `[rejected]`, undo steps 16 to 18 on both sides and repeat from step 16 once; on `[remote rejected]`, act by `remote_policy:` for a claim commit
20. take each unchecked task of the plan in plan order, and start a Coder with the `coder` role and a brief by `coder_brief:`
21. write the Reviewer_1 brief to a file outside the tree: the task and its `acceptance`, the changed files, `git diff HEAD` and the untracked files, and the Coder's contested decisions and checks, each as a claim to verify
22. run `ai-factory adr review begin --role reviewer_1 --prompt <brief> --json`; for a CLI runtime run `ai-factory adr review run <id>`, and for a `subagent` start a fresh read-only subagent and write its answer to a file outside the tree
23. run `ai-factory adr review end <id>`, with `--result <file>` for a subagent; on a non-zero exit, repeat from step 22 with `--runtime` set to the next runtime of the fallback, and record it
24. triage each finding against the code: confirmed goes to the Coder with a test that fails without the fix; record a rejected one with its reason and a code reference; disputed goes to the Coder, and this session decides
25. stop by `stop_procedure:` on a finding that changes the intent or the scope of the task, the plan or the decision
26. when a confirmed finding reaches `escalate_at`, start a fresh Reviewer_2 over the whole task diff after the Coder's fixes, as in steps 21 to 23 with `--role reviewer_2`, and triage it by step 24
27. run `checks.task`, or the project test suite when it is empty, and `adr.acceptance.command` when it is set; read each exit code
28. on a red check, let Reviewer_2 diagnose it, starting it when it has not run, let the Coder fix it, and repeat step 27; a test that fails only in the full run is a failure too
29. stop by `stop_procedure:` when the review rounds or the red-check rounds of the task exceed `max_rounds`
30. on green, release the Coder, tick the task in the plan, run `ai-factory adr format plan --check <plan-file>` for `format: cnlp-plan`, and commit by name the files of the task and the plan
31. write the commit body with 1 line `Untested: <case> — <needs harness or manual>` per record of the Coder, stop by `stop_procedure:` when `git status --porcelain` is not empty, and push the branch under `remote_policy:`
32. gate: under `remote_policy:`, fetch the base and fast-forward it, then merge it into the branch; on a conflict, run `git merge --abort` and stop by `stop_procedure:`; from here the branch holds the tree the base will receive
33. run `checks.full`, or the project test suite when it is empty, and `adr.acceptance.command`; a red check is a fix cycle of step 37
34. on green, in parallel and read-only, through `ai-factory adr review`: a fresh subagent with `--runtime subagent` applies `adr-verify` without its anchor steps, and a fresh Reviewer_2 reviews `git diff <base>...HEAD`
35. after both reviews end, when `adr.acceptance.exploratory` is set and rounds remain, start the exploratory subagent with the instructions file, the `decision:`, `scope:` and `rules:` blocks and the scenario tasks: it never overlaps a snapshot
36. record an anomaly no test reproduces, with its steps, and do not fix it: the exploratory subagent is not deterministic; a Coder writes a test for each anomaly, and an anomaly whose test fails is a gate finding
37. triage the gate findings by step 24, and send all confirmed findings of 1 gate round to a Coder as 1 fix cycle through steps 21 to 31, with 1 commit; repeat from step 32 until the gate is clean, with gate rounds <= `max_rounds`
38. update each project document the ADR makes incorrect, applying `aif-docs` semantics inline, and the memory file when it lives in the repository; commit both by name and push the branch
39. under `remote_policy:`, fetch the base; when the branch does not contain the tip of the base, go back to step 32
40. apply `adr-finalize` on the branch: it releases the claim; write `evidence:` without a commit id, commit by name with the ADR move, the plan archive and the `LIVE.md` change, and do not push this commit
41. under `remote_policy:`, fetch the base; when the branch does not contain its tip, run `git reset --keep HEAD~1` to drop the finalize commit and go back to step 32
42. switch to the base and run `git merge --no-ff <branch>`, with a body listing every `Untested:` line of the commits of the branch
43. run `ai-factory adr status --check` and `ai-factory adr live check`, and read the output of both; on an issue, run `git reset --keep ORIG_HEAD`, switch to the branch, drop the unpushed finalize commit, and stop by `stop_procedure:`
44. push the base under `remote_policy:`; on `[rejected]`, undo the merge as in step 43, drop the finalize commit, and go back to step 32, with merge rounds <= `max_rounds`
45. on `[remote rejected]`, undo the merge, push the branch with its finalize commit, switch to the base, and stop: the ADR waits for the operator's merge
46. when the remote base holds the merge, or the run is local, delete the branch locally and on the remote when `branch.delete_after_merge` is true, then update the memory that lives outside the repository
47. continue with the next ADR from step 11; after the last ADR, run `release_procedure:` when the run has `--release`, and record each of its stages
48. record 1 row per stage, per task and per round as it ends, with the runtime of each review, the counts and the commit ids, and 1 row with its reason for each stage the run skips
49. report the rows in `report_format`, then the findings rejected or not fixed, the anomalies no test reproduced, then where the run stopped, in which state of `run_states:`, and why
50. report the status footer

report_format:
```text
| ADR | Task | Stage | Round | Reviewer | Result |
|---|---|---|---|---|---|
| — | — | config | — | — | coder: subagent; reviewer_1: codex-cli → subagent; reviewer_2: subagent |
| — | — | acceptance baseline | — | — | `<command>`: exit 0, or skipped: not configured |
| `<adr-id>` | — | claim | — | — | `adr/<adr-id>` from `<base>`, pushed, or local: <reason> |
| `<adr-id>` | 1 | coder | 1 | — | <files>; tests: <n>; untested: <k> |
| `<adr-id>` | 1 | review | 1 | reviewer_1, codex-cli | 2 confirmed, 1 rejected |
| `<adr-id>` | 1 | escalate | 1 | reviewer_2, subagent | 0 confirmed |
| `<adr-id>` | 1 | checks | 2 | — | `<command>`: exit 0 |
| `<adr-id>` | 1 | commit | — | — | `<sha>`, pushed |
| `<adr-id>` | — | sync | 1 | — | merged `<base>`, no conflict |
| `<adr-id>` | — | gate | 1 | reviewer_2, subagent; verify, subagent | 1 confirmed; 0 deviations |
| `<adr-id>` | — | exploratory | 1 | subagent | <k> anomalies, <r> reproduced by a test |
| `<adr-id>` | — | docs | — | — | `README.md`, or none |
| `<adr-id>` | — | finalize | — | — | `active`; `LIVE.md`: <op> <capability-id>, or no change |
| `<adr-id>` | — | merge | 1 | — | `<sha>` into `<base>`, pushed |
| `<adr-id>` | — | skip | — | — | in work on `adr/<adr-id>` by another run |
| — | — | release review | 1 | reviewer_2, subagent | 0 confirmed over `<run-start>...HEAD` |
| — | — | release | — | — | `<release.command>`: exit 0, or skipped: no `--release` |
| `<adr-id>` | 3 | stop | 3 | — | <reason>; `wip(adr):` `<sha>` on `adr/<adr-id>` |

Rejected findings:
- `<adr-id>` task <n> round <r>: <finding> — <reason>, <file:line>
```

status_footer:
  format: "✔ adr-auto-implement: <adr-id, ...> · merged: <n> · skipped: <s> · untested: <k> · branches: <branch, ...> · stopped at: <adr-id state or none> · pushed: <base or no> · released: <yes or no>"
  source: `ai-factory adr status` and `ai-factory adr order` for each ADR of the run
  note: the list names each ADR the run took up, in run order; branches names each ADR branch still present; resume a stop with `--resume <adr-file>`

invocation:
- Claude Code: `/adr-auto-implement [--release] [@adr-file ...]`, or `/adr-auto-implement --resume @adr-file`
- Codex: `$adr-auto-implement [--release] [@adr-file ...]`, or `$adr-auto-implement --resume @adr-file`
