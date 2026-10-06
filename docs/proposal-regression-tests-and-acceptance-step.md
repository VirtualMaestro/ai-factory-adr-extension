# Proposal — regression tests on every fix, and an optional acceptance step in `adr-auto-implement`

Written 2026-10-06 and revised the same day after a review against the skill text, the config code and the CNL-P
checker. This is a proposal, not a governed artifact. It is prose and deliberately not CNL-P.

**Status: implemented in 4.3.0.** The skill text in `skills/` is the source of truth. The drafts below were split
into 1 idea per step on the way in, so their wording and step numbers differ from the shipped skill (§6).

It comes from one project that uses the extension: `game-design-expert-system`, a React and Fastify web app. Every
commit id below is from that repository.

---

## 0. Summary

Two changes, of different weight:

1. **Core, small, for every project.** Before every fix that changes behaviour, `adr-auto-implement` writes a test and
   sees it fail on the unfixed code. A test case or a fix that no available harness can check becomes a report row
   and a line in the commit body, not a silent gap.
2. **Optional and configured per project.** An acceptance step runs inside the round loop, after the project's test
   suite. It runs a project command, such as a browser suite against mock executors: once before the first ADR, then
   every round. It can also start an exploratory agent that walks the ADR's scenarios in the running product. An
   anomaly the agent reports becomes a finding only when a test reproduces it. A project with no `adr.acceptance`
   block skips the step.

The first change belongs in the package because it does not depend on what the project is. The second belongs in the
package only as a place in the workflow, a config key and an agent contract. The scenarios, the harness and the cost
decision stay in the project.

---

## 1. What happened

The project ran `adr-auto-implement` on a client-side navigation ADR. Every screen got a URL, and the browser history
became the navigation.

The run behaved as shipped. Round 3 ended with verify at 0 deviations and review at 1 bug. The run fixed the bug in
the working tree, but no independent review of that fix followed. So the run stopped on the round limit (steps 14 and
15): the ADR stayed `accepted`, and finalize, commit and push were skipped. The footer read `stopped at:
adr-every-workspace-screen-has-a-url-and-browser-history-is-the-navigation`.

The operator then gave a new instruction in the same chat. They asked why the findings recorded as not fixed could not
be fixed, and approved fixing 2 of them. The agent ran a 4th round by the skill's steps: fix, test run, fresh verify and
review subagents (review found 1 bug in the new Retry), a fix, and 2 narrow rechecks. Then it finalized. That 4th round
was operator-authorized work after the stop, not part of the run. It ended green:

- typecheck, lint, about 1040 vitest tests and the build all passed;
- verify reported 0 deviations, and review reported nothing to fix;
- the ADR became `active` (`63bf119`).

The follow-up work after it shows the gap.

| Step | What was found | How it was found |
|---|---|---|
| Fresh verify + review of `63bf119`, right after the run | 1 real bug: handing the same idea over to Review a second time was silently ignored. Both subagents found it: review as a bug, verify as a deviation from rule 31 | Independent read-only verify and review subagents |
| Leftovers run (`1e5627f`) | Live browser specs had not run since the ADR. When run, they exposed 4 real bugs (2 in the harness, 2 in the product) | Real-provider browser run |
| Full review of `1e5627f` | 2 real bugs: the first fix of the hand-over bug missed a hand-over opened in a new tab; a 204 hid real server errors | Independent read-only review subagent |
| Fix of those (`f4b65d2`) | Fixed, and a narrow recheck found 0 to fix. But 5 client-side fixes across the 2 commits had **no test** | The report said "the client tests cannot run effects" |
| Adding the missing layers (`6408c0f`) | The first new test immediately found **1 more bug** in the previous fix: a failed startup showed a form instead of Retry on some screens | happy-dom + Testing Library test |

The 2 bugs of the `1e5627f` review differ in origin:

- **The hand-over bug was already in `63bf119`.** The form kept an "applied" marker `${sessionId}:${ideaId}` in its
  saved draft and never reset it, so the second hand-over of the same idea was skipped on every path. The marker
  existed before round 3, so the full verify and review of rounds 3 and 4 both saw it and missed it. `1e5627f` keyed
  the marker to the history entry, which fixed in-app navigation. A link opened in a new tab lands on the first entry,
  whose key is always `"default"`, and that case stayed open until `f4b65d2`.
- **The 204 bug came in with `1e5627f`.** The route's bare `catch` dates from an older ADR and answered 409 to every
  failure, which the panel showed as an error. `1e5627f` changed it to 204, to stop a console error before the
  critique exists, and from then on a real failure hid the panel silently. Its test checked only "no critique yet →
  204", not "a real failure stays an error".

Four causes, none specific to this project:

- **A fix had no regression-test obligation.** Step 12 says "fix every deviation … and every bug". It does not say
  the fix needs a test. Step 7 asks for tests only from QA test cases, and those are written before review findings
  exist.
- **"A test case that code can check" let "cannot check" pass silently.** The project's client tests used
  `renderToString`, which never runs React effects. Every bug in loading, navigation and history state was invisible
  to them. The run treated this as a limit of the code and moved on. It should have been a missing harness to report.
- **Nothing exercised the running product.** Verify and review both read code. Bugs in reloads, new tabs, browser
  history and failed requests showed up only when something drove a browser. The live suite needed a paid provider,
  and the operator runs it only when asked, so nothing drove a browser during the ADR run.
- **The in-run review missed a bug that was in the ADR commit.** The hand-over bug sat in the code through 2 full
  verify/review rounds, and a fresh pair of subagents found it right after the commit. Reading code is not enough to
  see a bug that shows only on the second use of a flow. This proposal does not change the review. Change 2's
  scenarios are the part that would drive that second use.

Once the harnesses existed, every bug above had a test that fails without its fix. That was checked one by one, by
reverting the fix and running the test.

### 1.1 What each change would have done in this run

| Finding | Change | Effect in the ADR run |
|---|---|---|
| 2 product bugs in the live browser run | 2: `command` against mock executors | caught in a round, where the mock suite covers those screens |
| 2 harness bugs in the browser suite | 2: the baseline run | the run stops before the first ADR, where the mock suite shares that harness, and the suite gets repaired first |
| The hand-over bug, in `63bf119` and missed by the in-run review | 2 and §4: a scenario task of the plan, run as a mock acceptance test, that hands the same idea over twice, once from a new tab | caught in a round, where the project writes that scenario; not caught by change 1, which acts only on fixes |
| The 204 bug, from the `1e5627f` fix | 1, its second half | the fix changed a `catch`, so its tests must include the outcome it keeps: "a real failure stays an error", which fails on that fix. A test of the finding alone, "no critique yet → 204", passes the first half and misses the bug |
| 5 client-side fixes without a test | 1 | each fix gets a test that fails first, or a `needs <harness>` record |
| 1 bug in a fix, found by the first effect-running test | 1 | not caught by change 1 alone: the run records `needs happy-dom + Testing Library` in the ADR's commit, so the gap is on record when the ADR becomes `active`, not found later |

---

## 2. Change 1 — a regression test for every fix (core)

### 2.1 Rule

Every fix that changes behaviour ships with an automated test that failed on the code before the fix. The run writes
the test first, runs it and sees it fail. Then it fixes the code and sees the test pass. This covers a review bug or
security finding, a verify deviation that shows as behaviour, and a reproduced exploratory anomaly (§3).

A test of the finding alone is not enough when the fix changes how code chooses between outcomes: a condition, a
`catch`, a status code. The 204 bug of §1 passed that bar. Its test, "no critique yet → 204", failed on the code
before the fix and passed after it, while every real failure began to answer 204 too. So such a fix also gets a test
for each outcome it must keep, such as "a real failure stays an error".

Two kinds of fix need no new test:

- A fix of a failing test (step 11). The failing test is the regression test of its fix.
- A fix of a structural deviation from `## Decision`, such as a wrong module boundary or a library the decision rules
  out. `adr-verify` checks it again in every round, and `adr-verify-all` checks it later. A test that greps the code
  would add nothing.

The run never undoes a fix to prove its test. The ADR has no commit between tasks, so a fix sits mixed with the
feature code in the working tree, and taking it out by hand puts the work at risk. Writing the test first gives the
same proof without that risk.

If no harness in the project can check a fix or a QA test case, the run records it, with what it would need:

- `needs <harness>` when a harness the project lacks could check it, such as an effect-running DOM test. This is a
  task for the operator.
- `manual` when no code can check it, such as a visual judgement. This is a list for manual acceptance.

The run does not build a harness on its own initiative, because that can be a large and opinionated change. It
records the gap, and the operator decides.

A record that lives only in the chat report can go unread after an autonomous run. So each untested case goes to 3
places: a report row, a body line of the ADR's commit, and a count in the status footer. `git log --grep Untested`
finds them later.

### 2.2 Draft skill text (`skills/adr-auto-implement/SKILL.md`)

Step numbers are those of the current skill. Change 1 adds no step, so no number moves.

`forbidden_behaviors:` gains:

```text
- do not fix a behaviour before a test fails on the code without the fix: a fix no harness of the project can test goes to the report and to the commit body as untested
```

Step 7 becomes:

```text
7. apply `aif-qa --all` to the uncommitted change of this ADR, write an automated test for each test case a harness of the project can check, and record each other test case as `needs <harness>`, or as `manual` when no code can check it
```

Step 11 becomes:

```text
11. fix every failing test by applying `aif-fix` in fix-now mode: the failing test is the regression test of its fix
```

Step 12 becomes:

```text
12. fix every deviation from `## Decision` that `adr-verify` reports, and every bug or security finding that `aif-review` reports: before a fix that changes behaviour, write a test that reproduces the finding and see it fail, and when the fix changes a condition, a catch or a status code, a test for each outcome it must keep; then fix and see them all pass; a structural deviation needs no new test, since `adr-verify` checks it again each round
```

Step 13 becomes:

```text
13. record for the report the review findings step 12 does not fix, and each fix of step 12 no harness of the project can test, as `needs <harness>` or `manual`
```

Step 21 becomes:

```text
21. commit them with the ADR move and plan archive that `adr-finalize` staged, in 1 commit, by applying `aif-commit` without its push step, with 1 body line `Untested: <case> — <needs harness or manual>` per untested case of this ADR
```

`report_format:` gains 1 row, and the fix row names its tests:

```text
| `<adr-id>` | untested | — | <k>: <case> — needs <harness> or manual; or none |
| `<adr-id>` | fix | 1 | <what changed>; regression tests: `<file>` <test name>, each failed before its fix |
```

`status_footer:` gains the count:

```text
format: "✔ adr-auto-implement · active: <n> · untested: <k> · stopped at: <adr-id or none> · pushed: <branch or no>"
```

### 2.3 Why it belongs in the package

Nothing in the rule depends on the project's stack. The cost is 1 targeted test run per behaviour fix: the run that
sees the test fail. The run that sees it pass is the test suite of the next round, which runs anyway. In return,
every bug the review rounds catch stays caught, and the round that follows sees the test instead of rediscovering the
bug.

### 2.4 Scope: `adr-auto-implement` only

`adr-implement` carries out the tasks of a plan through `aif-implement` and fixes no findings, so the rule has no step
to attach to there. In the manual path, fixes come from `aif-fix`, which belongs to AI Factory core. The same rule
fits `aif-fix`, and it goes to core as a separate proposal. This proposal touches only the extension's own skill.

---

## 3. Change 2 — an optional acceptance step in the round loop

### 3.1 Shape

A new block in `.ai-factory/adr-extension.yaml`. Every key is optional, and a missing block means the step is
skipped:

```yaml
adr:
  acceptance:
    # A deterministic project command: run once before the first ADR, then every round.
    # A non-zero exit is a failing test of that round.
    command: npm run test:browser:mock
    # Optional: an exploratory agent that walks the ADR's scenarios in the running product.
    exploratory:
      instructions: docs/testing/exploratory-acceptance.md   # what it holds: §3.3
      rounds: 1                                              # rounds per ADR that may start it (cost cap)
```

The key sits under `adr.acceptance`, not under a skill's name. It describes how this project is accepted, not how
one skill runs. Users write it by hand and no code migrates it, so a later rename would break every adopting project.
A later consumer, such as `adr-verify-all` or a release check, can read the same key. This proposal adds no such
consumer.

The skill reads the block from `.ai-factory/adr-extension.yaml` directly, the way `adr-migrate` and `adr-verify-all`
already read `adr.root`. The key does not need to be in `DEFAULT_CONFIG`. `ensureConfig` writes defaults only into a
new file, and the absence of the key is what makes the step optional. No code validates the block, so a misspelled
key reads as absent. The `skipped: not configured` row in every report makes that visible.

### 3.2 Place in the workflow

The deterministic command runs inside the round loop, right after the test suite. Its failures then share the round
limit and the fix path of any failing test. The exploratory agent joins the parallel checks of step 9, in the first
round where the tests and the command pass: driving a product whose tests fail spends tokens on known breakage.

The drafts below name the current step they follow or replace. §6 gives the final numbers.

After step 3, 2 new steps:

```text
run `adr.acceptance.command` once when it is set in `.ai-factory/adr-extension.yaml`, and stop the run when it fails: the run did not cause that failure, and fixing it would spend the rounds of an ADR
stop the run when `adr.acceptance.exploratory.instructions` names a file that does not exist
```

After step 8, 1 new step:

```text
run `adr.acceptance.command` when it is set: a non-zero exit is a failing test of this round
```

Step 9 gains the third subagent:

```text
start 2 fresh subagents in parallel, both read-only, over the uncommitted change: 1 applies `adr-verify` without its anchor steps, 1 applies `aif-review`; start a third in the same batch when `adr.acceptance.exploratory` is set, the tests and the acceptance command of this round pass, and this ADR has rounds of it left, giving it the instructions file, the `decision:`, `scope:` and `rules:` blocks of the ADR, and the scenario tasks of its plan
```

After step 9, 1 new step holds the agent's contract:

```text
the exploratory subagent starts the product as the instructions file says, drives it through those scenarios, stops what it started, changes no file of the repository, reaches no paid or remote service the instructions file does not allow, and reports each anomaly with the steps that reproduce it
```

Step 10 gains the fallback:

```text
run both read-only checks inline when the runtime offers no subagents, skip the exploratory one, and state both in the report: a check in the context that wrote the code is weaker
```

After step 11, 1 new step turns anomalies into findings:

```text
write a test that reproduces each anomaly, in the acceptance suite when the project has one, and run it: an anomaly whose test fails is a finding of this round; record an anomaly no test reproduces, with its steps, and do not fix it
```

Step 12 gains the reproduced anomalies, whose reproducing test is their regression test, and the place for a test of
a bug that shows only in the running product:

```text
… and every anomaly the step before reproduced; put the test of a bug that shows only in the running product in the acceptance suite, so the next run checks it deterministically
```

Step 14 becomes:

```text
repeat the round steps until the tests and the acceptance command pass and no check reports a finding to fix, with rounds per ADR <= 3
```

`report_format:` gains these rows:

```text
| — | acceptance baseline | — | `<command>`: exit 0 |
| `<adr-id>` | acceptance | 1 | `<command>`: exit <code> |
| `<adr-id>` | exploratory | 2 | <k> anomalies, <r> reproduced, subagent |
| `<adr-id>` | acceptance | — | skipped: not configured |
| `<adr-id>` | exploratory | — | skipped: not configured, no subagents, or no rounds left |
```

### 3.3 Why the package holds only the place, not the content

| Belongs to the package | Belongs to the project |
|---|---|
| A step that exists, its position in the loop, its round limit and report rows | What "running the product" means: browser, CLI, HTTP API, a library's examples |
| The config key, the skip-when-absent rule and the baseline run | The command, its harness, its mock executors and its cost |
| The exploratory agent's contract: fresh, reads the ADR's blocks and the plan's scenarios, changes no file, stops what it starts, reports anomalies with steps | The instructions file: how to start, check and stop the app, which tools, what must not be touched or paid for |
| The rule "an anomaly is a finding only when a test reproduces it" | The scenarios themselves |
| The rule that the command and the agent write only to paths git ignores | Those paths |

The instructions file needs these parts. The README carries this skeleton:

```markdown
## Start
npm run build && npm run start:mock    # mock executors, no paid provider

## Ready when
GET http://localhost:3000/health returns 200

## Stop
the process started above, and nothing else

## Tools
the browser tools of the runtime, such as Playwright through MCP

## Never
the live provider, the production database, any paid API

## Artifacts
.acceptance/   # ignored by git
```

The output paths matter beyond tidiness. The run stages by name, so a stray file never reaches a commit. But step 3 of
the next run stops on any change outside the ADR root, the plans directory and the QA directory. An untracked
`playwright-report/` left by this run therefore blocks the next one.

A library has no browser, and a CLI accepts differently from a web app. A project that has no cheap deterministic
harness yet can still turn on the exploratory agent alone. Its anomalies then become findings only where some harness
of the project can reproduce them, and the rest stay recorded. The reverse also works.

### 3.4 Cost and risks

- **The deterministic command costs only time** when it runs against mock executors. In the source project it is
  about 10 s plus a build. Running it every round is cheap.
- **A suite that has not run for a while fails for reasons the ADR did not cause.** The source project's live suite
  had 2 harness bugs when it finally ran. The baseline run stops the run before the first ADR, instead of spending the
  rounds of that ADR on a failure it did not cause.
- **The exploratory agent is not deterministic and costs tokens.** `rounds` caps it per ADR. An anomaly opens a fix
  only through a test that fails, so a flaky observation cannot block finalize or open a round.
- **A flaky acceptance command** is a failing test like any other. Step 11 fixes its cause, in the harness or in the
  product, and the existing rule "do not skip, disable or weaken a failing test" forbids a retry until green. It does
  not stop the run at once: a flake still open when round 3 ends stops the run under step 15. The bugs this suite
  exists for, such as races in navigation and history state, look exactly like flakes, so a retry would hide them.
- **The skill body has to stay clean** against `profiles/skill.md` and `test/skill-format.test.js`. The new steps go
  inside `workflow:`. The checker requires the steps to run 1..N with no gap or repeat, so every step after an insert
  is renumbered, with every reference to it (§6).

---

## 4. A smaller, related change to `adr-plan` (optional)

`adr-auto-plan` creates plans by applying `adr-plan` inline (its step 15), so the change goes into `adr-plan` and
reaches both paths. A second copy in `adr-auto-plan` would make 2 places for 1 rule, and the copies would drift.

A plan could name each user-visible scenario its ADR adds as a test task, such as "a hand-over opened in a new tab
fills the form once per hand-over". Step 6 of `adr-auto-implement` applies `adr-implement`, which carries out every
task of the plan. The run therefore writes those tests with no change to step 7. The same tasks are the scenarios the
exploratory agent walks (§3.2). It is cheap, and it moves the scenario thinking to the phase that is meant to have it.

Step 7 of `skills/adr-plan/SKILL.md` becomes:

```text
7. create the plan by applying `aif-plan full` planning semantics in this run, with the frontmatter above and 1 test task per user-visible scenario the decision adds, each naming the failure it prevents
```

The rule in `adr-plan` guards only the creation of a plan. After it, `adr-auto-plan` runs up to 5 passes of
`adr-plan-improve` (its step 18). That skill's quality rules say "drop the obligation whose cost is above that
failure", so a pass could drop or merge a scenario task. A task that names the failure it prevents gives that rule
its answer, and the task stays. If passes still drop such tasks, 1 line goes into `adr-plan-improve`: keep the
scenario test tasks. It does not go into `adr-auto-plan`, which applies `adr-plan-improve` inline, so the line again
reaches both paths.

---

## 5. Non-goals

- The run does not build or install a harness. It names the one it would need.
- The package ships no browser tooling, no mock executors and no scenario library. Those belong to the project, or to
  a stack package.
- No new `adr-*` skill. The acceptance step is a part of `adr-auto-implement`.
- The in-run review stays as it is. Cause 4 of §1 holds, and change 2 and §4 answer it with a scenario that drives
  the second use, not with more review.
- A resume after a stop. §1 shows the gap: after the stop at round 3, the operator continued in the chat, and the
  agent ran round 4 by hand. A rerun of the skill cannot take over, because step 3 stops on the stopped run's
  uncommitted code outside the ADR root. That needs a proposal of its own.

---

## 6. Implementation sketch

| File | Change |
|---|---|
| `skills/adr-auto-implement/SKILL.md` | change 1: the forbidden behaviour, steps 7, 11, 12, 13 and 21, the report rows and the footer; change 2: 5 new steps, steps 9, 10, 12 and 14, the report rows; then the renumbering below |
| `skills/adr-plan/SKILL.md` (optional, §4) | step 7: 1 test task per user-visible scenario |
| `test/skill-wiring.test.js` | 2 assertions in the style of the existing ones: a fix step of `adr-auto-implement` writes a test that fails before the fix; an anomaly no test reproduces is recorded, not fixed |
| `README.md` → Configuration | the `adr.acceptance` block, marked optional; the instructions-file skeleton; the rule that the command and the agent write only to paths git ignores |
| `package.json`, `extension.json` | `4.3.0` in both: the `prepack` hook fails on a mismatch |
| `CHANGELOG.md` | `4.3.0`. Changed: the regression-test rule, the commit-body lines and the footer count. Added: the acceptance step. Projects without the key run as before, except for the regression-test rule |

The regression-test rule (§2) changes behaviour for every adopting project. It is still additive, because a run that
already wrote tests for its fixes is unaffected. It fits a minor version with a clear changelog line.

As shipped, the workflow of `adr-auto-implement` grew from 27 to 41 steps, because the compound drafts were split
into 1 idea per step:

| 4.2.1 | 4.3.0 | Content |
|---|---|---|
| 1–3 | 1–3 | unchanged |
| — | 4, 5 | acceptance baseline; instructions file exists |
| 4–6 | 6–8 | unchanged |
| 7 | 9, 10 | QA tests; `needs <harness>` or `manual` records |
| 8 | 11 | test suite |
| — | 12 | acceptance command of the round |
| 9 | 13–16 | verify and review; the exploratory subagent, its inputs and its task |
| 10 | 17 | inline fallback, with the exploratory subagent skipped |
| 11 | 18 | fix failing tests |
| — | 19, 20 | anomaly → test → finding, or a record with no fix |
| 12 | 21–25 | list the findings, failing test first, acceptance-suite placement, outcome-keep tests, fix |
| 13–15 | 26–28 | record, repeat, stop |
| 16–21 | 29–33, 35 | docs to staging; commit |
| — | 34 | `Untested:` lines of the commit body |
| 22–27 | 36–41 | push to footer |

`adr-plan` gained step 8 (each test task names the failure it prevents), and its steps 8–12 became 9–13.

---

## 7. Decisions proposed for the open questions

1. **Should the regression-test rule also go into `adr-implement`?** No. It has no fix step, and the manual path fixes
   through `aif-fix`, which belongs to core (§2.4).
2. **When a missing harness blocks a test, is reporting it enough?** Yes, if the record lasts: a report row, a
   commit-body line and the footer count (§2.1). Stopping would make the extension decide on a project's test stack,
   and the gap stays visible without it.
3. **Should the exploratory agent count toward the 3-round limit?** Yes, with no cap of its own. A noisy observation
   cannot use up a round, because an anomaly opens a fix only through a failing test (§3.2). `rounds` caps the token
   cost, not the round count. An exploratory finding in round 3 stops the run like any other finding.
4. **Is `adr.autoImplement.*` the right namespace?** No. Use the project-wide `adr.acceptance` (§3.1).
