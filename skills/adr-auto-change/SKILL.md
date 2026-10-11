---
name: adr-auto-change
description: Run a change without an ADR end to end from a topic, full plan or ultra bundle — plan, improve, implement, test, verify, review, update LIVE.md, archive, commit and push without questions.
---

mode: plan_change_run

purpose:
- carry 1 change that needs no ADR from a topic or an unlinked plan to tested code, an archived plan and 1 commit
- replace the manual sequence `aif-plan full`, `aif-improve`, `aif-implement`, `aif-qa`, `aif-verify`, `aif-review`, live apply, `aif-archive`, `aif-commit`
- stop on a blocker instead of asking the operator to repair the plan during implementation

inputs:
- 1 topic, full plan file, ultra bundle directory or its `index.md`, without `implements:`

forbidden_behaviors:
- do not ask the operator anything, including planning preferences, commit checkpoints or whether to push: pick the scoped default and report it
- do not create an ADR, accept a decision or change an ADR's lifecycle status: route a standing decision to `adr-propose` and stop
- do not take the configured fast plan (`paths.plan`, default `.ai-factory/PLAN.md`): `aif-archive` does not archive it
- do not implement or apply a plan with `implements:`: route it to `adr-auto-implement`
- do not create or switch branches: the operator picks the branch before the run
- do not call other skills as nested calls: read each named skill and apply its workflow inline, or in a subagent where a step says so
- do not apply the completion injection of `aif-implement`, delete the plan or commit between tasks: step 39 is the sole live apply, and step 41 owns archive
- do not change the plan's scope or original request to make a finding pass: a finding the plan cannot meet stops the run
- do not skip, disable or weaken a failing test, or rerun it until it passes: a flaky failure is a finding
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and the commit body
- do not let the exploratory subagent change a file of the repository, or reach a paid or remote service the instructions file does not allow
- do not report a fresh subagent without its runtime invocation and returned result: a separate check in this context is inline
- do not write a capability list into `.ai-factory/DESCRIPTION.md`: the capabilities live in `LIVE.md`
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not split the change across commits: code, tests, QA, documents, memory, archived plan and `LIVE.md` land together
- do not push with `--force`

workflow:
1. read `.ai-factory/config.yaml` and `.ai-factory/adr-extension.yaml`: resolve the plan, plans, QA, archive and live paths, git settings and optional `adr.acceptance` configuration
2. run `git status` when `git.enabled` is true, and stop when any change sits outside the plans directory and the QA directory; stop on a dirty `LIVE.md` too
3. record the exact pre-existing plan and QA paths: stage only this run's changed files later, not unrelated artifacts already present
4. run `adr.acceptance.command` once when it is set, and stop when it fails: the run did not cause that failure
5. stop when `adr.acceptance.exploratory.instructions` names a missing file; use its `rounds` limit when configured
6. read `ai-factory adr live` when LIVE.md exists, and read `ai-factory adr decisions`; record an absent LIVE.md as opt-out
7. stop on an input fast plan or a plan with `implements:`, and name the route from `forbidden_behaviors`
8. inspect the topic or existing plan against the active decisions: stop and recommend `adr-propose` when it binds work beyond this change
9. name an active ADR whose capability the change alters or removes, and continue: live apply records removal debt, which the report routes to `adr-auto-plan`
10. make a full plan by `aif-plan full` semantics for a topic, on the current branch, or take the given full file or ultra entrypoint; validate the ultra marker and phase links by core plan semantics
11. write 1 `adr-live` fence after the entrypoint's title, keeping a Handoff line first: use `changes:` with double-quoted summaries or `none:` with the reason
12. read `ai-factory adr format` and reuse the capability ids in LIVE.md; write summaries with its lexicon and name durable refs for code the plan describes
13. apply `aif-improve` semantics to the plan, picking scoped defaults without questions, with passes per plan <= 5; preserve its original request and the first fence
14. run `ai-factory adr live apply <entrypoint> --dry-run` after each pass; correct the fence as the error says, and stop if it still fails
15. stop improvement after a pass changes no task; stop the run if tasks still change after pass 5 or a required choice would expand the scope
16. run `ai-factory adr live apply <entrypoint> --dry-run` before implementation, and stop if the corrected delta still fails
17. apply `aif-implement` semantics to every task inline, suppressing its injected live apply and artifact cleanup; keep the entrypoint and fence for step 39
18. apply `aif-qa --all` to the uncommitted change, then write an automated test for each test case a harness of the project can check
19. record each other test case as `needs <harness>`, or as `manual` when no code can check it
20. run the project's test suite
21. run `adr.acceptance.command` when set: a non-zero exit is a failing test of this round
22. start 2 fresh read-only subagents in parallel over the change: 1 applies `aif-verify` against the original request and tasks, 1 applies `aif-review`
23. start a fresh exploratory subagent in the same batch when configured, steps 20 and 21 pass, and exploratory rounds remain
24. pass it the instructions file, the original request, scenario tasks and relevant active obligations; let it start, drive and stop the product only as that file allows
25. run step 22 inline when the runtime exposes no subagent API or every launch fails; skip exploratory and report the weaker checks in the writing context
26. fix every failing test by `aif-fix` fix-now semantics: the failing test is the regression test of its fix
27. write a test for each exploratory anomaly, in the acceptance suite when the project has one, and run it: an anomaly whose test fails is a finding of this round
28. record an anomaly no test reproduces, with its steps, and do not fix it: the exploratory subagent is not deterministic
29. list every plan deviation from verify, bug or security finding from review, and reproduced anomaly as a finding to fix
30. write a test for each listed behavioural finding, and see it fail on the unfixed code; a structural deviation needs no test since verify checks it each round
31. put a test of a finding that shows only in the running product in the acceptance suite when the project has one
32. write a test for each outcome a fix must keep when it changes a condition, a `catch` or a status code
33. fix every listed finding, then run its tests and see them pass
34. record review findings left off the list and each fix no harness can test as `needs <harness>` or `manual`
35. repeat steps 20 to 34 until tests and acceptance pass and no check reports a finding to fix, with rounds per change <= 3
36. stop when round 3 ends with a finding to fix, or a fix needs a scope change to the plan: leave the artifacts and commit nothing
37. update each document the change makes incorrect by `aif-docs` semantics: DESCRIPTION.md, ARCHITECTURE.md, AGENTS.md, README.md and the docs directory
38. update the runtime's project memory with each durable fact the change adds, such as a module or convention
39. compare the fence with the built behaviour, correct it, then run `ai-factory adr live apply <entrypoint>` exactly once successfully; stop on failure and commit nothing
40. record its operations and warnings, then run `ai-factory adr live check`; report active-ADR removal debt as `next: adr-auto-plan to supersede it`
41. archive the completed plan by `aif-archive` semantics, preserving the fence and `applied:`; stop on archive failure and commit nothing
42. run `ai-factory adr live check` again: the plan stem must resolve in the archive; stop on new broken refs caused by this archive
43. stage by name code, tests, QA, documents, the archived plan, LIVE.md when changed and the memory file when it lives in the repository
44. inspect `git diff --cached --name-only` and the staged diff: include exactly the run's files, including archive metadata; stop on staging failure or an unrelated staged file
45. write 1 commit-body line `Untested: <case> — <needs harness or manual>` per record of steps 19 and 34
46. commit the change by `aif-commit` semantics without its push step, in 1 commit with that body
47. push the current branch with `git push`, or `git push -u origin <branch>` without an upstream
48. skip step 47 when `git.skip_push_after_commit` is true, and skip steps 43 to 47 when `git.enabled` is false; report each skip and any operator override
49. record 1 row per stage, pass and round as it ends, with counts, changed paths and commit ids, and a reason for each skipped stage
50. report `report_format`, the minor picks and their grounds, findings not fixed, anomalies no test reproduced, and the stop reason
51. report the status footer

report_format:
```text
| Step | Stage | Pass / round | Result |
|---|---|---|---|
| 4 | acceptance baseline | — | `<command>`: exit <code>, or skipped: not configured |
| 10 | plan | — | `<stem>`; created full or reused full/ultra |
| 13 | improve | 1 | tasks <ids> changed, or none; converged or stopped |
| 17 | implement | — | tasks <done>/<total> |
| 18 | tests | — | <n> written from <m> test cases |
| 20 | test run | 1 | `<command>`: <passed>/<total> |
| 21 | acceptance | 1 | `<command>`: exit <code>, or skipped: not configured |
| 22 | verify | 1 | <k> deviations; subagent or inline |
| 22 | review | 1 | <k> to fix, <j> recorded; subagent or inline |
| 23 | exploratory | 1 | <k> anomalies, <r> reproduced; or skipped: <reason> |
| 33 | fix | 1 | <what changed>; regression tests: `<file>` <test name>, each failed before its fix |
| 34 | untested | — | <k>: <case> — needs <harness> or manual; or none |
| 37 | docs | — | `<paths>`, or none |
| 38 | memory | — | <facts>, or none |
| 39 | apply | — | LIVE.md: <op> <capability-id>, or skipped: <reason>; warnings: <debt> |
| 41 | archive | — | `<archived-entrypoint>` |
| 46 | commit | — | `<sha>`, or skipped: <reason> |
| 47 | push | — | `<branch>`, or skipped: <reason> |
```

status_footer:
  format: "✔ adr-auto-change: <capability-id, ...> · plan: <stem> · untested: <k> · stopped at: <step or none> · pushed: <branch or no>"
  source: the step 39 apply output for capability ids, git for the branch, and this run's records for untested
  note: use `none` for capability ids on a no-op, opt-out or stop before apply; report the actual stop step and count every untested case, even on a stopped run

invocation:
- Claude Code: `/adr-auto-change <topic or @full-plan or @ultra-bundle>`
- Codex: `$adr-auto-change <topic or @full-plan or @ultra-bundle>`
