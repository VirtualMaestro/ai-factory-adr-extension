# Proposal — `LIVE.md`, the current state of the project, merged when a change is done

Written 2026-10-09 and revised 4 times the same day. The revisions followed 3 independent reviews against the code,
the AI Factory core skills and the CNL-P checker, the operator's decisions, and live probes in Codex and Claude Code
(§9, §10).
This is a proposal, not a governed artifact. It is prose and deliberately not CNL-P.

**Status: ready for implementation.** Every decision is settled: with evidence (§5.1) or by the operator (§5.2, §5.3 B).
One default awaits the operator's confirmation (§5.3 A). Nothing below is implemented.

---

## 0. Summary

The lifecycle `propose → improve → accept → plan → implement → finalize` has no step that merges the outcome into a
description of what the project is now. Finalize moves the ADR to `active/` and archives the plan, and the result goes
nowhere. Work done without an ADR (a plain `aif-plan`) leaves even less behind.

The proposal adds one short file, `LIVE.md`: a table of contents of the product's capabilities, 1–2 sentences each,
with links to the documents that describe the current behaviour. It holds no history.

The mechanism:

1. **The delta is written up front, in the source document.** It says which capability the change adds, modifies or
   removes, with the summary line.
   - An ADR carries it in frontmatter.
   - A plan carries it in a fenced block, because AI Factory plans have no frontmatter (§3.2).
   - It is checked from acceptance on, before any code is written.
2. **The CLI applies the delta once, mechanically, when the change is done.**
   - For an ADR that is `adr finalize`, inside its existing rollback.
   - For a plan without an ADR that is the end of `aif-implement`, through an injected `ai-factory adr live apply`.
   - The CLI validates the resulting file against its CNL-P profile before writing, and stages it. The entry lands in
     the same commit as the code.
3. **A check catches what the mechanism misses.** `adr live check` reports broken, ambiguous and stale refs, and every
   delta that was never applied. `adr live apply --pending` applies the missed ones.

---

## 1. Problem

| Document | Answers | Why it fails as the current state |
|---|---|---|
| ADR | why it was decided | 1 decision per file, immutable once active; the product's behaviour is spread across every active ADR; work done without an ADR is absent |
| AIF plan | how to do a task | archived after finalize: history |
| `ROADMAP.md` | what happened, what next | turned into a diary with measurements |
| `AGENTS.md` | where things are in the code | its "ADR Implementation Order" section grew into a narrative state log, a role the code map does not own |
| `DESCRIPTION.md` | what the project is | meant to be live, but no lifecycle step forces an update, so it went stale |

What already exists and covers part of it:

- `ai-factory adr decisions` (`src/decisions.js`) derives a digest of what every accepted and active ADR obliges. It
  never drifts, because it is computed. It lists obligations, not capabilities, and it sees no plan without an ADR.
- `adr-auto-implement` step 29 and `adr-auto-plan` step 19 update `DESCRIPTION.md`, `ARCHITECTURE.md` and `AGENTS.md`
  with "fix what is now wrong" semantics. Only the auto flows do it; the manual `adr-finalize` does not.

---

## 2. Document roles after the change

| Document | Role | Who keeps it current |
|---|---|---|
| `LIVE.md` | what the product does now: capabilities, 1–2 sentences, refs | the CLI, when a change is done |
| `adr decisions` | what the project is obliged to | computed on read |
| active ADRs | why each obligation exists | immutable; superseded by a new ADR |
| archived plans | how a change was made | history |
| `DESCRIPTION.md` | purpose and stack, rarely changes | `aif-docs` |
| `AGENTS.md` | the code map only | `aif-docs`; the state narrative moves out (phase 2) |
| `ROADMAP.md` | the future only | `aif-roadmap`; trim the diary with `aif-archive --roadmap` |

---

## 3. Model

### 3.1 Terms

- **Capability.** The unit of `LIVE.md`: a stable kebab-case id, such as `plan-archive-on-finalize`. One ADR can touch
  several capabilities, and several ADRs and plans can build one.
- **Entry.** One capability in `LIVE.md`: `id`, `summary`, `refs`.
- **Ref.** An ADR id, a plan stem (the full-plan filename without `.md`, or the ultra bundle directory name), or a
  repository path. Resolution is by lookup, not by shape (§3.5).
- **Delta.** What one source document changes. One YAML mapping, the same shape in both carriers:

```yaml
changes:
  - capability: plan-archive-on-finalize
    change: added            # added | modified | removed
    summary: "Finalizing an ADR archives its plan in the same atomic step, with rollback on failure."
    refs: src/lifecycle/finalize.js   # optional; required only in a fast plan
applied: 2026-10-09        # written by the CLI, never by hand
```

  or the opt-out, with its reason:

```yaml
none: "a constraint on how code is written, covered by `adr decisions`"
```

Rules of the shape:

- `changes` and `none` are mutually exclusive. A delta with neither is malformed.
- A `none:` delta is complete as written: it never gets `applied:`, and `unapplied-delta` ignores it.
- A key with no value (`live:` as in the template) parses to `null`, as `plan:` and `issue:` do today. `readDelta`
  treats `null` as absent, not as malformed.
- **Summaries are double-quoted.** Verified: an unquoted summary that contains `: ` fails `YAML.parse` ("Nested
  mappings are not allowed in compact mappings"). In an ADR that makes `read()` throw for every `adr` command on the
  file (`src/artifacts/frontmatter.js:16-20`).
- A summary follows the CNL-P lexicon, because `LIVE.md` is checked against it (§4.3).
  - Verified: `ensures` and `faster` fail the check.
  - A non-English summary passes the English-only lexicon unchecked.
- Keys stay in English. The summary is written in `language.artifacts`. Verified in both runtimes with
  `artifacts: ru` (§9).

### 3.2 Carriers

| Source | Carrier | Why |
|---|---|---|
| ADR | frontmatter key `live:` holding the mapping | verified in a scratch project: an ADR with a nested `live:` passes `adr validate`, `adr status`, `adr decisions` and core `audit-artifacts`, and `frontmatter.js` reads it as an object. The CNL-P checker strips frontmatter (`cnlp-kit/src/cnlp.js:36-39`) |
| Full plan, ultra `index.md`, fast `PLAN.md` | 1 fenced block with info string `adr-live`, right after the plan's `#` title | full plans are written without frontmatter (`aif-plan/references/TASK-FORMAT.md`), and `aif-archive` adds it only at archive time; ultra `index.md` must never carry YAML (`aif-archive/SKILL.md:264-273`); with a Handoff task the first line is reserved (`aif-plan/SKILL.md:49`). A fence is legal in all of them, and CNL-P treats a fence as opaque data. Verified: `aif-archive` keeps the fence intact for both plan kinds (§9) |
| Plan linked to an ADR (`implements:`) | none | the ADR carries the delta; a second one would apply twice |

The parser takes the first ```` ```adr-live ```` fence in the entrypoint and fails on a second one. The CLI writes
`applied:` into the same carrier it read.

### 3.3 Events

| Event | Trigger | Effect on `LIVE.md` |
|---|---|---|
| ADR finalized, documentation-only or not | `adr finalize` (inside `adr-finalize` step 10 and `adr-auto-implement` step 31) | apply the ADR's delta; ref = the ADR id |
| ADR superseded by an ADR that is already active | `adr supersede <old> <new>` | rewrite refs to the old id (§3.4) |
| ADR superseded by an ADR not yet finalized | `adr supersede` | nothing: the old code runs until the successor is implemented, so the ref to the old ADR stays correct |
| Plan without an ADR completed | end of `aif-implement`, injected `ai-factory adr live apply <entrypoint>` | apply the plan's delta; ref = the plan stem |
| Fast plan completed | the same, before `aif-implement` offers to delete `PLAN.md` | apply; refs come from each record's `refs:`, because `PLAN.md` is deleted or overwritten by the next fast plan |
| Plan archived | `aif-archive` | nothing: the plan-stem ref resolves in the archive too |
| Plan linked to an ADR completed or archived | `adr-implement`, `adr finalize`, `adr supersede --archive-plan` | nothing: `adr live apply` exits 0 with `skipped: linked to <adr-id>` |
| Capability removed | an ADR or plan whose delta says `removed` | delete the entry, subject to the active-ADR guard (§3.4). No `deprecated` status is added |
| ADR imported as `active` | `adr import --status active` (`adr-migrate`) | nothing at import; `missing-delta` flags it, and `adr live apply <adr>` applies it once a delta is written |
| Bug fix | `aif-fix` (no plan), or a plan whose delta is `none:` | nothing |
| One-shot change | `aif-implement` inline mode (no plan file) | nothing: no carrier exists. Known hole (§7) |

**Why at implement completion and not at archive.**

- Archiving is optional in AI Factory. `aif-implement` keeps a finished full plan in place ("Keep it — documents what
  was done"), so a plan that is never archived would never reach `LIVE.md`.
- `aif-archive` grants itself only `Bash(mv *) Bash(mkdir *) Bash(git *)` (`aif-archive/SKILL.md:5`).
  - Claude Code's `allowed-tools` only pre-approves and does not restrict, so `ai-factory` would prompt in default
    mode and be denied in a `claude -p` run (code.claude.com/docs/en/skills, /permissions, /headless).
  - `aif-implement` grants `Bash`.
- The product changes when the code lands, not when the plan file moves.

### 3.4 Apply semantics

Per change:

- `added`: the id must not exist; otherwise the apply fails and names `modified` as the fix.
- `modified`: the id must exist. The summary is replaced, and the source ref is appended to `refs` unless already there.
- `removed`: the id must exist. The entry is deleted.
- A rename is a `removed` plus an `added`; the author carries the refs over.

**Active-ADR guard** (§5.3 A). A plan without an ADR must not undo what an active decision established: PRD §18.3, as
stated in `skills/adr-overview/SKILL.md:69-70` and `skills/adr-supersede/SKILL.md:32`. The guard applies to **plan
sources only**.

- A `removed` from a plan on an entry whose refs include an active ADR is refused. The error names the ADR, with
  `next: adr-propose, then adr-supersede`.
- A `modified` from a plan on such an entry is applied with a warning naming the ADR.
- An ADR source is exempt. A conflict between 2 ADRs belongs to `adr decisions`, `adr-check-consistency` and
  `adr-supersede`, not to `LIVE.md`. With the guard on ADRs too, a successor finalized before `adr supersede` ran would
  have its `removed` refused, because its `supersedes:` is still empty at that point (`src/artifacts/links.js:46`).

**Superseded refs.** Both legal orders of `adr-supersede` are covered (`src/lifecycle/supersede.js:10,27` accepts a
replacement that is `accepted` or `active`):

- **Supersede first, finalize later.** Applying an ADR with a non-empty `supersedes:` rewrites refs. That covers
  `finalize`, a standalone `adr live apply` and `--pending`. Every entry that refs a superseded id and that the delta
  does not name gets that id replaced by the new one, with a warning naming those entries.
- **Finalize first, supersede later.** At finalize, `supersedes:` is still empty (`supersedeLink` writes it later,
  `src/artifacts/links.js:46`). So `adr supersede` performs the same rewrite when the new ADR is `active`, inside its
  own `withFileRollback`, and stages `LIVE.md`. Whether the new ADR is applied does not matter: an imported active ADR
  or a `none:` delta still gets the rewrite.
- The rewrite deduplicates: an entry that already refs the new id loses the old one and gains no second copy.

`--dry-run` shows the rewrite and the guard before finalize, so `adr-finalize` corrects the delta instead of the
result. `adr supersede` has no `--dry-run` (`commands/adr.js:146-158`): its rewrite is reported afterwards, not
previewed.

**Validation first.**

- The whole delta is parsed, checked against `LIVE.md`, and the resulting file is rendered and checked with
  `bodyIssues` against the `live` profile.
- `bodyIssues` covers the record keys, the `- none:` rules, the 250-character line limit and the lexicon.
- Any failure reports the line to rewrite and `files: nothing was changed`, in the house error shape.

**Idempotency.** A source whose delta already has `applied:` is refused with `already applied on <date>`, exit 1.
`--pending` skips it silently.

**Rendering.**

- `renderLive` rewrites from the `capabilities:` key to the end of the file, sorted by id.
- It keeps the frontmatter and every line before `capabilities:` byte for byte.
- A flat CNL-P body has no heading after which prose could stand (`cnlp-format.md:49-54`), so prose after the records
  would be a stray record: it is not allowed.

**Empty state.** CNL-P rejects a key with no items. `capabilities:` is required, so an empty file holds
`- none: no capability recorded yet`. Verified with the checker: the sentinel passes alone and is rejected next to a
record. The first `added` replaces it, and the last `removed` restores it.

**In `finalize`**, in this order:

1. Refuse when `LIVE.md` exists and `live:` is absent (D5). Then parse and validate the delta and the rendered
   `LIVE.md`. Nothing is written before this step passes.
2. Add `LIVE.md` to the `withFileRollback` list. `src/util/safe-path.js:39-66` restores absent files too. Rollback is
   by list membership, so every file on the list is restored whatever step fails.
3. Write the ADR before the move when `evidenceChanged` or the delta is a `changes:` delta. Today the pre-move write at
   `finalize.js:48` runs only when `evidenceChanged`. That is false for a documentation-only ADR and for authored
   `evidence:`, which `adr-finalize` step 5 always writes. `transition` re-reads the file from disk
   (`src/lifecycle/move.js:46`), so `live.applied` must be on disk before it. This is the only real ordering
   constraint.
4. `transition`, then `archivePlan`, then write `LIVE.md`, then `stageMove(livePath)`. That helper is a plain
   `git add` (`src/util/git.js`). An archive collision (`src/lifecycle/archive.js:27-33`) is the rollback test.

On a failure, the rollback runs `git add` on every restored file (`safe-path.js:63`), so an operator's unstaged edit
to `LIVE.md` ends up staged. The ADR file already behaves this way today.

**On a plan, and on a standalone `adr live apply <adr>`:** write `applied:` into the carrier and write `LIVE.md`, then
`stageMove` both.

### 3.5 Ref resolution

Lookup, in this order, and every hit is counted:

1. an ADR with that id in any status directory;
2. a plan stem: `<paths.plans>/<stem>.md`, `<paths.plans>/<stem>/index.md`, and the same 2 under the archive;
3. a repository path, after normalising: `\` becomes `/`, a leading `./` is dropped, and the path must pass
   `resolveInside`.

- 0 hits → `broken-ref`. More than 1 → `ambiguous-ref`.
- `resolveInside` throws on a path outside the project (`src/util/safe-path.js:13-20`). The resolver maps that to
  `broken-ref` and does not crash.
- A trailing `/` is dropped.
- A path hit must match the case of the name on disk, compared with `readdir`. Otherwise `existsSync` succeeds on
  Windows and the ref breaks on Linux CI.
- Shape alone is not enough, as the audit showed:
  - a branch named `adr-foo` gives the plan stem `adr-foo`, which matches `ID_RE` (`src/artifacts/id.js:4`);
  - a stem such as `v1.2-api` looks like a file name;
  - a reused branch slug can put an unfinished plan and an archived plan under one stem.
- Refs are written in POSIX form, 1 line, separated by `, `. A path that contains `, ` cannot be a ref.

### 3.6 Opt-in, configuration and the early gate

- A project opts in by having the file. When it is absent:
  - `finalize`, `transition` and `supersede` skip `LIVE.md` silently;
  - `adr live apply` exits 0 with `skipped: no LIVE.md`, the same shape as the linked-plan skip, so the `aif-implement`
    injection never fails in a project that did not opt in.

  Existing projects keep working.
- **The gate is in the CLI, at the 2 transitions that matter** (D5), when `LIVE.md` exists:
  - `adr transition <file> accepted` refuses an ADR with an absent or malformed `live:`, in the house error shape with
    `next: write live: or none:, see adr-improve`. `adr-accept` reaches that command at step 6
    (`skills/adr-accept/SKILL.md:55`), before any plan or code exists;
  - `adr finalize` refuses the same. Today it never calls `validateAdr` (`src/lifecycle/finalize.js:16-53`), so
    finalize step 1 checks it itself (§3.4).
- **`validateAdr` reports a missing `live:` only for an ADR in `accepted`,** as an error, and as a warning while it is
  `proposed` or `draft`. **Not for `active`.** The overview `adr status --check`, which every skill runs
  (`adr-accept:51`, `adr-plan:75`, `adr-implement:47`, `adr-finalize:61`, `adr-supersede:44` and others), counts the
  `validateAdr` errors of every ADR (`src/status.js:70-71`). An error on `active` would turn every existing project red
  from `adr live init` until phase 2's backfill. An active ADR without `live:` is the `missing-delta` check code
  (§3.7), never a status error.
- The path comes from `.ai-factory/adr-extension.yaml`, `adr.live`, default `.ai-factory/LIVE.md`.
  - The default lives in code, as `liveFile(projectDir)` in `src/config/paths.js` next to `adrRoot`. `ensureConfig`
    never rewrites an existing config (`src/config/adrConfig.js:27-32`).
  - It is not written into AI Factory's `config.yaml` (§26, `src/config/paths.js:25-27`).
- `readAifPaths` gains `plan` (`paths.plan`, default `.ai-factory/PLAN.md`), so `apply` can recognise a fast plan.

### 3.7 Commands

All are subcommands of `adr`, so `extension.json` keeps 1 command (`test/extension-manifest.test.js:20`).

| Command | Does | Exit |
|---|---|---|
| `adr live` | prints `LIVE.md` | 0; 1 with `run adr live init` when absent |
| `adr live init` | creates the file with `title`, `since: <today>` and the `- none:` line | 1 if it exists |
| `adr live apply <file> [--dry-run]` | applies an ADR (finalize does this for you; standalone only for an active ADR without `applied:`), a plan entrypoint, a bundle directory or a plan file anywhere (`aif-implement` accepts `@plan-file` anywhere; outside the plan directories the ref is the repository path). `--dry-run` works on an ADR of any status and on any plan, prints the effect, the warnings and the guard, and writes nothing | 1 on error; 0 with `skipped: …` when `LIVE.md` is absent, the plan is linked to an ADR, or the source is a `none:` delta |
| `adr live apply --pending` | applies every source that `unapplied-delta` reports | 1 if any failed; 0 with `skipped: no LIVE.md` when absent |
| `adr live check [--json]` | the coded issues below | always 0, like `adr decisions` |

`--pending` order:

- by the date of the last commit that touched the source (`git log -1 --format=%cI -- <file>`), falling back to the
  file's mtime. For a file that moved (an archived plan, an activated ADR), that is the date of the move commit,
  which is the moment the change was done;
- `added` before `modified` before `removed` only between sources with the same date. Otherwise date order wins, so a
  remove-then-re-add across 2 sources applies correctly;
- 2 pending `added` on 1 id both fail, named;
- it continues past a failure and lists every failure. The applies that succeeded stay written and staged, so the
  result is partial; run `--pending` again after fixing. Exit 1 if there was any failure.

`adr live check` codes:

| Code | Meaning | Scope |
|---|---|---|
| `live-format` | `LIVE.md` fails the CNL-P check against the `live` profile | the file |
| `broken-ref` | a ref resolves to nothing | every ref |
| `ambiguous-ref` | a ref resolves to more than 1 thing | every ref |
| `stale-superseded-ref` | a ref names a superseded ADR whose `replaced_by` chain reaches an `active` ADR | ADR refs |
| `ref-to-unfinished` | a ref names a `proposed`, `draft` or `accepted` ADR, or a plan with an open `- [ ]` task | ADR and plan refs |
| `no-refs` | an entry has no ref | every entry except the `- none:` sentinel |
| `ref-creep` | an entry has more than 3 refs | every entry |
| `summary-too-long` | a summary has more than 2 sentences | every entry except the sentinel |
| `missing-delta` | no `live:` | every active ADR |
| `missing-delta` | no `adr-live` fence | plans without `implements:`: archived on or after `since:` (full plan: frontmatter `archived:`; ultra: `<!-- aif:archived:DATE -->`), and completed plans still in `paths.plans` (no `- [ ]` in the entrypoint; ultra keeps progress only in `index.md`, `ULTRA-FORMAT.md:31`) |
| `unapplied-delta` | a `changes:` delta without `applied:` | active ADRs, and completed or archived plans without `implements:` |
| `delta-on-linked-plan` | a plan with `implements:` carries an `adr-live` fence | plans |

`adr-status` shows the counts. `adr-finalize`, `adr-supersede`, `adr-auto-implement` and `adr-auto-change` run the
check after their mutation and report it.

---

## 4. Formats

### 4.1 ADR

```yaml
---
id: adr-plan-archive-on-finalize
type: adr
status: accepted
# ...existing fields...
live:
  changes:
    - capability: plan-archive-on-finalize
      change: added
      summary: "Finalizing an ADR archives its plan in the same atomic step, with rollback on failure."
---
```

`templates/adr.md` gains an empty `live:` key.

### 4.2 Plan

````markdown
# Implementation Plan: Drill-down panels

```adr-live
changes:
  - capability: workspace-drill-down
    change: added
    summary: "Any workspace item opens a drill-down panel with its details, without leaving the canvas."
```

Branch: feature/drill-down
Created: 2026-10-09
````

For an ultra bundle, the fence goes in `index.md`, after the title, which follows the ultra marker. Verified: the
marker stays on line 1, and `aif-archive` inserts `<!-- aif:archived:DATE -->` after it, leaving the fence alone (§9).

### 4.3 `LIVE.md` and its profile

```markdown
---
type: live
title: Live state
since: 2026-10-09
---

capabilities:
- id: plan-archive-on-finalize
  summary: Finalizing an ADR archives its plan in the same atomic step, with rollback on failure.
  refs: adr-plan-archive-on-finalize
- id: workspace-drill-down
  summary: Any workspace item opens a drill-down panel with its details, without leaving the canvas.
  refs: 0014_workspace-drill-down
```

- The body is flat. A profile with `headings: none` keeps its title in the frontmatter (`cnlp-format.md:51-54`), so
  `LIVE.md` has no `#` heading.
- `capabilities:` is a record-list. CNL-P nests 1 level only, so `refs` is 1 scalar line, never sub-bullets.
- Records are sorted by id, so 2 branches conflict on 1 record, not on the file.
- The profile `profiles/live.md` was drafted and checked in a scratch run:
  - it passes `bodyIssues` against `profile`;
  - the example above passes against it;
  - the sentinel-only file passes;
  - a sentinel next to a record, an unknown record key, a missing `refs:` and the words `ensures`/`faster` are each
    rejected.

  Its blocks:

```text
mood: declarative
headings: - none: LIVE.md is 1 flat block, and the file name carries the title
frontmatter_fields: type, title, since
sections: capabilities — record-list, required, record_keys: id, summary, refs
custom_sections: - none: a block that is not listed above is history looking for a home
enforcement: `ai-factory adr live check`
```

---

## 5. Decisions

### 5.1 Settled, with the evidence

- **D1. Carrier.** ADR frontmatter, plan fence, 1 mapping shape (§3.1–3.2).
- **D3. Applied state, not a computed projection.**
  - An ADR has no activation date, so replay order is ambiguous.
  - A replay needs every archived plan structured forever.
  - An apply in the same commit makes `git revert` of a feature revert its entry.

  `adr live check` is the remaining form of the projection.
- **D4. Refs.** `modified` appends; superseded refs are rewritten in both supersede orders (§3.4); the check warns past
  3 refs and on 0.
- **D7. Plans reach the mechanism through injections, not wrapper skills.** Wrapper skills lose the delta the first
  time someone runs `aif-plan` directly.
  - `ai-factory update` re-applies injections (`dist/cli/commands/update.js:344-353`), and `extension remove` strips
    them; both were verified in a probe (§9).
  - Targets: `aif-plan` (write the fence, and keep it on a rewrite), `aif-improve` (keep the fence, and update it when
    the refinement changes what the product does), `aif-implement` (apply at completion). There is no `aif-archive`
    injection (§3.3).
  - `aif-improve` preserves only a named list of sections (`aif-improve/SKILL.md:459-488`), and the fence is not on
    it. Both runtimes kept and even updated the fence without an injection (§9), but in a single run each; the
    injection makes it a rule.
  - Safety net: `unapplied-delta` plus `adr live apply --pending`.
- **Gate placement.** In the CLI, at `adr transition … accepted` and at `adr finalize` (§3.6), so a run never reaches
  implementation with no delta.
  - Revision 4 placed the gate in `validateAdr` from `accepted` on. The third review showed 2 problems with that:
    - `adr-accept` runs its `--check` while the ADR is still `draft`, so that gate would not fire at acceptance;
    - the overview `--check` would turn red for every active ADR.
  - A finalize-only gate would fire after implementation, and the run would stop with nothing committed.
- **Q2 → no rename.** A rename is `removed` plus `added`.
- **Q4 → yes.** `live:` on an active ADR is a non-material change under PRD §18.3, like `evidence:`.
- **Q5 → forbidden.** A plan with `implements:` carries no delta. `adr-plan` applies `aif-plan full` semantics from the
  installed skill (`skills/adr-plan/SKILL.md:28,71`), so it reads the injected text; the injection and `adr-plan` both
  say so, and `delta-on-linked-plan` checks it.

### 5.2 Settled by the operator

- **D2. The `live` profile is local:** `profiles/live.md`, next to `profiles/skill.md`. `cnlp-kit` supports project
  profiles through the `roots` overlay, and this profile is project vocabulary: its `refs` are ADR ids and plan stems.
  - Cost: `live` joins `OWNED` (`src/artifacts/cnlp.js:18`). The comment at `src/artifacts/cnlp.js:14-18` ("the one
    profile this repository owns") is updated.
  - `profiles` is already in `package.json` `files`, so the profile ships.
- **D5. Strict.** Once opted in, an ADR without `live:` cannot be accepted or finalized (§3.6).
- **D6. `LIVE.md`.** The file name stays as in the brief; it is the default of `adr.live`.
- **D8. `adr-auto-change` is built now,** as phase 4, right after the phase 3 code.
- **Q3. Not now.** `adr-check-consistency` keeps its scope of accepted and active ADRs.

### 5.3 Defaults chosen in revision 4, for the operator to confirm

- **A. A plan without an ADR against an active ADR's capability:** `removed` is refused, `modified` is warned (§3.4).
  ADR sources are exempt. The alternative is to warn on both.
- **B. Settled by the operator: `adr-auto-change` archives its plan at the end,** by `aif-archive` semantics inline, as
  `adr finalize` does for ADR plans. The plan-stem ref survives the move.

---

## 6. Phases

Each phase ends green on `npm test`, moves the `package.json` and `extension.json` versions together (the `prepack`
hook fails the integration test otherwise), and adds a `CHANGELOG.md` entry.

### Phase 1 — the ADR path

Code:

- `profiles/live.md` (§4.3). Add `live` to `OWNED` in `src/artifacts/cnlp.js` and update its comment. Extend
  `test/profile.test.js`: `USED`, and the check against `profile.md` that `:17-21` runs only for `skill.md`.
- `src/live/delta.js`: `readDelta(file)` for both carriers, with `null` as absent, and `markApplied(file, date)` that
  writes `applied:` back into the same carrier.
- `src/live/refs.js`: `resolveRef` and `normaliseRef` (§3.5).
- `src/live/state.js`: `readLive`, `applyDelta` (pure: state + delta + ADR index → new state, warnings, refusals),
  `renderLive` (§3.4).
- `src/live/check.js`: `checkLive` (§3.7).
- `src/status.js`: export `indexAdrsById` (`:23-34`) and add `replaced_by` to what it indexes. Today it indexes
  `{status, file}` only.
- `src/lifecycle/validate.js`: the `live:` warning (`proposed`, `draft`) and error (`accepted` only) of §3.6, only when
  `liveFile` exists.
- `src/lifecycle/move.js`: `transition` to `accepted` refuses an absent or malformed `live:` when `liveFile` exists
  (§3.6).
- `src/lifecycle/finalize.js`: the 4 steps of §3.4.
- `src/lifecycle/supersede.js`: the finalize-first rewrite of §3.4, with `LIVE.md` in its rollback list.
- `src/config/paths.js`: `liveFile(projectDir)`.
- `commands/adr.js`: `adr live`, `init`, `apply` (ADR sources only in this phase), `check`.
- `templates/adr.md`: empty `live:`.

Skills: rules come from `ai-factory adr format skill`, never by path (`test/skill-format.test.js:43`). Both
`quality_rules:` groups stay byte-identical where touched (`test/skill-rubric.test.js`). A new section name must be
declared in `profiles/skill.md` `custom_sections`. Imperative mood forbids the passive voice.

- `adr-propose`, `adr-improve`:
  - read `LIVE.md` and reuse an existing capability id;
  - write `live:` or `none:` with a reason, with the summary double-quoted and written by the lexicon of
    `ai-factory adr format`;
  - run `adr live apply <adr> --dry-run`.
- `adr-accept`: a precondition that `live:` or `none:` is present when `LIVE.md` exists, with `adr-improve` as the next
  step when it is not. Show the delta and the `--dry-run` output to the operator with the decision. The CLI refusal
  at step 6 backs it up.
- `adr-finalize`:
  - run `--dry-run`;
  - correct the delta when the implementation diverged, or when a guard or superseded-ref warning shows;
  - finalize;
  - report `adr live check`.
- `adr-supersede`: report the ref rewrite and `adr live check`. Add `live:` to its non-material list (`:30`).
- `adr-reconcile`: allow a suggestion on `live:` while the ADR is not active. Today it forbids every frontmatter edit
  (`:27`).
- `adr-migrate`: add `live` to the frontmatter fields its `file_shape` lists (`:94`).
- `adr-auto-implement`:
  - step 3 stays as it is. A dirty `LIVE.md` at the start comes from an interrupted run and must stop this one. Each
    ADR's commit takes its own `LIVE.md` change, so the file is clean between ADRs;
  - step 29 names `DESCRIPTION.md` among the documents to update (`:58`). It gains 1 line: the capability list lives
    in `LIVE.md`, which the finalize of step 31 updates, so step 29 writes no feature list into `DESCRIPTION.md`;
  - steps 33 and 35: name `LIVE.md` among the staged files.
- `adr-auto-plan` step 19: the same line as step 29.
- `adr-overview`: the roles of §2, the events of §3.3, and `live:` in the §18.3 line (`:69`). It also says that a change
  which alters a capability goes through a plan, never `aif-implement` inline.
- `adr-status`: the check counts.
- `README.md`: the `adr live …` subcommands under "ai-factory adr subcommands" (`README.md:185`).

Tests, in a new `test/live.test.js` plus updates to `lifecycle.test.js`, `validate.test.js` and `profile.test.js`.

Apply:

- `added`, `modified`, `removed`;
- each refusal: `added` on an existing id, `modified`/`removed` on a missing one, a malformed delta, `changes`
  together with `none`, the active-ADR guard;
- a lexicon failure and a 251-character summary are refused, and nothing is written;
- the `- none:` swap in both directions.

Refs:

- resolution of each kind;
- `ambiguous-ref` for a stem equal to an ADR id;
- `\` and `./` normalisation;
- a path outside the project is refused.

Rendering: lines before `capabilities:` survive byte for byte.

Finalize:

- with a delta: the entry, the ADR move and `LIVE.md` are all staged, and the active ADR carries `live.applied`;
- the same for a documentation-only ADR and for one with authored `evidence:`;
- an archive collision after the `LIVE.md` write: `LIVE.md` and the ADR are restored;
- with the file absent: no change.

Gate, with the file present and no `live:`:

- `validateAdr` warns while the ADR is `draft`, and errors while it is `accepted`;
- `validateAdr` reports nothing for an `active` ADR, and `adr status --check` stays green;
- `transition … accepted` refuses, and nothing changes;
- `finalize` refuses, and nothing changes.

With the file absent, `adr live apply` exits 0 with `skipped: no LIVE.md`.

Supersede: both orders end with the refs rewritten.

Apply twice: refused the second time.

Check: every code of `adr live check` on a fixture.

### Phase 2 — bootstrap of an existing project

- A one-time skill, `adr-live-seed`:
  - it runs `adr live init`;
  - it reads active ADRs, `DESCRIPTION.md`, the `AGENTS.md` state narrative and the code, and proposes capabilities
    with refs;
  - it writes `LIVE.md` once the operator approves;
  - it backfills every active ADR: `live:` with `changes` for the entries whose refs name it, plus
    `applied: <since>`, or `none:` with a reason. That edit is non-material (§5.1 Q4), and `missing-delta` is clean
    from day 1;
  - it lists completed plans still in `paths.plans`, for the operator to archive or give a fence.

  A capability with no document gets a repository-path ref.
- It is not part of `adr-migrate`: projects already migrated need seeding too.
- It reports the `AGENTS.md` narrative section and does not delete it: that cleanup is project work.
- Tests to update:
  - skill count 18 → 19 in `test/extension-manifest.test.js:28` and its title (`:26`, "eighteen"), and in
    `test/integration/extension-lifecycle.test.js:65,66,137,138,431` and its title (`:61`);
  - a rubric group in `test/skill-rubric.test.js` (`NONE`, like `adr-migrate`);
  - the README skill list (`test/skill-format.test.js:27-34`);
  - `extension.json` `skills`.
- Text to update with no test behind it: the `adr-overview` skill tables, which name every skill.

### Phase 3 — plans without an ADR

- `injections/aif-plan.md` (append):
  - write the `adr-live` fence after the title, or `none:` with a reason for a bug fix or refactor;
  - double-quote the summary;
  - keep an existing fence when the plan is rewritten;
  - write no fence when the plan declares `implements:`;
  - read `LIVE.md` and `ai-factory adr decisions` first. When the change removes or alters a capability whose refs
    name an active ADR, tell the operator it needs `adr-propose` and `adr-supersede`.

  The text used in the probes (§9) is the starting point.
- `injections/aif-improve.md` (append): keep the first `adr-live` fence, and update it when the refinement changes what
  the product does.
- `injections/aif-implement.md` (append):
  - when every task is done, and before the step "Handle plan artifact after completion", run
    `ai-factory adr live apply <entrypoint>`;
  - output starting with `skipped:` means there is nothing to do;
  - when it fails, rewrite the summary as the error says and run it again;
  - in a fast plan, every record needs `refs:`.
- `extension.json` `injections`, and **`injections` added to `package.json` `files`**. AI Factory installs an npm
  extension by `npm pack`, so an unlisted directory is absent, and its injection is skipped silently
  (`dist/core/injections.js:66-69`).
- `adr live apply` accepts plans: full file, bundle directory or its `index.md`, fast plan, a plan file anywhere. It
  also accepts `--pending`.
- Tests:
  - every `manifest.injections[].file` exists and lies under a `files` entry;
  - apply on each plan kind;
  - the skip on `implements:`;
  - a fast plan without `refs:` is refused;
  - `--pending` order and continue-past-failure.
- Acceptance: on a real consumer project, under Claude Code and Codex, run one `aif-plan full` → `aif-improve` →
  `aif-implement` → `aif-archive` sequence and one `aif-plan fast` → `aif-implement` sequence. Check the entry, the
  staging and the archived plan.

### Phase 4 — `adr-auto-change`

Built right after phase 3 (D8).

**Input:** a topic, or the path of an existing full plan or ultra bundle without `implements:`. A fast `PLAN.md` is
refused: `aif-archive` does not touch fast plans (`aif-archive/SKILL.md:341`), and step 13 archives. The skill
declares no `allowed-tools`, like every `adr-*` skill.

**Kept from `adr-auto-implement`:**

- the acceptance baseline (its step 4), so a failure that already existed is not blamed on the change;
- the regression-test-first rule (`forbidden_behaviors`, steps 18 and 22);
- the exploratory subagent, when configured;
- the inline fallback when the runtime offers no subagents (its step 17);
- the project-memory update (its steps 30 and 33).

**Dropped**, because they are ADR-specific:

- `adr order` and its cycle check;
- the status and dependency checks;
- documentation-only;
- `adr-verify` against `## Decision`, and the `decision:`/`scope:`/`rules:` brief for the exploratory subagent;
- `evidence:` and finalize.

Steps:

1. Run `git status`. Stop when a change sits outside the plans directory and the QA directory. A dirty `LIVE.md`
   stops the run too: it is left over from an interrupted apply and would be swept into this commit.
2. Run `adr.acceptance.command` once when it is set, and stop when it fails.
3. Read `LIVE.md` and `ai-factory adr decisions`.
4. Stop and recommend `adr-propose` in 2 cases:
   - the change binds work beyond itself (the rule of `adr-overview`);
   - the change removes or alters a capability whose refs name an active ADR.
5. Create the plan by `aif-plan full` semantics, with the fence, or take the given plan.
6. Improve the plan by `aif-improve` semantics, at most 5 passes, as `adr-auto-plan` allows. After each pass, check
   that the fence still parses.
7. Run `adr live apply <entrypoint> --dry-run`, and rewrite the summary until it passes.
8. Implement every task by `aif-implement` semantics, with no commit between tasks. The installed `aif-implement`
   carries the phase 3 injection, so the apply may already run here.
9. Tests, as in `adr-auto-implement` steps 9–12: `aif-qa`, an automated test per checkable case, the project's test
   suite, and `adr.acceptance.command` when it is set.
10. Run 2 fresh read-only subagents, and the exploratory one when configured, at most 3 rounds:
    - 1 applies `aif-verify` against the plan's `## Original Request` and tasks;
    - 1 applies `aif-review`.

    Fix the findings, writing the failing test first. The stop rule is that of `adr-auto-implement` steps 27–28.
11. Update the documents the change makes incorrect, as in `adr-auto-implement` step 29, and the project memory as in
    its step 30.
12. Check that the fence still matches what was built, and correct it when it does not. Then run
    `ai-factory adr live apply <entrypoint>`, unless the fence already has `applied:` from step 8. Stop on failure,
    and commit nothing.
13. Archive the plan by `aif-archive` semantics (§5.3 B).
14. Commit by `aif-commit` without its push step, in 1 commit with `Untested:` lines. Stage by name:
    - code and tests;
    - QA artifacts and documents;
    - the archived plan;
    - `LIVE.md`;
    - the memory file, when it lives in the repository.
15. Push as `adr-auto-implement` steps 36–37 do.

**Its own `report_format`,** because `adr-auto-implement`'s table is keyed by ADR and has `finalize` rows. The table
here has 1 row per step: plan, improve, implement, tests, verify, review, exploratory, docs, apply, archive.

**Its own `status_footer`:** `✔ adr-auto-change: <capability-id, ...> · plan: <stem> · untested: <k> · stopped at:
<step or none> · pushed: <branch or no>`. Its `source:` is `ai-factory adr live check`.

- Forbidden: creating an ADR, and applying a plan with `implements:`.
- Rubric group: `NONE`, like the 2 other auto skills.
- Tests: the skill count goes 19 → 20, with the same test updates as phase 2.
- The phase 3 acceptance run also covers 1 `adr-auto-change` run.

---

## 7. Known holes and the answer to each

| Hole | Answer |
|---|---|
| `aif-implement` inline mode has no plan file, so no carrier | not covered. `adr-overview` says a change that alters a capability goes through a plan |
| A fast plan deleted, or overwritten by the next `aif-plan fast`, before the apply ran | lost, and the check cannot see it. The injection orders the apply before the deletion step, and the probes saw that order kept (§9) |
| An injection followed weakly | `unapplied-delta` and `missing-delta`, then `adr live apply --pending` |
| A plan implemented in parts across sessions | applied only when every task is done, which is correct |
| Two branches add the same capability | the sorted record conflicts in Git; run `adr live check` after the merge |
| 2 ids for 1 capability | `adr-propose` and the `aif-plan` injection read `LIVE.md` and reuse an id; not eliminated |
| An ADR that only adds a constraint | `none:` with a reason; `adr decisions` covers it |
| A successor ADR abandoned after supersede | the ref to the superseded ADR stays, and it stays correct: the old code still runs |
| A successor that drops a capability without saying `removed` | the superseded-ref rewrite warns: at `--dry-run` before finalize, or in the `adr supersede` report when finalize came first |
| A feature reverted with `git revert` | the entry reverts with it, because the apply lands in the same commit |
| A non-English summary | passes the English-only lexicon unchecked; the line limit and record shape still apply |
| `aif-implement` in a worktree (`--parallel`) | verified (§9): the apply runs in the worktree, `LIVE.md` and the `applied:` marker go into the branch commit with the code, and the merge brings them to the base branch |
| `aif-verify --strict` on a plan with a fence | verified in both runtimes (§9): no blocker, and both read the fence and `LIVE.md` as consistent |
| The apply stages `LIVE.md` and the plan while the code is still unstaged | a commit of only the staged files would record the change without its code. `aif-verify` and `aif-commit` both noticed it in the probes and proposed staging the code. `adr-auto-implement` and `adr-auto-change` stage by name, so they are not exposed. This is the same pattern `adr finalize` already has for the ADR move |
| Plans before the opt-in | `since:` bounds `missing-delta`; the seed covers the rest |
| `LIVE.md` grows to hundreds of entries | not addressed now; an optional `area:` record key later |
| `DESCRIPTION.md` keeps drifting | its role narrows to purpose and stack |

---

## 8. Out of scope

- Cleaning `ROADMAP.md`: `aif-archive --roadmap` already does it.
- Writing summaries with an LLM inside the CLI: the CLI stays deterministic.
- Verifying `LIVE.md` against the code: `adr-verify-all` covers the ADRs that the entries cite.
- A `deprecated` or `retired` status: a `removed` delta expresses removal.
- Ultra plans linked to an ADR: `src/artifacts/plan.js` reads only `*.md` files, and `adr-plan` writes only full plans.

---

## 9. Probe results (2026-10-09)

Setup:

- a scratch project with AI Factory 2.19.0, Codex CLI 0.160.1 (`codex exec -s workspace-write`) and Claude Code
  2.1.295 (`claude -p --permission-mode acceptEdits`);
- a probe extension that appended the phase 3 injection texts to `aif-plan` and `aif-implement`;
- a stub, `node live-stub.mjs <entrypoint>`, standing in for `adr live apply`, which logged the argument and the fence
  it found.

**Survival of `.ai-factory/LIVE.md`.** Its hash was identical after each step:

- `ai-factory update`;
- `ai-factory extension update`;
- `extension remove`;
- `extension add` again.

`remove` stripped the injections, and `add` restored them in both `.claude/skills/` and `.codex/skills/`.

**Injections followed.** All runs used the same task, non-interactively.

| Runtime | Plan | Fence after the title | `refs:` only in fast | Apply ran with the right entrypoint, all tasks done, before plan cleanup |
|---|---|---|---|---|
| Codex | fast | yes | yes | yes |
| Codex | full | yes | yes | yes |
| Codex | ultra | yes, in `index.md`, marker still line 1 | yes | yes, with `index.md` |
| Claude Code | fast | yes | yes | yes |
| Claude Code | full | yes | yes | yes |
| Claude Code | ultra | yes, in `index.md`, marker still line 1 | yes | yes, with `index.md` |

**Neighbouring skills.**

| Probe | Codex | Claude Code |
|---|---|---|
| `aif-improve` with a scope change (add input validation), no `aif-improve` injection | fence kept, summary updated to name the `TypeError` | fence kept, summary updated to name the `TypeError` (after the approval `aif-improve` asks for) |
| `language.artifacts: ru` | keys in English, summary in Russian | keys in English, summary in Russian |
| `aif-archive` of a full plan with a fence | — | frontmatter `archived:` prepended above the title, fence intact |
| `aif-archive` of an ultra bundle with a fence | — | `<!-- aif:archived:DATE -->` after the marker, fence intact |

**Static checks in the same run:**

- an ADR with a nested `live:` passes `adr validate`, `adr status`, `adr decisions` and core `audit-artifacts`;
- the draft `live` profile and the §4.3 example pass the CNL-P checker;
- the YAML colon trap and the `null` value of an empty key were confirmed.

**Permissions.**

- In Claude Code the apply ran with no Bash rule in settings, because the skill's own `allowed-tools: … Bash …`
  pre-approved it. That holds only when the skill loads as a skill.
- In a first run, Git Bash rewrote `/aif-implement` into a path, so the skill did not load and every Bash call was
  denied in `-p`. The model still named the required apply step in its report.
- No `adr-*` skill declares `allowed-tools`. They call `ai-factory adr …` under the session's permissions, so
  `adr live apply` adds no new permission need.

**`aif-verify --strict` and the worktree path.** For these probes the stub behaved like the real apply: it added the
record to `LIVE.md`, wrote `applied:` into the fence, and ran `git add` on both.

- `aif-verify --strict` after `aif-plan full` → `aif-implement`: status `warn` with no blocker, in Codex and in Claude
  Code. Both reported the fence as present and applied, and `LIVE.md` as matching the plan.
- Claude Code, `aif-plan full --parallel` → `aif-implement` in the worktree → commit → merge:
  - the apply ran with the worktree as its working directory;
  - the branch commit held `LIVE.md`, the plan with `applied:`, and the code;
  - after the merge, `master` had the entry and the marker.

  `aif-commit` stopped for its confirmation, as a non-interactive run must. That approval came in a second message,
  and the skill's Bash grant does not outlive the message, so the commit itself was made by hand, as its option 1
  proposed.

**Flat-file runtimes.** `ai-factory init --agents antigravity,kilocode,qwen` plus the probe extension applied 6
injections. They landed in `.agent/workflows/aif-plan.md`, `.agent/workflows/aif-implement.md`, the same 2 files under
`.kilocode/workflows/`, and `.qwen/skills/*/SKILL.md`. How those models follow the text could not be run: no
`qwen`, `kilocode`, `antigravity`, `gemini`, `cursor-agent` or `opencode` CLI is installed here. The safety net for
them is `unapplied-delta` and `adr live apply --pending`.

Limits: 1 run per cell, on a trivial task; model behaviour checked in Codex and Claude Code only.

---

## 10. Revision log

**Revision 2.** The first audit found 21 issues; each was checked against the source and adopted:

- the plan carrier moved to a fence;
- `injections/` was added to `files`;
- staging;
- the missing events;
- the backfill;
- the scoped check codes;
- the CNL-P shape rules;
- the `aif-plan`-into-`adr-plan` leak;
- the tests the phases trip;
- the superseded refs;
- 1 opt-out shape;
- re-run semantics;
- the config default in code;
- render-only-the-block;
- README and `adr-status`;
- unfinished-plan refs.

Beyond the audit, revision 2 also introduced:

- plan refs as stems that resolve in both directories;
- `--dry-run` before finalize;
- the apply moved from archive to implement completion. The reasons: archiving is optional, and `aif-archive` grants
  no `ai-factory` Bash.

**Revision 3.** The operator settled D2 (local profile), D5 (strict), D6 (`LIVE.md`) and D8 (build
`adr-auto-change` now). Phase 0 was removed. The 2 items left unverified were probed: `LIVE.md` survival, and Codex
following an injection. Both held.

**Revision 4.** A second audit, which simulated implementing the plan, found 20 issues. Each was verified in the code
and adopted:

| # | Finding | Change |
|---|---|---|
| 1 | `--pending` order undefined | git commit date, then mtime; per-id order; continue past failures (§3.7) |
| 2 | the D5 gate fires after implementation | `validateAdr` from `accepted` on, via `adr status --check` (§3.6) |
| 3 | summaries are lexicon-checked; the YAML colon trap | validate the rendered file before writing; quoted summaries; `mood: declarative` (§3.1, §3.4) |
| 4 | a plain plan can remove an active ADR's capability | the active-ADR guard (§3.4, §5.3 A) |
| 5 | supersede after finalize leaves refs stale | the rewrite also in `adr supersede` (§3.4) |
| 6 | `aif-improve` may drop the fence | an `aif-improve` injection (§5.1 D7) |
| 7 | ref kind by shape is ambiguous | resolution by lookup, `ambiguous-ref`, normalisation (§3.5) |
| 8 | the rollback test cannot fail after the last write | write `LIVE.md` before `transition` (§3.4) |
| 9 | the pre-move write is conditional | `evidenceChanged \|\| delta` (§3.4) |
| 10 | phase 4 had no step list | written (§6 phase 4) |
| 11 | `indexAdrsById` is private and has no `replaced_by` | export and extend (§6 phase 1) |
| 12 | an H1 in a flat profile | title moved to frontmatter (§4.3) |
| 13 | prose after the records is a stray record | prose only before `capabilities:` (§3.4) |
| 14 | the sentinel and `no-refs`/`summary-too-long` | skipped (§3.7) |
| 15 | skill-text constraints | named (§6 phase 1) |
| 16 | `adr-reconcile` and `adr-migrate` cannot handle `live:` | both updated (§6 phase 1) |
| 17 | unspecified command behaviour | exits, standalone staging, plans anywhere (§3.4, §3.7) |
| 18 | `none:` and `applied:` | `none:` needs no `applied:`; the seed's backfill specified (§3.1, §6 phase 2) |
| 19 | an empty `live:` becomes `null` | treated as absent (§3.1) |
| 20 | a fast plan overwritten by the next one | named in §7 |

Probes added in revision 4, all held (§9):

- ultra in both runtimes;
- `aif-improve` in both runtimes;
- `artifacts: ru` in both runtimes;
- `aif-archive` of a full plan and of an ultra bundle with a fence;
- an ADR with `live:` through every `adr` read command and core `audit-artifacts`;
- the `live` profile and the example against the CNL-P checker.

**Revision 5.** The operator settled §5.3 B: `adr-auto-change` archives its plan. A third review read only what
revision 4 rewrote and found 14 issues. Each claim was checked in the code, and all were adopted:

| # | Finding | Change |
|---|---|---|
| 1 | `apply` exits 1 without `LIVE.md`, so the injection fails in every project that did not opt in | exit 0 `skipped: no LIVE.md`; the injection ignores `skipped:` (§3.6, §3.7, phase 3) |
| 2 | `adr-accept` runs its `--check` while the ADR is `draft`, so the acceptance gate never fires | the gate moved into the CLI: `transition … accepted` refuses (§3.6) |
| 3 | an error on `active` ADRs turns the overview `--check` red for every existing project | `validateAdr` errors on `accepted` only; `active` is the `missing-delta` code (§3.6) |
| 4 | `finalize` never calls `validateAdr` | finalize step 1 refuses an absent delta itself (§3.4) |
| 5 | the guard refuses a successor's `removed` when finalize came first | the guard covers plan sources only (§3.4) |
| 6 | `adr-auto-change` applies twice: inside `aif-implement` semantics, then in its own step | step 12 skips when `applied:` is set (phase 4) |
| 7 | `adr-auto-change` would archive a fast plan, which `aif-archive` forbids | fast plans are refused as input (phase 4) |
| 8 | rewrite gaps: an unapplied successor, duplicate refs, no `--dry-run` on supersede | the rewrite runs on any ADR apply with `supersedes:`; dedup; reported afterwards (§3.4) |
| 9 | finalize step precision: `none:` deltas, the wrong ordering rationale, the rollback's `git add` | corrected (§3.4) |
| 10 | `--pending`: kind order breaks remove-then-re-add; moved-file dates; partial results | date order first; kind order only for the same date; partial results stated (§3.7) |
| 11 | refs: `resolveInside` throws, trailing `/`, case on Windows | handled (§3.5) |
| 12 | phase 4 dropped steps silently and borrowed a report that does not fit | kept and dropped steps listed; its own report and footer (phase 4) |
| 13 | phase 1 and 2 lists: step 29 wording, test titles, `adr-overview` is not a test | corrected (phase 1, phase 2) |
| 14 | a gate described at acceptance while wired at plan time | resolved by finding 2 |

After revision 4, the worktree path and `aif-verify --strict` were probed and held. For the flat-file runtimes, only
injection placement was verified: their models could not be run (§9).
