# Proposal — orchestrated `adr-auto-implement` and `adr-auto-plan`, with a branch per ADR

Written 2026-11-16 and revised the same day after 2 rounds of independent review (Codex `gpt-6-astra` high, Claude
Fable medium) and the probes of §12. This is a proposal, not a governed artifact. It is prose and deliberately not
CNL-P.

**Status: implemented and released in 6.0.0 (2026-11-16); live runs and reviews in §13.** It changes `skills/adr-auto-implement/SKILL.md`,
`skills/adr-auto-plan/SKILL.md`, `adr-auto-change`, `adr-finalize`, `adr-next`, the skills that edit an ADR or a
plan, the plan profile, the config, and the CLI (`finalize`, `status`, `order`, `validate`, 4 new commands).

---

## 0. Summary

`adr-auto-implement` today runs every task of an ADR's plan in the session that writes the code, checks the whole
uncommitted change with 2 fresh subagents of the same model, and lands the ADR in 1 commit on the current branch.
`adr-auto-plan` improves each ADR and plan in the context that wrote it, and calls it done when a pass changes
nothing.

This proposal replaces both with the working model of an orchestration prompt that has run in production use on
another project, fitted to the ADR lifecycle:

1. **The session does not write.** It orchestrates: it starts agents, judges their findings, runs the checks itself,
   and owns commits, push, memory and the plan's task status.
2. **Roles are configured, not hard-coded.** A writer (Coder, or Author in planning); Reviewer_1, read-only, through
   another vendor's CLI when the project opts in; Reviewer_2 on a severe finding, a red check or a gate.
3. **Each plan task is a full cycle:** code, review, checks, 1 commit, push of the ADR branch.
4. **Each ADR lives on its own branch.** The base receives an ADR only through a `--no-ff` merge after the ADR's gate
   and `adr-finalize` pass on a tree that already holds the current base. A stop leaves the partial work on the ADR
   branch, never on the base.
5. **The ADR records that it is in work.** A claim (`branch:`, `base:`, `started:`) is committed on the base before
   the switch. A reader of the ADR on the base sees where the work is; the CLI and every writing skill refuse to
   change a claimed ADR from another branch. The pushed ADR branch is the lock across clones.
6. **Every state of an ADR branch has a resume rule** (§4.3), including a crash. An interrupted run is resumed by
   name, never by guess.
7. **`adr-auto-plan` takes the same split without a branch** (§7): an Author writes the ADR and its plan, a read-only
   critic reviews each, and a round converges on a clean review. The operator still answers the principled questions
   and approves each draft.

A per-task cycle costs several agents, so a plan task must be substantial (§8.1).

---

## 1. Why

- **A reviewer of the same model shares the writer's blind spots.** A reviewer of another vendor catches a
  different class of defect.
- **A review in the writing context is weak, and a fresh writer per fix loses context.** The prompt keeps 1 writer
  for the whole task and resumes it with each fix.
- **"The tests passed" from the writer is a claim.** The orchestrator runs the checks and reads the exit code.
- **Nothing proves today that a read-only reviewer read only.** A tree hash before and after detects a write.
- **Findings have no triage today.** The prompt adds confirmed, rejected with a reason and a code reference,
  disputed, and scope-changing.
- **"The pass changed nothing" is the author's own verdict** (`adr-improve` step 18). It says the author is satisfied,
  not that the draft holds.
- **Per-task commits on the current branch are unsafe:** a stop at task 3 of 5 would leave half an ADR on the base
  while the ADR still reads `accepted`. A branch per ADR removes that.

---

## 2. Roles

| Role | Lifetime | Writes |
|---|---|---|
| Orchestrator: the session running the skill | the run | commits, push, memory, plan checkboxes, claim |
| Coder | 1 task, resumed with each fix | code and tests of the task |
| Reviewer_1 | 1 review | nothing |
| Reviewer_2 | 1 review; a diagnosing instance lives to the end of its task | nothing |

### 2.1 Runtimes

Each role names a runtime in the config (§6):

| Runtime | Start | Continue the same agent | Read-only |
|---|---|---|---|
| `subagent` | the host's subagent API | Claude Code: `SendMessage` to the agent id | brief, plus snapshot detection |
| `codex-cli` | `codex exec --json …` | `codex exec resume <thread_id> "<msg>"` | `-s read-only` sandbox |
| `claude-cli` | `claude -p --session-id <uuid> …` | `claude -p --resume <uuid> "<msg>"` | `--permission-mode plan` |

- A writer that cannot be continued (a host without that call, or a session that ended) is started fresh with its
  previous report and the current files in the brief; the report says so.
- A role whose CLI is absent, unauthenticated or out of quota falls back to `subagent`, and the report names the
  fallback. When the host has no subagents either, the orchestrator does the role inline, and the report names it: a
  check in the writing context is weaker. This keeps today's fallback (step 17).
- The `codex-cli` sandbox blocks writes on Windows too, and both resume paths keep context (§12 P4, P5). A
  `codex-cli` writer runs without `--ephemeral`, which cannot be resumed.

### 2.2 The Coder

- Its brief carries what it cannot see: the ADR id, the task id and where its requirements sit in the plan, the files
  and modules it touches, the repository rules that apply (from `AGENTS.md`, `CLAUDE.md` and the memory), and the
  checks to run before it reports. On a resume after a stop, the brief names the `wip(adr):` commit it continues.
- Rules in every brief: the smallest change that closes the whole task; reuse what the code has; no new dependency;
  no module outside the task; each fixed defect gets a test that fails without the fix; no real API, paid agent or
  production data in a test.
- It never commits, stages, stashes or pushes.
- Its report lists the changed files, how each requirement is met or why not, the tests it added, the `aif-qa` cases
  it recorded as `needs <harness>` or `manual`, and the check commands with their results.

### 2.3 Reviewer_1

- Reviews 1 task: `aif-review` semantics plus the task's `acceptance` from the plan.
- Runs through `ai-factory adr review` (§2.5), whatever its runtime.

### 2.4 Reviewer_2

- Runs on a trigger only: a Reviewer_1 finding at or above `escalate_at`, a red check, or a gate.
- A re-review is always a fresh instance: a reviewer that sees its own earlier findings anchors on them.
- A diagnosing instance (red check) is kept for the next failure of the same task, since its diagnosis builds on
  what it saw.
- When Reviewer_2 already stands in for Reviewer_1, the escalation runs a second fresh instance.

### 2.5 `ai-factory adr review` — the read-only review as a command

The snapshot, the result check and the CLI call move from shell text in the skill into a tested Node command. Shell
text breaks on Windows: PowerShell has no `<` redirect and its `timeout` is another program. A Node command cannot
start a host subagent, so the command brackets the review instead of running it:

```
ai-factory adr review begin --role <role> --prompt <file> [--files <file> ... --rubric adr|plan] --json
ai-factory adr review run <review-id>                 # CLI runtimes only
ai-factory adr review end <review-id> [--result <file>] --json
```

1. `begin` resolves the role (§6), writes the prompt, the schema and, for `--rubric`, the rubric text under
   `.git/adr-auto/<review-id>/`, takes the snapshot, and prints the id, the runtime and the paths. A file in the tree
   would change the snapshot and fail the review for nothing.
2. For `codex-cli` and `claude-cli`, `run` starts the CLI with the timeout of the role and writes its result.
   For `subagent`, the orchestrator starts the subagent with the prompt and writes its answer to a file: a read-only
   subagent cannot write it.
3. `end` takes the snapshot again and exits non-zero, with the reason, when the CLI exited non-zero or timed out, the
   result is empty or does not match the schema, or the snapshot changed. Such a review does not count. Otherwise it
   prints the findings as JSON.

Without `--files`, the target is the diff the prompt names. `adr-auto-plan` passes files and a rubric (§7.3):

- `--rubric adr`: the `quality_rules:` of the installed `adr-improve` skill, read from the package, so no third copy
  of the rubric exists outside `test/skill-rubric.test.js`;
- `--rubric plan`: the task rules of §8.1 and the `quality_rules:` of `adr-plan-improve`. The `aif-improve`
  semantics belong to AI Factory core; the prompt tells the reviewer to read the installed `aif-improve` skill.

The snapshot covers HEAD, the index and the worktree:

```
HEAD; git status --porcelain -uall; git diff HEAD; git diff --cached; git ls-files -s;
the content hash of each untracked, non-ignored file
```

`git diff HEAD` alone misses a change to the index whose worktree diff stays the same (§12 P1).

**The guarantee and its limit.** The `codex-cli` sandbox prevents a write. The snapshot only detects one, and only in
tracked and untracked non-ignored files: a write to an ignored file or into `.git` goes unseen. The report names the
runtime of each review, so the operator knows which guarantee held.

The result schema: `findings[]` with `severity` in `critical | high | medium | low`, `file`, `line`, `claim`,
`evidence`, `verified`; `checked[]`; `verdict`. For `codex-cli`, `--output-schema` is mandatory: `-o` is
`--output-last-message` and holds JSON only with a schema.

The prompt states the task and its acceptance, what changed, the git commands for the diff, the untracked files, the
writer's contested decisions and what the writer says it checked. It states that all of this is a claim to verify,
that the reviewer changes nothing, checks each finding against the code, and marks what it could not verify.

---

## 3. The run

### 3.1 Remote policy

1 rule for the whole run: remote operations (fetch, push of the base, push and deletion of an ADR branch) run only
when `git.enabled` is true, the base has an upstream, and `git.skip_push_after_commit` is not true. Otherwise the run
is local: the claim locks only this clone, and the report says so.

A rejected push is read from `git push --porcelain` (§12 P8):

- `[rejected]` (`fetch first`, `non-fast-forward`): the remote moved; the step that pushed says what to redo;
- `[remote rejected]`: a policy, such as a protected branch or a hook; the run does not retry it.

### 3.2 Level 0 — once per run

1. Stop unless `git.enabled` is true: the branch model needs git. Today the skill runs without git; this is a
   breaking change of 6.0.0 (§10).
2. Run `ai-factory adr auto config --check` (§6) and stop on an error; record each role's fallback.
3. When the current branch is under `branch.prefix` or is the branch of a claim, go on only with `--resume <adr>` for
   that ADR, and take the base from its claim's `base:`. Otherwise stop and name the branch: a crash left the
   checkout there, and recording it as the base would merge into the wrong branch.
4. A dirty tree: with `--resume` on the ADR branch, it is the `dirty` state of §4.3. Otherwise stop, name the
   uncommitted files, and say to commit them: the planning phase commits ADRs and plans (`adr-auto-plan` step 22).
5. Stop when any path the run commits is ignored by git (`gitIgnored` in `src/util/git.js`): the ADR root, the plans
   and archived plans directories, `LIVE.md`, the QA directory, and the memory file when it lives in the repository.
   `stageMove` ignores a failed `git add` (`src/util/git.js:17`), so an ignored output would leave its commit
   silently.
6. Record the base: the current branch, or the claim's `base:` on a resume. Under §3.1, fetch it and fast-forward it;
   stop when it diverged.
7. Run `ai-factory adr order` and stop on a non-empty `cycles` list.
8. Run `adr.acceptance.command` once when it is set, and stop when it fails.

Every check of Level 0 and of §3.3 step 1 runs on the base: `order`, `status` and `validate` read only the working
tree.

### 3.3 Level 1 — per ADR, in `order`

1. Take the next ADR:
   - stop at an ADR whose status is not `accepted` or whose dependency is not `active`;
   - skip an ADR another run claimed, with every ADR that depends on it, and record each skip for the report: a claim
     is not a failure of this run (§10, decision 5);
   - an ADR claimed for this run is taken only through `--resume` (§4.3).
2. A documentation-only ADR has no plan and no code: apply `adr-finalize` on the base and commit, as today, with no
   branch and no claim.
3. Apply the preflight of `adr-implement`: `resolve-plan` finds 1 plan with reciprocal links, `status --check`
   passes, `format plan --check` passes.
4. Claim and switch (§4.2).
5. Level 2 for each unchecked task of the plan, in plan order.
6. **Gate**, in this order:
   1. **sync:** merge the base into the ADR branch; a conflict aborts the merge and stops. From here the branch holds
      the tree the base will receive, so the gate checks that tree;
   2. the orchestrator runs `checks.full` and `adr.acceptance.command`; a red check is a fix cycle (step 7);
   3. on green, in parallel and read-only: a fresh subagent applies `adr-verify` without its anchor steps
      (deviations from `## Decision`), and a fresh Reviewer_2 reviews `git diff <base>...HEAD`, each through
      `adr review`;
   4. after the reviews end, the exploratory subagent runs when `adr.acceptance.exploratory` is set and rounds remain.
      It starts the product, and the product may write files, so it never overlaps a snapshot.
7. Triage the gate findings as in §3.4 step 3. All confirmed findings of 1 gate round go to the Coder as 1 fix cycle of
   Level 2, with 1 commit. The gate repeats from step 6.1 until it is clean, with gate rounds <= `max_rounds`.
8. Update each project document the ADR makes incorrect (`aif-docs` semantics). When the memory file lives in the
   repository, update it now with each durable fact of the ADR. Commit both.
9. Fetch the base; when it moved since step 6.1, go back to step 6.
10. Apply `adr-finalize` on the branch. It removes the claim, and `evidence:` carries no commit id, as today: `git log
    -- <adr-file>` finds the commit. Commit with the ADR move, the plan archive and the `LIVE.md` change. Do not push
    this commit before the merge: until then it can be dropped.
11. **Merge**:
    1. fetch the base; when it moved since step 9, drop the finalize commit (`git reset --keep HEAD~1`, §12 P6) and go
       back to step 6;
    2. switch to the base and `git merge --no-ff <branch>`; the body lists every `Untested:` line of the ADR's
       commits;
    3. run `ai-factory adr status --check` and `ai-factory adr live check`. An issue undoes the merge
       (`git reset --keep ORIG_HEAD`), switches back to the branch and stops: `live check` exits 0 on issues
       (`commands/adr.js:382`), so the run reads its output;
    4. push the base under §3.1:
       - accepted: go on;
       - `[rejected]`: undo the merge, switch to the branch, drop the finalize commit, and go back to step 6, with
         merge rounds <= `max_rounds`;
       - `[remote rejected]`: undo the merge, push the ADR branch with its finalize commit, switch to the base and
         stop. The ADR is finalized on its branch and waits for the operator's merge, such as a pull request on a
         protected base (§9).
12. When the remote base holds the merge, or the run is local, delete the ADR branch locally and on the remote if
    `branch.delete_after_merge` is true. Then, when the memory lives outside the repository, update it: a fact written
    from an unmerged branch would outlive a branch that never lands.

### 3.4 Level 2 — per task

1. The Coder writes the task, its tests and the `aif-qa` cases a harness can check.
2. Reviewer_1 through `adr review`.
3. Triage each finding against the code:
   - confirmed: to the Coder, with a test that fails without the fix;
   - rejected: recorded with the reason and a code reference, not sent;
   - disputed: the Coder checks it, the orchestrator decides;
   - changes the intent or scope of the task, the plan or the decision: stop (§4.4). The skill asks no questions.
4. A finding at or above `escalate_at`: a fresh Reviewer_2 reviews the whole task diff after the Reviewer_1 fixes;
   triage as in step 3. A finding below `escalate_at` is not re-reviewed here: the gate reviews the whole ADR.
5. The orchestrator runs `checks.task` and `adr.acceptance.command`, and reads exit codes.
6. A red check: Reviewer_2 diagnoses it (it starts now if it has not run), the Coder fixes, the checks run again.
   A test that fails only in the full run is a failure too.
7. Stop when the review-and-fix rounds or the red-check rounds of the task exceed `max_rounds`.
8. Green: release the Coder; tick the task in the plan and run `format plan --check`; commit by name the task's
   files and the plan, with 1 `Untested: <case> — <needs harness or manual>` line per record.
9. Stop when `git status --porcelain` is not empty after the commit: a path left out of the commit would be lost to
   the branch.
10. Push the ADR branch under §3.1.

### 3.5 Release

Not part of the default run. When `release.command` is set and the operator starts the run with `--release`, the
release runs on the base after the last merge, only when the run merged an ADR and did not stop: `checks.full`, a review of the whole run's diff, then the command. Findings go through
Level 2 on a branch of their own. Publishing is outward and irreversible, so there is no default command.

---

## 4. Claim, states and resume

### 4.1 The claim

```yaml
branch: adr/<adr-id>
base: master
started: 2026-11-16
```

- `ai-factory adr validate` errors on a claim in an ADR whose status is not `accepted`. Today it accepts the keys at
  any status (§12 P7).
- `finalize` removes the claim and then always writes the ADR. Today it keeps the claim and writes the ADR only when
  the evidence or `live:` changed (`src/lifecycle/finalize.js:73`, §12 P7).
- `ai-factory adr claim --release <file>` removes a claim and writes the file without committing: `finalize` and the
  plan archive of `adr-auto-change` (§4.7) use it inside their own commit.

### 4.2 Claim and switch

1. Fetch and fast-forward the base under §3.1.
2. `ai-factory adr claim <adr-file> --base <base>` writes the claim and prints the branch name.
3. Commit only the ADR file on the base: `chore(adr): start <adr-id> on adr/<adr-id>`.
4. When the branch exists from an `unclaim` without `--delete-branch`, switch to it and merge the base into it;
   otherwise `git switch -c adr/<adr-id>`.
5. Push the ADR branch with `-u` under §3.1. This is the lock across clones: a `[rejected]` push means another clone
   holds the branch (§12 P3). Then delete the local branch, switch to the base, drop the claim commit
   (`git reset --keep HEAD~1`, §12 P2), and skip the ADR as claimed by another run.
6. Push the base under §3.1, so the claim is visible on the remote:
   - `[rejected]`: the base moved; switch to the base, drop the claim commit, delete the ADR branch locally and on the
     remote, and repeat from step 1 once;
   - `[remote rejected]`: a protected base; the claim stays local and on the ADR branch, and the report says so. The
     ADR branch still locks.

### 4.3 States

The run derives the state of a claimed ADR from its branch, never from the memory of a past run:

| State | How the run sees it | Resume with `--resume <adr>` |
|---|---|---|
| dirty | the tree has changes on the ADR branch | commit them as `wip(adr): <adr-id> — recovered`, then derive the state again |
| wip | HEAD of the branch is a `wip(adr):` commit | keep it; the Coder continues the task it names on top of it |
| tasks | the ADR on the branch is `accepted`, an unchecked task remains | from the first unchecked task |
| gate | every task is checked, the ADR is `accepted` | §3.3 step 6 |
| finalized | the ADR on the branch is `active`, the finalize commit is not on the remote | §3.3 step 11 |
| awaiting merge | the ADR on the branch is `active`, the finalize commit is on the remote | stop: the operator merges |
| merged | the base contains the branch | push the base when its remote lacks the merge, then §3.3 step 12 |
| stale | the claim names a branch that exists neither locally nor on the remote | stop; `adr unclaim` |

- A `wip(adr):` commit stays in the history: dropping a pushed commit would make the next push non-fast-forward, and
  `--force` is forbidden.
- `finalize` writes the ADR, `LIVE.md` and the archive in 1 rollback (`withFileRollback`), so a crash leaves the
  files before or after it, not between. The `dirty` row commits whichever it finds.
- Resume steps: switch to the branch named in the claim, take the base from its `base:`, derive the state, and go on
  from its row. The gate syncs the base, so the resume itself merges nothing.

### 4.4 Stop

A stop inside an ADR:

1. commits the unfinished task, when the tree has changes, as `wip(adr): <adr-id> task <task-id> — <reason>`, on the
   ADR branch only;
2. pushes the ADR branch under §3.1;
3. switches back to the base, so the operator's checkout is where the run found it.

The claim stays on the base. The run takes up no further ADR (§10, decision 4).

### 4.5 Unclaim

`ai-factory adr unclaim <file> [--delete-branch]`:

1. on the base, removes the claim (`--release`) and commits `chore(adr): release <adr-id>`;
2. pushes the base under §3.1;
3. with `--delete-branch`, deletes the branch locally and on the remote.

It is the documented path after a scope stop, when the plan must change on the base, and after an abandoned run.
Without `--delete-branch`, a later claim reuses the branch (§4.2 step 4), and the base's plan edits reach it by the
sync; a conflict there stops the run for the operator.

### 4.6 Guards

- **CLI.** `ai-factory adr finalize`, `transition`, `supersede` and `link-plan` refuse a claimed ADR or plan when the
  current branch is not the claim's branch.
- **Skills.** A skill that edits a file directly bypasses the CLI, so each writing skill runs
  `ai-factory adr claim --check <file>` as its first step and stops on a refusal: `adr-improve`, `adr-plan`,
  `adr-plan-improve`, `adr-implement`, `adr-supersede`, `adr-finalize`, `adr-accept`.
- `ai-factory adr order` lists a claimed ADR as `in work`, not in `next`; `adr-next` reports it with its branch.
- `ai-factory adr status` shows the branch of a claimed ADR or plan. `status --check` warns on a stale claim. It does
  not warn on a missing claim while the current branch is an ADR branch: `adr-finalize` removes the claim before its
  own `status --check`.

### 4.7 Plan claims (`adr-auto-change`)

The implementation phase of `adr-auto-change` claims its plan, since the change has no ADR: `branch:
change/<plan-stem>`, `base:` and `started:` in the plan's frontmatter. A plan's states differ from an ADR's: a plan
is `in_progress` until its archive sets `done` (`src/lifecycle/archive.js:35`), and it has no `finalize`.

| State | How the run sees it | Resume |
|---|---|---|
| dirty, wip | as §4.3 | as §4.3 |
| tasks | the plan on the branch is `in_progress`, an unchecked task remains | first unchecked task |
| gate | every task is checked, the fence has no `applied:` | sync and gate |
| applied | the fence has `applied:` and the plan sits in the archive on the branch | merge |
| merged, stale | as §4.3 | as §4.3 |

- The claim is released (`claim --release`) right before the archive step, so the archive commit carries the plan
  without it.
- `LIVE.md` apply (its step 46) and the archive (its step 48) run on the branch after the sync, like `adr-finalize`.
  Until the merge, the commit that holds them is not pushed and can be dropped, as in §3.3 step 11.
- `profiles/plan.md` lists `branch`, `base` and `started` in `frontmatter_fields`. That list documents; it does not
  check: `format plan --check` reads only the body (§12 P7). `status --check` checks plan claims.

---

## 5. Report

- 1 progress line per event: writer done, Reviewer_1 verdict, Reviewer_2 needed or not, check results, commit id.
  A result not yet in is never guessed.
- The final table gains a `Task` column, the runtime of each review, and rows for claim, sync, gate, merge, skip and
  stop.
- The footer gains the branches: `… · branches: <adr/id, ...> · merged: <n> · skipped: <n> · stopped at: <adr-id
  state>`.

---

## 6. Config

```yaml
adr:
  auto:
    roles:
      coder:      { runtime: subagent }
      reviewer_1: { runtime: subagent }
      reviewer_2: { runtime: subagent }
    escalate_at: high
    max_rounds: 3
    checks:
      task: []           # empty: the project's test suite, as the skill finds it today
      full: []
    branch: { prefix: "adr/", delete_after_merge: true }
    release: { command: null }
    plan:
      roles: {}          # overrides for adr-auto-plan (§7)
  acceptance: { ... }    # unchanged
```

- **`model` and `effort` are optional.** Without them a role takes the host's default. A `subagent` model is a name the
  host understands, so a config shared by Claude Code and Codex leaves it out, or names a CLI runtime instead.
- **Cross-vendor review is opt-in**, since another vendor's CLI receives the code:
  ```yaml
      reviewer_1: { runtime: codex-cli, model: gpt-6.1-sol, effort: medium, timeout: 1800 }
  ```
- **No `latest` alias.** `codex debug models` lists models in no guaranteed order. `ai-factory adr init` may offer the
  current names; the run uses what the config says.
- **`max_rounds`** bounds the gate rounds, the merge rounds, and the review and red-check rounds of each task.
- **`ai-factory adr auto config [--check] [--json]`** prints the resolved roles with their fallbacks and validates the
  block. Today `readConfig` (`src/config/adrConfig.js:38`) has no caller and the skills parse YAML themselves; the
  skills call this command instead. `adr.acceptance` gets the same validation.
- **`adr.auto.plan.roles`** overrides any role for `adr-auto-plan`, such as a higher effort for the critic of a
  decision. A role it does not name comes from `adr.auto.roles`.

---

## 7. `adr-auto-plan` — the same model for the planning phase

### 7.1 Today

`skills/adr-auto-plan/SKILL.md`:

1. Each input is routed by its status: a topic goes to `adr-propose`; a `proposed` or `draft` ADR to `adr-improve`; an
   `accepted` ADR without a plan to `adr-plan`.
2. The batch is ordered so that an ADR follows the ADR its decision rests on.
3. `adr-improve` runs in passes until 1 pass changes no `decision:`, `scope:`, `constraints:` or `rules:` line, with
   passes per ADR <= 5; an ADR still changing after pass 5 is marked unsettled.
4. The run reads each draft against the others and records each contradiction as a principled question.
5. 1 stop for the operator: the principled questions, then the drafts ready for acceptance. Answers go back through
   `adr-improve`; a rejected draft interrupts the phase.
6. `adr-accept` for each approved draft, `adr-plan` for each accepted ADR, `adr-plan-improve` in passes <= 5.
7. Docs, memory, 1 commit, push on the current branch.

**The flaw.** Every improve pass runs inline, in the author's context, with the same blind spots each pass, and
"done" is the author's own verdict. `adr-plan-improve` applies `aif-improve` semantics in the context that wrote the
plan. A weak plan then surfaces only in the implementation phase, where each task costs a full cycle of Coder, review
and checks.

### 7.2 What carries over, and what does not

Carries over: the orchestrator does not write; an Author writes; a read-only critic reviews; the orchestrator triages
each finding and runs the deterministic checks itself; Reviewer_2 escalates.

Does not carry over:

- **No branch, no claim, no per-task commits.** The run writes no code and lands in 1 commit. An accepted ADR with a
  plan on the base does no harm, and a stopped planning run commits nothing.
- **No autonomy at the decision.** The operator still answers the principled questions and approves each draft:
  accepting is the decision itself. `principled_questions:` of the skill stay as they are.

### 7.3 Roles

| Role | Lifetime | Writes |
|---|---|---|
| Orchestrator | the run | transitions, the commit, push, memory |
| Author | 1 ADR, from its input to its improved plan, kept across the operator's stops | the ADR and its plan |
| Reviewer_1 | 1 review | nothing |
| Reviewer_2 | 1 review | nothing |

- **The Author** applies `adr-propose`, the edits of `adr-improve`, `adr-plan`, and the edits of `adr-plan-improve` in
  its own context. Each later step reaches it by message (§2.1), so it keeps what it researched for the ADR while it
  writes the plan. When it cannot be continued, a fresh Author gets the ADR, the plan and the last review. It runs no
  transition: `adr-improve` step 20 and `adr-accept` belong to the orchestrator here.
- **Reviewer_1 of an ADR** uses `--rubric adr` (§2.5). It also checks the draft against `ai-factory adr decisions`
  and the code, and checks the depth step 8 of `adr-improve` sets.
- **Reviewer_1 of a plan** uses `--rubric plan`. It also checks that each `rules:` line of the ADR maps to a task or a
  test, and that each task's files exist or are named as new.
- **Reviewer_2** runs on a Reviewer_1 finding at or above `escalate_at`. It also runs once over the whole batch after
  every draft converges, a fresh instance with every draft and `ai-factory adr decisions`: it replaces step 4 of
  §7.1, which today runs in the orchestrator's own context.

### 7.4 The run

Each input is routed by its status, as today, plus 1 new route: today an existing plan is never improved (step 18
of the skill improves only the plans the run created).

| Input | Path |
|---|---|
| topic | steps 1 to 13 |
| `proposed` or `draft` ADR | steps 2 to 13 |
| `accepted` ADR without a plan | steps 10 to 13 |
| `accepted` ADR with a plan that this phase has not improved | steps 11 to 13, on the existing plan |
| claimed ADR | stop: the guard of §4.6 refuses it |

Per ADR, in batch order:

1. The Author proposes the ADR by `adr-propose`.
2. **Improve round:**
   1. the Author applies the edits of `adr-improve`;
   2. the orchestrator runs `adr validate`, `adr live`, and `adr live apply --dry-run`; a red check goes back to the
      Author;
   3. Reviewer_1 through `adr review --rubric adr`.
3. **Triage**, as in §3.4 step 3, with 1 change:
   - a finding that meets `principled_questions:` parks the ADR for the operator, as today;
   - any other confirmed finding goes to the Author, and the minor pick is recorded with its ground for the report.
4. Escalation as in §2.4.
5. **Converged** when the checks pass and no confirmed finding at or above `medium` remains, with rounds <=
   `max_rounds`. An ADR still with findings after the last round is marked unsettled, as today. This replaces "the
   pass changed no line" for the auto run; `adr-improve` keeps step 18 for a manual run.

Then for the batch:

6. Reviewer_2 cross-reads the batch; each contradiction is a principled question.
7. **Stop for the operator**, as today: the principled questions, then each draft ready for acceptance with its
   `decision:`, its minor picks and its unsettled mark.
8. Each answer reaches the Author of its ADR by message; that ADR runs steps 2 to 5 again, then step 6 for the
   batch. An approval holds while the rounds after it leave the draft unchanged.
9. The orchestrator applies `adr-accept` to each approved draft.

Per accepted ADR, in `order`:

10. The Author writes the plan by `adr-plan`; the orchestrator runs `resolve-plan`, `format plan --check`,
    `status --check` and `adr order`, and stops on a cycle.
11. **Plan rounds:** Reviewer_1 through `adr review --rubric plan`, triage, the Author edits by `adr-plan-improve`,
    the checks of step 10; converged as in step 5.
12. **A plan finding that changes the accepted decision** is a principled question. It goes to a second stop for the
    operator before the commit. The operator picks:
    - change the decision: the orchestrator removes the plan this run wrote (it is not committed), clears `plan:` in
      the ADR, and moves the ADR back to `draft`. The `accepted` transition of `adr-improve` needs the plan removed
      and the operator's intent, which this answer is (`src/lifecycle/move.js:82`). The ADR runs steps 2 to 11 again;
    - keep the decision: the finding is recorded for the report and the plan keeps it as a risk.

    A plan that existed before the run is not removed: the stop reports the finding, and the operator takes the ADR
    back by hand.

Then:

13. Docs, memory, 1 commit, push on the current branch, as today.

### 7.5 Cost

Per ADR: 1 Author, Reviewer_1 x rounds for the ADR and again for the plan (each <= `max_rounds`), Reviewer_2 only on
escalation, and 1 Reviewer_2 for the batch. Planning writes no code and runs no test suite, so a round is cheaper than
an implementation round. The mistake it prevents costs more: a plan whose tasks are too small, too large or not
green, found only during implementation.

### 7.6 Changes to the skill

- `workflow:` rewritten around §7.4; `principled_questions:` unchanged.
- `forbidden_behaviors:` add: never let a reviewer write; never count a pass that changed nothing as converged;
  never accept a draft the Reviewer_2 batch read has not seen.
- Report: a `Reviewer` column, rows for each review round and the batch read; minor picks carry the finding they
  answer.
- `adr-auto-change` plan phase (its steps 12 to 19) takes the plan rounds of step 11.

---

## 8. Changes outside the skills

### 8.1 The plan profile and the planning skills

`profiles/plan.md`, `adr-plan`, `adr-plan-improve` and `adr-auto-plan`:

- **A task is substantial.** It is worth a full cycle of Coder, review and checks: a rename, a config line or a
  one-file edit joins a neighbouring task.
- **A task leaves the tests green.** Its commit is a checkpoint that the next task and a resume build on, so the test
  and the code of 1 behaviour sit in the same task.
- The `acceptance` record key exists already (`profiles/plan.md:45`); Reviewer_1 checks it.
- `frontmatter_fields` gains `branch`, `base` and `started` (§4.7).

### 8.2 CLI

- New: `adr claim [--base | --check | --release]`, `adr unclaim`, `adr review begin | run | end`, `adr auto config`.
- Changed: `validate` (claim only at `accepted`), `status` and `status --check` (claims of ADRs and plans), `order`
  (`in work`), `finalize` (releases the claim, always writes), and the guards of §4.6.

### 8.3 Skills

- `adr-auto-implement`: rewritten around §3 and §4.
- `adr-auto-plan`: rewritten around §7.
- `adr-finalize`: releases the claim; its `status --check` holds under §4.6.
- `adr-next`: reports `in work`.
- The writing skills of §4.6 gain `claim --check` as their first step.
- `adr-auto-change` takes the roles of §2, `adr review`, the plan rounds of §7.4 step 11, and the branch model for its
  implementation phase only:
  - the planning phase (steps 1 to 23, and every `plan` run) commits the plan on the base, as today;
  - the implementation phase (an `implement` run, or the second half of a full run) claims the plan (§4.7).

  `adr-auto-implement` and `adr-auto-change` sit in the `NONE` group of `test/skill-rubric.test.js`, so no test keeps
  them in step.
- README: `adr-auto-implement` no longer lands "1 pushed commit per ADR".

### 8.4 The `forbidden_behaviors` of `adr-auto-implement`

- Remove: "do not create or switch branches"; "do not split an ADR across commits".
- Add: commit on the base only a claim, a release, a documentation-only finalize or an ADR merge; never merge an ADR
  whose gate is not clean; never push a finalize commit before its merge, except to hand a protected base to the
  operator; never `--force`, on any branch; never drop a pushed commit; never let a reviewer write; never resume a
  claimed ADR the operator did not name; never write the memory outside the repository from an unmerged branch.

---

## 9. Alternatives rejected

- **1 commit per ADR on the current branch (today).** 1 unreviewable diff per ADR; per-task commits unsafe.
- **Commits per task on the current branch.** A stop leaves half an ADR on the base.
- **The in-work marker derived from git only.** Invisible to a reader of the ADR, needs a fetch, and gives the other
  skills nothing to read. §4.6 uses git to check the claim instead.
- **The pushed claim on the base as the lock.** A protected base rejects it, and no run could start. The pushed ADR
  branch locks instead (§12 P3); the claim on the base is for readers.
- **A new status `in_progress`.** A new status directory, new transitions and `order` changes; a frontmatter claim
  does the same.
- **Resume any claimed ADR automatically.** A stopped run of this clone and a live run elsewhere look the same.
- **Merge the base in after finalize.** The gate would approve a tree the base never receives, and `LIVE.md` would
  carry a delta computed on a stale file. §3.3 syncs before the gate and drops an unpushed finalize when the base
  moves.
- **Drop the WIP commit on resume.** It is pushed at the stop; dropping it needs `--force`.
- **A pull request per ADR instead of a local merge.** It adds a host, an account and a wait to a solo developer's
  local loop, and it stops each dependency chain at its first ADR until someone merges. A protected remote base needs
  no special mode: its push is a `[remote rejected]`, and the run hands the finalized branch to the operator
  (§3.3 step 11.4).
- **A git worktree per ADR.** It keeps the operator's checkout free, but:
  - a local merge has to land in the checkout that holds the base, since git does not check out 1 branch in 2
    worktrees; moving the base ref by plumbing leaves the operator's files behind it;
  - ignored files (`node_modules`, `.env`, `.ai-factory/extensions/`, `.codex/`) do not follow, so each worktree needs
    a bootstrap;
  - each agent must be pointed at the worktree, and a write to the operator's checkout escapes the snapshot.
  Worth revisiting as opt-in together with parallel ADRs.

---

## 10. Decisions

Decided by the operator:

1. **Version 6.0.0.** Breaking: the branch model changes what a run does to the repository, and a run with
   `git.enabled: false` stops instead of working without git.
2. **Local merge only.** No pull-request mode (§9).
3. **`adr-auto-change` branches its implementation phase only** (§8.3).
4. **A stop ends the run.** 1 run takes several ADRs: the files given, or the whole `order` list when none are given.
   After a stop the run takes up none of them, even one that does not depend on the stopped ADR. A stop often has a
   cause the next ADR shares, such as a broken environment or a missing harness, and the operator restarts the run
   after the fix.
5. **A claim by another run is a skip, not a stop.** The run skips that ADR and every ADR that depends on it, and
   reports them. A claim is not a failure, so decision 4 does not apply.

No question is open.

---

## 11. Implementation phases

1. CLI: `adr auto config`; `adr claim` with `--check` and `--release`; `adr unclaim`; claims in `validate`, `status`,
   `status --check` and `order`; `finalize` releases and always writes; the CLI guards.
2. CLI: `adr review begin | run | end` with the snapshot, the runtimes, the schema and the rubrics.
3. Plan profile and planning skills (§8.1); `adr-auto-plan` (§7).
4. `adr-auto-implement`: roles, levels, states, stop, merge, report; `adr-finalize`, `adr-next`; `claim --check` in
   the writing skills.
5. `adr-auto-change`: roles, `adr review`, plan rounds, and the plan claim for its implementation phase.
6. Live runs in a scratch project under Claude Code and Codex: a 2-ADR chain with a dependency; a stop mid-task and
   its `--resume`; a crash with a dirty tree and its resume; a base that moves before the merge; a merge conflict; a
   protected base; Reviewer_1 through `codex-cli`, and with Codex absent; an `adr-auto-plan` batch of 2 ADRs with a
   principled question and a plan finding that changes the decision.

---

## 12. Verified by probe (2026-11-16)

In scratch repositories with a bare local remote, on Windows 11, Git Bash, Node 24, `codex-cli 0.167.0`:

- **P1.** The snapshot without `git diff --cached` and `git ls-files -s` gives the same hash for 2 different staged
  contents with the same worktree file. With them, the hashes differ.
- **P2.** A claim commit pushed after the remote base moved is rejected (exit 1); `git reset --keep HEAD~1` restores
  the base to its upstream with 0 commits ahead.
- **P3.** A second clone pushing its own `adr/x` after the first pushed `adr/x` is rejected (exit 1): the branch push
  is a lock across clones.
- **P4.** `codex exec -s read-only`, asked to create a file, exits 0 without the file; the model reports a read-only
  filesystem. An exit of 0 alone does not prove the review ran clean, so `adr review end` checks the snapshot too.
- **P5.** `codex exec --json` prints a `thread_id`; `codex exec resume <thread_id> "<msg>"` answers from the first
  turn's context. `claude --help` lists `--session-id <uuid>` and `--resume <id>`; not run.
- **P6.** Through the package's own `finalize` (`src/lifecycle/finalize.js`), in a project built by `test/helpers.js`:
  a task commit and a finalize commit on `adr/adr-x`; the base moves; `git reset --keep HEAD~1` brings back the
  `accepted` ADR and the live plan with a clean tree; after merging the base in, a second `finalize` succeeds; the
  `--no-ff` merge into the base leaves the ADR `active` and the tree clean.
- **P7.** `validateAdr` reports no error and no warning for `branch:`, `base:` and `started:` in an `accepted` ADR,
  and none for the keys in an `active` one; `finalize` keeps the claim. `bodyIssues` of the plan profile (the check
  behind `format plan --check`) reports nothing for the same keys in a plan's frontmatter: the check reads the body.
- **P8.** `git push --porcelain` prints `[remote rejected] (pre-receive hook declined)` for a branch a hook protects,
  and `[rejected] (fetch first)` for a remote that moved; both exit 1.

Not checked: a live run of any skill; `--permission-mode plan` as a read-only guarantee for `claude-cli`; the core
`aif-archive` and `aif-plan` behaviour on a branch; a protected base on a real host.

---

## 13. Phase 6 — live runs (2026-11-16)

A scratch project built as `AGENTS.md` says (`ai-factory init --agents claude,codex --config`, the extension
added from this repository, a bare local remote), 1 accepted ADR `adr-text-utils` with a `cnlp-plan` of 2 tasks.

- **CLI through the installed extension.** `adr auto config --check`, `adr claim --base`, `adr order` (`in work`),
  `adr status` (the stale warning before the branch exists), the `finalize` guard on `master`, `claim --check` on
  and off the branch, `adr unclaim --delete-branch` with its push: each as §4 says.
- **`adr review run` on Windows.** `codex-cli` and `claude-cli` reviewers, both read-only, both ended clean through
  `adr review end`; `claude -p --json-schema` returns the result in `structured_output`.
- **Claude Code, `/adr-auto-implement`, subagent roles.** Claim and push; per task a Coder, Reviewer_1, Reviewer_2 on a
  `high` finding, a test that failed before each fix, the checks, 1 commit and push; sync; the gate (Reviewer_2 and
  `adr-verify`, clean); finalize on the branch; `--no-ff` merge into `master`, push, branch deleted; `in work` 0.
- **Codex, `$adr-auto-implement`, Reviewer_1 on `claude-cli`.** After task 1 the tree was not clean (below): the run
  committed `wip(adr):` on the branch, pushed it and switched back to `master`. After the fix on `master`,
  `--resume` took the `wip` state, wrote task 2, merged `master` in at the gate, finalized and merged.
- **First run of Claude Code** stopped before the claim on a plan without `format: cnlp-plan`: the skill ran
  `format plan --check` on every plan. Fixed: the preflight and the task step check only a `cnlp-plan`.

Found and fixed: `ai-factory adr cnlp check` adds the ADR corpus entry to the tracked `cnlp.config.json` the first
time an accepted ADR exists, so the first check in the implementation phase dirtied the tree. `adr transition` to
`accepted` now writes and stages the entry, so it lands in the planning commit (`test/git-stage.test.js`). A project
that accepted its first ADR before this change gets the entry from its first `adr cnlp check`; commit it on the base
before a run.

Not run live: a base that moves before the merge, a merge conflict, a protected base, Codex absent (fallback), a
dependency chain of 2 ADRs, `adr-auto-plan`, `adr-auto-change`. Their mechanics are covered by the probes of §12 and by
the unit tests of `adr claim`, `adr unclaim` and `adr review`.

### 13.1 Code review (Codex `gpt-6.1-sol` medium, then Fable medium)

Codex reported 6 high findings, so Fable reviewed the change independently. Fixed, each with a test where code:

- `adr review run` starts the CLI without a shell (an npm shim runs as `node <script>`) and kills the whole process
  tree at the timeout: before, the timeout killed `cmd.exe` and `run` waited for the CLI; a `&` in a path split the
  command. `run` removes the result of an earlier run first. The snapshot hashes every tracked and untracked file's
  content, so `assume-unchanged` hides no write. The schema check refuses unexpected keys and empty claims.
- `adr unclaim` pushes to the upstream's own branch (`master` tracking `origin/main`), keeps the branch when the
  release push fails, and refuses a claimed file with other uncommitted changes. `adr claim` runs only on its base.
- The `finalize` and `supersede` guards also check a claim on the ADR's plan; `live apply` has the guard.
- A transition out of `accepted` removes the claim; an accept with a broken `cnlp.config.json` fails before any move.
- `adr-auto-implement`: the skip of a claimed chain comes before the dependency stop; the claim step fetches; a later
  fetch fast-forwards the base; "the base moved" is "the branch does not contain the base tip", so a resume needs no
  memory; a failed merge check drops the unpushed finalize commit before the stop pushes the branch; `run_states:`
  match in order, and `merged` needs the ADR `active` on the base; the baseline is skipped on a resume that starts on
  the ADR branch; a review that wrote stops the run.
- `adr-auto-change`: an uncommitted plan gets its own commit before the claim, so dropping the claim commit keeps
  the plan; an `awaiting merge` state; the same fetch, resume and merge-check fixes.
- `adr-auto-plan`: the orchestrator moves an approved `proposed` ADR to `draft` before `adr-accept`.

Not fixed: a stale warning after a fetch of the base alone can show for another clone's live claim, since staleness
reads local remote-tracking refs (`status` names `adr unclaim`, which the operator runs only after a check).


### 13.2 Code review, round 2 (Codex `gpt-6.1-sol` medium)

5 findings, all confirmed and fixed:

- `adr review` snapshot: a submodule directory made `git hash-object` fail before the files after it, and the exit
  was ignored, so a reviewer's write could pass `end`. The snapshot hashes regular files only and fails on a hashing
  error.
- An accept whose corpus sync throws (`{"corpus":{}}`) rolls the move back instead of leaving the ADR half accepted.
- `adr-auto-implement` release: the fix cycle no longer reuses steps 30 and 31, which tick and commit an archived
  plan; it commits `fix(release): <summary>`, gates on `checks.full` and merges by steps 42 to 46.
- `adr-auto-plan`: the plan checks and the plan round cover only the plans step 25 wrote, so a documentation-only ADR
  passes them.
- `adr-auto-change`: the `tasks` state takes a plan that is neither done nor archived, so a core plan without a
  status resumes.

### 13.3 Live run after round 2 (Claude Code, Reviewer_1 `codex-cli`, `--release`)

The first run reached the gate fix commit and ended on a usage limit. `--resume <adr-file> --release` read the
state `gate`, synced the base, ran the gate (Reviewer_2 and the verify subagent, 0 confirmed), finalized, merged with
`--no-ff`, pushed and deleted the branch, then ran the release review (0 confirmed over `<run-start>...HEAD`) and
`release.command` (exit 0). The 3 `codex-cli` reviews ran through `adr review run` on Windows without a shell. Cost of the
resumed part: 22 turns, 6 minutes, $2.26.

Left over: `cnlp.config.json` uncommitted after `cnlp check`. The fixture's ADR was accepted by the 5.x code, which did
not add the corpus entry at accept; a 6.0.0 accept adds and stages it. A project upgraded with an accepted ADR and no
ADR corpus entry gets it from `ai-factory adr init` or 1 `adr cnlp check` committed before the run.

### 13.4 Code review, round 3 (Fable medium, over the 6.0.0 commits)

1 high, 3 medium, 10 low. Fixed in 6.0.1:

- High: the claim guard of `live apply` refused the fast `.ai-factory/PLAN.md` and a bundle directory. A file without
  `branch:` now passes; a bundle reads its claim on `index.md`.
- Medium: `adr-auto-plan` holds the Authors while a review is open, since any write fails `end`; `adr-auto-change`
  refuses its implementation phase on a work branch without `--resume`; both implementing skills read the base of a
  resume from the claim commit once the claim on the branch is gone.
- Low: the snapshot hashes the symbolic HEAD and the branch and tag refs; `inline` in a fallback runs through
  `--runtime subagent` and `--result`; the CHANGELOG and the `unclaim` help say what the code does.

Not fixed (low): a rejected base push costs a gate round before the next fetch; a protected base that moves keeps a
local claim commit that cannot fast-forward; a `wip` commit of a gate fix resumes at step 20; the `adr-auto-plan`
route for an accepted ADR with a plan and steps 26 and 28 disagree; stale step numbers in §3.2 and §4.7;
`.git/adr-auto/<id>/` is never cleaned.
