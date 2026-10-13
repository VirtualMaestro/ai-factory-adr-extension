# ai-factory-adr-extension

Architecture Decision Record (ADR) lifecycle for [AI Factory](https://github.com/lee-to/ai-factory).

Adds an audited, Git-native ADR workflow to an AI Factory project: 20 skills for
the agent, built around the lifecycle `propose → improve → accept → plan →
implement → finalize` plus `supersede`, with verification, consistency,
automation, `LIVE.md` state and an overview that maps the flow, and a
deterministic `ai-factory adr` command that does the file mechanics (status
moves, reciprocal links, artifact audit).

The source of truth is always the Markdown ADR files in Git. Any external index
is advisory, never authoritative.

## Requirements

- AI Factory `>=2.0.0 <3.0.0`
- Node.js `>=22.14`

## Install

Install into an initialized AI Factory project from npm, a git URL, or a local
path:

```bash
ai-factory init
ai-factory extension add ai-factory-adr-extension        # npm
# ai-factory extension add https://github.com/VirtualMaestro/ai-factory-adr-extension.git
# ai-factory extension add ../ai-factory-adr-extension    # local checkout
```

The extension requires the valid `.ai-factory.json` marker created by
`ai-factory init`; a directory named `.ai-factory/` alone is not sufficient.

This installs the 20 skills into each configured runtime (`.claude/skills/`,
`.codex/skills/`) and registers the `adr` command. Then scaffold the ADR
directories:

```bash
ai-factory adr init
```

`adr init` is idempotent: re-running it reports `present` for what already
exists, `created` for what it added, and overwrites nothing.

If your ADRs live outside `docs/adr`, set `adr.root` **before** running this —
see [Configuration](#configuration).

## Upgrade

The extension is fetched fresh from its source on every add/update — there is no
stale-version caching. To move to a newer release:

```bash
ai-factory extension update ai-factory-adr-extension     # pulls the new version
ai-factory extension update --force                       # refresh even if version is unchanged
```

Updating **preserves** your ADR documents and `.ai-factory/adr-extension.yaml`.
Re-running `add` does not duplicate skills or extension entries.

An update copies the new version over the install directory rather than replacing
it, so a file a newer release no longer ships stays behind. Those leftovers are
inert — the extension resolves every CNL-P document it does not own inside the
bundled `cnlp-kit`, never next to it. `remove` followed by `add` gives a clean
directory if you want one.

To remove the extension:

```bash
ai-factory extension remove ai-factory-adr-extension
```

Removal takes the 20 skills out of each runtime's skills directory and deletes
the extension's own install directory. It leaves everything the extension wrote
while running: your ADR root with all its documents, your plans, and
`.ai-factory/adr-extension.yaml`. Adding the extension again therefore needs no
second `ai-factory adr init`.

### Upgrading from 4.x to 5.0

In 5.0 `LIVE.md` is mandatory. A 4.x project without it fails `ai-factory adr status --check`
after the update, and so does every skill that runs that check. In each project:

```bash
ai-factory extension update ai-factory-adr-extension
```

then run `/adr-live-seed` (Codex: `$adr-live-seed`). Approve the capability list, or send
corrections first, and the seed writes `LIVE.md`, adds `live:` to the ADRs and commits.
`ai-factory adr status --check` then exits 0. A project whose ADRs were never in this
extension's format runs `/adr-migrate` instead: it ends with the same seed.

### Upgrading from 3.x

Every skill lost its `aif-` prefix in 4.0.0 (`aif-adr-propose` is now `adr-propose`), and
`aif-adr-refine` became `adr-improve`. Because an update copies over the install directory,
the sixteen old skill directories stay behind next to the new ones — and unlike a stale
CNL-P document, a stale skill is not inert: the agent still sees it. Take the clean path:

```bash
ai-factory extension remove ai-factory-adr-extension
ai-factory extension add ai-factory-adr-extension
```

If your `AGENTS.md`/`CLAUDE.md` carries the ADR instruction pointer, it still names
`/aif-adr-overview`. Re-run `/adr-migrate` to repoint it, or edit the line by hand.

## Lifecycle

```text
propose ─▶ improve ─▶ accept ─▶ plan ─▶ implement ─▶ finalize ─▶ (active)
proposed    draft     accepted                          active
                                                           │
                                                     supersede ─▶ superseded
```

## Skills

Twenty skills, installed into every runtime the project configures — invoked as
`/adr-propose` in Claude Code and `$adr-propose` in Codex. Start with
**`/adr-overview`**: it maps every stage to its skill and states the
retrieval/immutability rules, so it is the one name worth remembering.

Along the linear flow:

| Skill | Does | Constraint |
|---|---|---|
| `adr-propose <topic>` | scaffolds a `proposed` ADR in `proposals/` | scans for duplicate and conflicting decisions first |
| `adr-improve` | applies ADR-specific quality criteria | first pass moves `proposed` to `draft` |
| `adr-accept` | moves `draft` to `accepted` | checks preconditions and runs the audit first |
| `adr-plan` | creates the plan in `paths.plans` with reciprocal `implements` and `plan:` links | skip for documentation-only ADRs |
| `adr-plan-improve <adr>` | improves that plan, named by the ADR | resolves the plan itself; `adr-improve` is for the decision |
| `adr-implement` | resolves the plan by metadata and implements | the ADR stays `accepted` |
| `adr-finalize` | strict verification, then `accepted` to `active`, and archives the plan | a documentation-only ADR goes straight to `active` with no plan |
| `adr-supersede <old> <new>` | replaces an accepted or active decision with a newer one | reciprocal links and a move to `superseded`, preserving history |

Off the linear flow:

| Skill | Does | Constraint |
|---|---|---|
| `adr-status` | read-only overview and diagnostics, at any point | never mutates |
| `adr-verify <adr>` | checks one accepted or active ADR against the implemented code | read-only, re-runnable: do the `code:` anchors resolve, does the code honor the Decision |
| `adr-verify-all` | the same check swept across every active ADR, as one table | read-only |
| `adr-check-consistency` | checks the accepted and active ADRs against each other, reporting contradiction, redundancy and shared areas | read-only; reads every ADR of each named pair in full |
| `adr-reconcile <target>` | adjudicates a second reviewer's proposed improvements, adopting and rejecting each with a reason | never advances status, never implements |
| `adr-next` | reads the `depends_on` graph and recommends what to implement next | ready means `accepted` with all dependencies `active`; also reports order, blocked ADRs, cycles |
| `adr-migrate` | brings a project's pre-existing legacy ADRs into this lifecycle | one-time; ends with `adr-live-seed`, which stops at once in a project it already seeded |
| `adr-live-seed` | seeds `LIVE.md` with the capabilities the product has today, backfills `live:` on every active and accepted ADR, and commits | once per project with ADRs, such as after an update from 4.x; writes nothing before the operator approves the capability list |

Running a whole phase in one call:

| Skill | Does | Constraint |
|---|---|---|
| `adr-auto-plan <topic or adr> ...` | propose, improve, accept and plan for a batch of ADRs, update the docs, commit and push | stops only for principled questions and the acceptance decision; a rejected draft interrupts it until the operator says how to proceed |
| `adr-auto-implement [adr ...]` | implement, write tests, run the optional acceptance step, verify and review in fresh subagents, fix each finding after a test that fails on it, update the docs, finalize, commit and push | asks nothing and stops on a blocker; 1 commit per ADR on the current branch, with a body line per untested case |
| `adr-auto-change [plan\|implement] <topic or plan>` | plan, improve, implement, test, verify, review, apply LIVE.md, archive and commit a change without an ADR | 1 run for both phases, or 2: `plan` commits the improved plan, `implement` builds it; see [A change without an ADR](#a-change-without-an-adr-adr-auto-change) |

The two phases stay separate on purpose. Planning often covers several ADRs at once, and one
decision can wait on another's answer, so a batch rarely reaches implementation in the same
sitting. `adr-auto-plan` asks only what a `git revert` would not undo — a public API, a data
schema, a module boundary, a protocol, a dependency, a destructive action, or a goal no
research can settle — decides the rest itself and lists those picks in its report. It asks
once, when no ADR in the batch can advance without the operator, and accepting stays the
operator's call: rejecting a draft interrupts the run, which accepts and commits nothing until
the operator says what to change. `adr-auto-implement` asks nothing: a question there means the plan left a
gap, so it stops, leaves the ADR `accepted` and commits nothing for it.

Both end with a table of one row per stage, pass and round, including a row with the reason
for every stage they skipped, so a missing step shows as a missing row. An `improve` or
`plan-improve` sequence is complete only when its last row reads `converged` (a pass that
changed nothing) or it hit its pass limit. Most rows can be checked against something the
agent did not write: `ai-factory adr status` for each status, `git log` for the commit ids,
and `git log -- <adr-file>` for the commit that landed each ADR.

### When an ADR is not the tool

The lifecycle costs what it costs because a decision record binds later work. A change whose
whole rollback is `git revert` — wording in a guide, a README line, a comment — binds nothing
beyond itself, and `adr-propose` now says so and writes no file: its `preconditions:` ask
what the revert would *not* undo (a public API, a data schema, a module boundary, a protocol,
a dependency, an obligation later work is measured against). One decision is one ADR; the
obligations that follow from it are lines of `rules:` inside it, not sibling ADRs. And
refinement ends on a condition, not on taste: a pass that changes no `decision:`, `scope:`,
`constraints:` or `rules:` line is the last one, and the ADR goes to `adr-accept`.

### A change without an ADR: `adr-auto-change`

`adr-auto-change` is the automated path for work that needs no ADR: a feature, a fix or a
refactor whose rollback is a `git revert`. It reads the active ADRs and `LIVE.md` before it
plans, writes no ADR, and changes no ADR's status. Its input is a topic, `@<full-plan>` or
`@<ultra-bundle>`, with an optional mode word before it:

```text
/adr-auto-change add CSV export to the report page            # both phases, 1 run
/adr-auto-change plan add CSV export to the report page       # plan only, then stop
/adr-auto-change implement @.ai-factory/plans/csv-export.md   # build an approved plan
```

The first word counts as a mode only when it is exactly `plan` or `implement`. A topic
that starts with either word needs another word in front of it.

**No mode word: both phases in 1 run, no questions.**

1. **Checks.** The run stops when the working tree has changes outside the plans and QA
   directories, `LIVE.md` is dirty, or the optional acceptance command already fails. It
   also stops on the fast plan (`paths.plan`) or a plan with `implements:`, which belongs to
   `adr-auto-implement`. When the work binds later work, it stops and names `adr-propose`.
2. **Plan.** It writes a full plan by `aif-plan full` rules, or takes the plan you gave it,
   and adds 1 `adr-live` fence: the `LIVE.md` capabilities the change adds, alters or removes.
3. **Improve, in a loop.** It applies `aif-improve` up to 5 times and runs
   `ai-factory adr live apply --dry-run` after each pass. The loop ends at the first pass
   that changes no task. If tasks still change after pass 5, the run stops.
4. **Questions.** A minor question gets the scoped default, and the report lists the pick
   with its reason: an edge case, a task order, a test case, a name. A principled question
   stops the run with its options at any step, because no one is there to answer it. A principled
   question changes what the plan rests on: the architecture, a tool or dependency, a
   public API, a data schema, a module boundary, a protocol, or the goal or scope of the
   request. Approving a destructive action is one too.
5. **Implement and test.** It works through every task, then writes automated tests from
   `aif-qa` test cases and runs the suite and the optional acceptance command.
6. **Verify and review.** Two fresh read-only subagents check the change: one against the
   plan (`aif-verify`), one for bugs and security (`aif-review`). An optional exploratory
   subagent drives the running product. A finding gets a test that fails first, then a fix.
   The run repeats this at most 3 rounds, and stops without a commit if findings remain.
7. **Close.** It updates the docs and project memory, applies the fence to `LIVE.md` once,
   and archives the plan by `aif-archive` rules, with `git mv` for a tracked plan.
8. **Commit.** Code, tests, QA, docs, the archived plan and `LIVE.md` go into 1 commit,
   staged by name, with 1 `Untested:` body line per case no harness can check. It pushes
   unless `git.skip_push_after_commit` is set.

**`plan`: steps 1 to 4, then a commit of the plan.** This mode is for a plan you want to
read before any code is written. It skips the acceptance baseline, since it runs no code. It
asks you each principled question as it comes up, applies your answer and restarts the
improve loop with a fresh limit of 5 passes. Minor questions still get defaults. When the
loop converges, it commits the plan files alone, pushes by the same setting, and stops. A
plan already committed and left unchanged gets no new commit. The run writes no code, tests,
docs or `LIVE.md`.

**`implement`: steps 1 and 2 without the improve loop, then steps 5 to 8.** Its input must
be `@<full-plan>` or `@<ultra-bundle>`: a bare topic stops the run. It runs the checks,
adds the `adr-live` fence when the plan has none, and dry-runs it, then builds the plan as
written. It does not improve the plan and asks nothing. A principled question at any step
stops the run without a commit: answer it in a `plan` run on the same plan, then run
`implement` again. A finding the plan cannot meet also stops it, after at most 3 rounds.
It works on a committed plan from a `plan` run and on an uncommitted one.

With `git.enabled: false` in `.ai-factory/config.yaml`, no mode stages, commits or pushes;
the report says so in its skipped rows.

Each run ends with a table of 1 row per stage, pass and round, a row with the reason for
each skipped stage, and a footer:
`✔ adr-auto-change <plan, implement or full>: <capability-ids> · plan: <stem> · untested: <k> · stopped at: <step or none> · pushed: <branch or no>`.
When the change alters or removes a capability an active ADR still owns, the report names
`adr-auto-plan` as the next step, to supersede that ADR.

### Migrating an existing ADR workflow

Installing into a project that already kept ADRs its own way? Run
**`/adr-migrate`** (Codex: `$adr-migrate`) once. It maps each legacy ADR to a
lifecycle status, rewrites it into the template under the right status directory
(`git mv` preserves history), validates the set with `ai-factory adr status
--check`, and repoints stale ADR instructions in
`AGENTS.md`/`CLAUDE.md`/`CONTRIBUTING.md` to `/adr-overview`.

It creates no branch and commits nothing — it works in the tree you are on and
leaves the result for you to review. That is why it wants a clean working tree
first: a clean tree is what makes `git checkout .` a complete undo. Branch
beforehand if you want the migration isolated.

## `ai-factory adr` subcommands

| Command | Purpose |
|---|---|
| `version` | Print the installed extension version (`ai-factory adr --version` prints the AI Factory CLI version instead) |
| `init` | Scaffold the ADR directory structure and an empty `LIVE.md` (idempotent) |
| `new <topic>` | Scaffold a `proposed` ADR from the template |
| `import <topic> --status <s> [--id <id>]` | Scaffold a conformant ADR skeleton at any status (used by migration) |
| `validate <file>` | Check one ADR against the lifecycle invariants |
| `verify-anchors <file>` | Check that an ADR's `code:` anchors resolve on disk (non-zero exit if any are missing) |
| `transition <file> <status>` | Atomic move between non-terminal lifecycle states, staged in Git as a rename |
| `link-plan <adr> <plan>` | Write reciprocal ADR↔plan links |
| `resolve-plan <adr>` | Resolve the plan(s) implementing an ADR |
| `finalize <file>` | Activate an ADR; archive its plan (both staged as renames) |
| `supersede <old> <new>` | Replace an ADR, preserving history |
| `status [file]` | Overview / diagnostics; JSON detail includes `replacedBy`; `--check` exits non-zero on blocking errors (CI) |
| `order` | Dependency-ordered plan: what is ready to implement next, the topological order, blocked ADRs, and cycles (non-zero exit on a cycle) |
| `decisions` | What every accepted and active ADR obliges — `decision:`, `constraints:`, `scope:`, `rules:` — so a new decision can be written against the whole corpus; reports per-file `issues` and always exits 0 |
| `format [name]` | Print the CNL-P standard or a profile; `--path` prints its location; `format plan --check <file>` checks a plan body and fails on any issue |
| `live` | Print `LIVE.md`, what the product does now |
| `live init` | Create `LIVE.md` and list the accepted ADRs that still need a `live:` delta |
| `live apply <file> [--dry-run]` | Apply an active ADR or a full, ultra or fast plan delta; `--dry-run` previews any ADR status or plan without writing |
| `live apply --pending` | Apply every reported unapplied delta in completion order; keep successes, list failures and exit 1 if any failed |
| `live check` | Broken, ambiguous and stale refs in `LIVE.md`, and every delta that never reached it; exits 0 on issues, 1 without `LIVE.md` |

The lifecycle skills wrap these commands — prefer the skills for authoring work
and reserve raw commands for scripting and CI.

`active` and `superseded` are managed states: use `finalize` and `supersede`
rather than `transition`. Returning `accepted → draft` is rejected while a
non-archived plan still implements the ADR.

A documentation-only ADR must declare `evidence: documentation-only` in its
frontmatter; matching prose in the body does not bypass planning.

The machine state of an ADR lives in frontmatter: `plan:` names the linked plan
(empty = no plan yet), `evidence:` holds a short implementation-evidence string
(empty = not implemented), and `replaced_by:` names the superseding ADR id.
The body stays pure decision content.

### `LIVE.md` — what the product does now

`LIVE.md` is part of the flow, not an option: every project with this extension keeps
it. It lives at `.ai-factory/LIVE.md` (or the path in `adr.live` of
`.ai-factory/adr-extension.yaml`) and holds 1 record per capability the product has
today: a 1–2 sentence summary, and refs to the ADRs, plans or files that describe it.
A record names every active ADR that shapes the capability; other refs stop at 3.
Agents read it before they plan, so they start from what the product does now.

- **A new project:** `ai-factory adr init` creates an empty `LIVE.md`, and each
  finalize and each completed plan fills it.
- **A project that already has ADRs**, such as one updated from 4.x: run
  `/adr-live-seed` (Codex: `$adr-live-seed`) once. It reads every ADR, the archived plans
  and the code, then shows you the list of capabilities it would write, with the ADRs each
  one rests on. It stops there. Reply with corrections, or approve. Then it writes
  `LIVE.md`, adds `live:` to every active and accepted ADR, and commits both in 1 commit.
  An accepted ADR is not in `LIVE.md` yet: its finalize adds it.

Without the file, `ai-factory adr status --check` fails and names `adr-live-seed`, and so
does every skill that runs it. It fails the same way on an active ADR that has no `live:`,
which marks a project the seed has not reached, even after a partial start: the seed keeps
the records `LIVE.md` already holds and fills in the rest. `transition … accepted`,
`finalize`, `supersede` and `live check` refuse without the file. `live apply` only
skips: the `aif-implement` injection runs it in every project.

Each ADR states its delta up front, in frontmatter:

```yaml
live:
  changes:
    - capability: plan-archive-on-finalize
      change: added            # added | modified | removed
      summary: "Finalizing an ADR archives its plan in the same atomic step, with rollback on failure."
```

or `live: { none: "<reason>" }` for a decision that only constrains how code is
written. `transition … accepted` and `finalize` refuse an ADR without one. `finalize` applies the delta inside its rollback, checks the
result against the `live` profile before writing, and stages `LIVE.md`, so the
entry lands in the same commit as the code. `supersede` rewrites refs to the old
ADR once its replacement is active.

Plans without an ADR carry the same mapping in an `adr-live` fence after the title.
The extension injects instructions into `aif-plan`, `aif-improve` and `aif-implement`
to write, preserve and apply it when every task is complete, before plan cleanup.
Full and ultra plans use their filename or bundle stem as ref, which survives
archiving. Fast plans require durable `refs:` on every change because PLAN.md may
be deleted. A plan with `implements:` carries no fence and skips apply.
Core `aif-plan` and `aif-improve` do not pre-approve `ai-factory` commands in
Claude Code: an interactive run asks for them, and a headless `claude -p` run
needs `--allowedTools "Bash(ai-factory *)"`. `aif-implement` already grants `Bash`.

A plan may remove a capability established by an active ADR. Apply warns and writes
`contradicts:` into its fence; `live check` reports `contradicts-active-adr` and
`decisions` reports `contradicted-by-plan` until the ADR is superseded. Review this
debt rather than restoring behavior the completed plan removed.

`adr live apply --pending` applies the reported pending deltas in completion order.
Successful applies stay written and staged even when another source fails; correct
the listed failures and rerun. It exits 1 if any failed.

Apply, finalize and supersede hold `LIVE.md.lock` next to `LIVE.md` while they write
it. A second writer fails at once and changes nothing; rerun it when the first one ends.
Delete a lock left by a killed process only when no `ai-factory adr` command is running.
When git ignores `LIVE.md` or the plan, the CLI still writes them and warns that no
commit carries them.

### `code` source anchors

Each ADR carries an optional `code: []` frontmatter array — the primary
entry-point files/symbols the decision lives in (repo-root paths, POSIX `/`,
optional `#symbol` suffix, e.g. `src/status.js#validateDirStatus`). `finalize`
populates it at activation, `migrate` backfills it on import, and `validate`
warns when an `active` non-documentation-only ADR has no anchors. `verify-anchors` (and the
`adr-verify` skill wrapping it) checks that the listed anchors actually resolve on disk,
catching drift when code is moved or deleted. The reverse
question — "which decisions govern this file?" — is a plain grep over `code:`
in the ADR root; no index or external tooling involved.

## The ADR body format (CNL-P)

ADR bodies are written in CNL-P — a controlled form of English with a fixed set
of blocks, one idea per line, and no prose paragraphs. `ai-factory adr validate`
holds a body to the `adr` profile: a **warning** while the ADR is `proposed`,
`draft` or `superseded`, an **error** once it is `accepted` or `active`, because
that is where the document becomes a rule other work is measured against.

The standard and the profiles ship inside the extension as its
[`cnlp-kit`](https://www.npmjs.com/package/cnlp-kit) dependency. Read them by
command, never by path — the files live under
`.ai-factory/extensions/` and that location is not part of the contract:

```bash
ai-factory adr format          # the standard itself
ai-factory adr format adr      # the profile an ADR body is held to
ai-factory adr format plan     # the profile of new ADR implementation plans
ai-factory adr format plan --check .ai-factory/plans/example.md
ai-factory adr format --path   # where it resolved, if you want to open it
```

**There is nothing to initialize.** `ai-factory adr init` is the only setup a
project needs, and it survives `extension remove` — reinstalling does not call
for a second run. CNL-P adds no project-level files: no `cnlp init`, no
`cnlp.config.json`, no `cnlp/profiles/`, no `cnlp-*` skills. Those belong to a
repository that checks its own documents with the `cnlp` CLI; here the checker is
embedded in `adr validate`, which the CLI cannot replace because it alone knows
an ADR's lifecycle status.

The extension takes `adr` from the package as-is and owns `skill`, `live` and
`plan`. New ADR implementation plans carry `format: cnlp-plan`; the plan
profile retains core checkbox tasks and adds files, acceptance criteria and
verification per task. Every format issue fails the explicit check, regardless
of task progress. Existing unmarked plans keep their format and lifecycle behavior.

## Configuration

The ADR root defaults to `docs/adr` and can be changed in
`.ai-factory/adr-extension.yaml`:

```yaml
adr:
  root: docs/decisions
```

**Set the root before `ai-factory adr init`.** `init` scaffolds the lifecycle
directories into whatever `adr.root` resolves to. If you keep ADRs elsewhere and
run `init` first, the empty lifecycle dirs land under `docs/adr` while your
existing ADRs stay outside the lifecycle. `init` never deletes or overwrites, so
nothing is lost — but changing the root afterwards means re-running `init` and
relocating the dirs it already created. Create the config file (or run `init`
once to generate it), set `adr.root`, then run `init`.

Commands and `adr status --check` resolve this setting automatically, including
when the root is outside AI Factory's default audit paths.

Optional code-intelligence is an agent workflow, rather than an MCP client in
the CLI. Enable the read-only `codebase-memory-mcp` adapter with an existing
indexed project id:

```yaml
adr:
  codeIntelligence:
    provider: codebase-memory-mcp
    project: my-indexed-project
```

`adr-overview` defines the shared `code_intelligence` contract used by authoring,
planning, verification and replacement skills. The default `none` makes no graph
calls. Unavailable tools, stale results, a missing project id or an unsupported
provider fall back to the existing source-file checks with a reported reason.
Only one provider may be selected. The adapter checks graph evidence against
current files and does not index, write graph ADRs, approve decisions or change
lifecycle gates. `codegraph` is reserved for a later adapter.

**The acceptance step of `adr-auto-implement` and `adr-auto-change` is optional.** Without the block
below, the run skips it and says so in its report:

```yaml
adr:
  acceptance:
    command: npm run test:browser:mock       # baseline, then every review round
    exploratory:
      instructions: docs/testing/exploratory-acceptance.md
      rounds: 1                              # exploratory rounds per ADR or change
```

- `command` is a deterministic project command, such as a browser suite against
  mock executors. A baseline failure stops the run, because the run
  did not cause it. A failure in a round is a failing test of that round.
- `exploratory` starts a fresh agent that drives the running product through the
  ADR's or plan's scenarios, in the first round where the tests and `command` pass. An
  anomaly it reports becomes a finding only when a test reproduces it.
- The instructions file tells the agent how to start, check and stop the app,
  which tools to use, and what it must not touch or pay for. The run stops when
  the file is missing. A skeleton:

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

Write every output of `command` and of the agent to a path git ignores. The
first check of the next run stops on any change outside the ADR root, the plans
directory and the QA directory, so a stray `playwright-report/` blocks it.

## Current scope

Markdown ADRs in Git are the only source of truth. Decision recall needs no
external service: structured frontmatter, `adr status`, and grep cover it. The
optional Cognee memory integration was evaluated and dropped (the
`adr.memory.provider` config axis stays reserved); optional code-intelligence
is an agent contract with a read-only `codebase-memory-mcp` adapter, and
`codegraph` stays reserved. No runtime code
depends on any MCP server — installs without one lose nothing and cannot fail
because of it.

## Documentation

- [Implementation backlog](./docs/BACKLOG.md)
- [Changelog](./CHANGELOG.md)
- The CNL-P standard — run `ai-factory adr format` (it ships inside the
  extension, so there is no path to link)

## License

MIT — see [LICENSE](./LICENSE).
