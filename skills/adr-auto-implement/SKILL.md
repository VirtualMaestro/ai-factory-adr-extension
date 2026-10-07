---
name: adr-auto-implement
description: Run the ADR implementation phase end to end for 1 or more accepted ADRs — implement, write tests, verify, review, fix, update the docs, finalize, commit and push, with no questions to the operator.
---

mode: adr_implementation_run

purpose:
- carry 1 or more `accepted` ADRs with a plan to `active`, with automated tests, an independent review, and 1 pushed commit per ADR
- replace the manual sequence `adr-implement`, `aif-qa`, `adr-verify`, `aif-review`, `aif-fix`, `adr-finalize`, `aif-commit` with 1 run
- rest on the planning phase: a question here means the plan left a gap, so the run stops instead of asking

inputs:
- ADR files, or none: with none, the run takes the `order` list of `ai-factory adr order`

forbidden_behaviors:
- do not ask the operator anything, including whether to commit at a checkpoint or whether to push
- do not create or switch branches: the operator picks the branch before the run
- do not commit an ADR's code before its tests pass and its review finds nothing left to fix
- do not split an ADR across commits: its code, tests, documents, ADR move and plan archive land in 1 commit
- do not stage files by pattern, such as `git add -A`: stage by name the paths this ADR changed
- do not call other skills as nested calls: read each named skill and apply its workflow inline, or in a subagent where a step says so
- do not change the plan or the ADR decision to make a finding pass: a finding the plan cannot meet stops the run
- do not skip, disable or weaken a failing test, or rerun it until it passes: a flaky failure is a finding
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and the commit body
- do not let the exploratory subagent change a file of the repository, or reach a paid or remote service the instructions file does not allow
- do not push with `--force`

workflow:
1. run `ai-factory adr order` and take the input ADRs in its order
2. stop and report the cycle when its `cycles` list is non-empty
3. run `git status` and stop when a change sits outside the ADR root, the plans directory and the QA directory: a commit would take in work not of this run
4. run `adr.acceptance.command` from `.ai-factory/adr-extension.yaml` once when it is set, and stop the run when it fails: the run did not cause that failure
5. stop the run when `adr.acceptance.exploratory.instructions` names a file that does not exist
6. stop the run at an ADR whose status is not `accepted`, or whose dependency is not `active`: the planning phase left a gap
7. skip steps 8 to 28 for a documentation-only ADR: it has no plan and no code
8. apply `adr-implement` to the ADR: every task of its plan, with no commit between tasks
9. apply `aif-qa --all` to the uncommitted change of this ADR, then write an automated test for each test case a harness of the project can check
10. record each other test case as `needs <harness>`, or as `manual` when no code can check it
11. run the project's test suite
12. run `adr.acceptance.command` when it is set: a non-zero exit is a failing test of this round
13. start 2 fresh subagents in parallel, both read-only, over the uncommitted change: 1 applies `adr-verify` without its anchor steps, 1 applies `aif-review`
14. start a fresh exploratory subagent in the same batch when `adr.acceptance.exploratory` is set, steps 11 and 12 pass, and this ADR has exploratory rounds left
15. pass it the instructions file, the `decision:`, `scope:` and `rules:` blocks of the ADR, and the scenario tasks of its plan
16. let it start the product as the instructions file says, drive it through those scenarios, stop what it started, and report each anomaly with its steps
17. run the checks of step 13 inline when the runtime offers no subagents, skip the exploratory subagent, and state both in the report: a check in the context that wrote the code is weaker
18. fix every failing test by applying `aif-fix` in fix-now mode: the failing test is the regression test of its fix
19. write a test for each anomaly, in the acceptance suite when the project has one, and run it: an anomaly whose test fails is a finding of this round
20. record an anomaly no test reproduces, with its steps, and do not fix it: the exploratory subagent is not deterministic
21. list the findings to fix: every deviation from `## Decision` that `adr-verify` reports, every bug or security finding that `aif-review` reports, every finding of step 19
22. write a test that reproduces each listed finding that shows as behaviour, and see it fail on the unfixed code: a structural deviation needs no test, since `adr-verify` checks it each round
23. put the test of a finding that shows only in the running product in the acceptance suite, when the project has one: the next run checks it deterministically
24. write a test for each outcome a fix must keep when it changes a condition, a `catch` or a status code: a test of the finding alone misses a fix that breaks the other outcomes
25. fix every listed finding, then run its tests and see them pass
26. record for the report the review findings left off the list, and each fix no harness of the project can test, as `needs <harness>` or `manual`
27. repeat steps 11 to 26 until the tests and the acceptance command pass and no check reports a finding to fix, with rounds per ADR <= 3
28. stop the run when round 3 ends with a finding to fix, or when a fix needs a change to the plan or the decision: leave the ADR `accepted` and commit nothing of it
29. update each project document that the change of this ADR makes incorrect, applying `aif-docs` semantics inline: `.ai-factory/DESCRIPTION.md`, `.ai-factory/ARCHITECTURE.md`, `AGENTS.md`, `README.md`, the docs directory
30. update the project memory the runtime keeps with each durable fact of this ADR that it lacks, such as a new module or a convention the code now follows
31. apply `adr-finalize` to the ADR, and stop the run when it fails: leave the ADR `accepted` and commit nothing of it
32. write `evidence:` without a commit id: the ADR lands in the commit it would cite, and `git log -- <adr-file>` finds that commit
33. stage by name the code, tests, QA artifacts and documents of this ADR, with the memory file when it lives in the repository
34. write the commit body with 1 line `Untested: <case> — <needs harness or manual>` per record of steps 10 and 26 for this ADR
35. commit them with the ADR move and plan archive that `adr-finalize` staged, in 1 commit with that body, by applying `aif-commit` without its push step
36. push the current branch: `git push`, or `git push -u origin <branch>` when the branch has no upstream
37. skip step 36 when `git.skip_push_after_commit` is true in `.ai-factory/config.yaml`, and skip steps 33 to 36 when `git.enabled` is false
38. continue with the next ADR from step 6
39. record 1 row per stage and per round as it ends, with the counts and commit ids it produced, and 1 row with its reason for each stage the run skips
40. report the rows in `report_format`, then the findings not fixed, the anomalies no test reproduced, then where the run stopped and why
41. report the status footer

report_format:
```text
| ADR | Stage | Round | Result |
|---|---|---|---|
| — | acceptance baseline | — | `<command>`: exit 0, or skipped: not configured |
| `<adr-id>` | implement | — | tasks <done>/<total> |
| `<adr-id>` | tests | — | <n> written from <m> test cases |
| `<adr-id>` | test run | 1 | `<command>`: <passed>/<total> |
| `<adr-id>` | acceptance | 1 | `<command>`: exit <code> |
| `<adr-id>` | verify | 1 | <k> deviations, subagent |
| `<adr-id>` | review | 1 | <k> to fix, <j> recorded, subagent |
| `<adr-id>` | exploratory | 1 | <k> anomalies, <r> reproduced by a test, subagent |
| `<adr-id>` | fix | 1 | <what changed>; regression tests: `<file>` <test name>, each failed before its fix |
| `<adr-id>` | test run | 2 | `<command>`: <total>/<total> |
| `<adr-id>` | acceptance | 2 | `<command>`: exit 0 |
| `<adr-id>` | verify | 2 | 0 deviations, subagent |
| `<adr-id>` | review | 2 | 0 to fix, subagent |
| `<adr-id>` | exploratory | 2 | skipped: not configured, no subagents, or no rounds left |
| `<adr-id>` | untested | — | <k>: <case> — needs <harness> or manual; or none |
| `<adr-id>` | docs | — | `README.md`, or none |
| `<adr-id>` | memory | — | 1 fact, or none |
| `<adr-id>` | finalize | — | `active` |
| `<adr-id>` | commit | — | `<sha>` |
| `<adr-id>` | push | — | `<branch>`, or skipped: <reason> |
```

status_footer:
  format: "✔ adr-auto-implement: <adr-id, ...> · active: <n> · untested: <k> · stopped at: <adr-id or none> · pushed: <branch or no>"
  source: `ai-factory adr status` for each ADR of the run
  note: the list names each ADR the run took up, in run order, or `none` when the run stopped before the first; untested counts the records of steps 10 and 26 across the ADRs the run committed

invocation:
- Claude Code: `/adr-auto-implement [@adr-file ...]`
- Codex: `$adr-auto-implement [@adr-file ...]`
