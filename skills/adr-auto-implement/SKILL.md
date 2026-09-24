---
name: adr-auto-implement
description: Run the ADR implementation phase end to end for 1 or more accepted ADRs — implement, write tests, verify, review, fix, finalize, commit and push, with no questions to the operator.
---

mode: adr_implementation_run

purpose:
- carry 1 or more `accepted` ADRs with a plan to `active`, with automated tests, an independent review, and pushed commits
- replace the manual sequence `adr-implement`, `aif-qa`, `adr-verify`, `aif-review`, `aif-fix`, `adr-finalize`, `aif-commit` with 1 run
- rest on the planning phase: a question here means the plan left a gap, so the run stops instead of asking

inputs:
- ADR files, or none: with none, the run takes the `order` list of `ai-factory adr order`

forbidden_behaviors:
- do not ask the operator anything, including whether to commit at a checkpoint or whether to push
- do not create or switch branches: the operator picks the branch before the run
- do not commit an ADR's code before its tests pass and its review finds nothing left to fix
- do not stage files by pattern, such as `git add -A`: stage by name the paths this ADR changed
- do not call other skills as nested calls: read each named skill and apply its workflow inline, or in a subagent where a step says so
- do not change the plan or the ADR decision to make a finding pass: a finding the plan cannot meet stops the run
- do not skip, disable or weaken a failing test to make it pass
- do not push with `--force`

workflow:
1. run `ai-factory adr order` and take the input ADRs in its order
2. stop and report the cycle when its `cycles` list is non-empty
3. run `git status` and stop when a change sits outside the ADR root, the plans directory and the QA directory: a commit would take in work not of this run
4. stop the run at an ADR whose status is not `accepted`, or whose dependency is not `active`: the planning phase left a gap
5. apply `adr-finalize` directly to a documentation-only ADR, then continue from step 18
6. apply `adr-implement` to the ADR: every task of its plan, with no commit between tasks
7. apply `aif-qa --all` to the uncommitted change of this ADR, then write an automated test for each test case that code can check
8. run the project's test suite
9. start 2 fresh subagents in parallel, both read-only, over the uncommitted change: 1 applies `adr-verify` without its anchor steps, 1 applies `aif-review`
10. run both checks of step 9 inline when the runtime offers no subagents, and state that in the report: a check in the context that wrote the code is weaker
11. fix every failing test by applying `aif-fix` in fix-now mode
12. fix every deviation from `## Decision` that `adr-verify` reports, and every bug or security finding that `aif-review` reports
13. record the review findings step 12 does not fix, for the report
14. repeat steps 8 to 13 until the tests pass and neither check reports a finding to fix, with rounds per ADR <= 3
15. stop the run when round 3 ends with a finding to fix, or when a fix needs a change to the plan or the decision: leave the ADR `accepted` and commit nothing of it
16. stage by name the code, tests and QA artifacts of this ADR with its ADR file and plan, and commit them by applying `aif-commit` without its push step
17. apply `adr-finalize` to the ADR, citing the commit of step 16 in `evidence:`, and stop the run when it fails
18. commit the ADR move to `active` and the plan archive that `adr-finalize` staged
19. push the current branch: `git push`, or `git push -u origin <branch>` when the branch has no upstream
20. skip step 19 when `git.skip_push_after_commit` is true in `.ai-factory/config.yaml`, and skip steps 16, 18 and 19 when `git.enabled` is false
21. continue with the next ADR from step 4
22. record 1 row per stage and per round as it ends, with the counts and commit ids it produced, and 1 row with its reason for each stage the run skips
23. report the rows in `report_format`, then the findings not fixed, then where the run stopped and why
24. report the status footer

report_format:
```text
| ADR | Stage | Round | Result |
|---|---|---|---|
| `<adr-id>` | implement | — | tasks <done>/<total> |
| `<adr-id>` | tests | — | <n> written from <m> test cases |
| `<adr-id>` | test run | 1 | `<command>`: <passed>/<total> |
| `<adr-id>` | verify | 1 | <k> deviations, subagent |
| `<adr-id>` | review | 1 | <k> to fix, <j> recorded, subagent |
| `<adr-id>` | fix | 1 | <what changed> |
| `<adr-id>` | test run | 2 | `<command>`: <total>/<total> |
| `<adr-id>` | verify | 2 | 0 deviations, subagent |
| `<adr-id>` | review | 2 | 0 to fix, subagent |
| `<adr-id>` | commit | — | `<sha>` |
| `<adr-id>` | finalize | — | `active`, `evidence:` cites `<sha>` |
| `<adr-id>` | commit | — | `<sha>` |
| `<adr-id>` | push | — | `<branch>`, or skipped: <reason> |
```

status_footer:
  format: "✔ adr-auto-implement · active: <n> · stopped at: <adr-id or none> · pushed: <branch or no>"
  source: `ai-factory adr status` for each ADR of the run

invocation:
- Claude Code: `/adr-auto-implement [@adr-file ...]`
- Codex: `$adr-auto-implement [@adr-file ...]`
