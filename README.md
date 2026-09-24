# ai-factory-adr-extension

Architecture Decision Record (ADR) lifecycle for [AI Factory](https://github.com/lee-to/ai-factory).

Adds an audited, Git-native ADR workflow to an AI Factory project: eight
lifecycle skills for the agent (`propose → improve → accept → plan → implement →
finalize`, plus `supersede` and `status`), a `verify` skill that checks an ADR
against the implemented code on demand, an overview skill that maps the flow,
and a deterministic `ai-factory adr` command that does the file mechanics
(status moves, reciprocal links, artifact audit).

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

This installs the 18 skills into each configured runtime (`.claude/skills/`,
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

Removal takes the 18 skills out of each runtime's skills directory and deletes
the extension's own install directory. It leaves everything the extension wrote
while running: your ADR root with all its documents, your plans, and
`.ai-factory/adr-extension.yaml`. Adding the extension again therefore needs no
second `ai-factory adr init`.

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

Eighteen skills, installed into every runtime the project configures — invoked as
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
| `adr-migrate` | brings a project's pre-existing legacy ADRs into this lifecycle | one-time; run it before authoring new ADRs there |

Running a whole phase in one call:

| Skill | Does | Constraint |
|---|---|---|
| `adr-auto-plan <topic or adr> ...` | propose, improve, accept and plan for a batch of ADRs, update the docs, commit and push | stops only for principled questions and the acceptance decision; a rejected draft interrupts it until the operator says how to proceed |
| `adr-auto-implement [adr ...]` | implement, write tests, verify and review in fresh subagents, fix, update the docs, finalize, commit and push | asks nothing and stops on a blocker; 1 commit per ADR on the current branch |

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
and the ADR's `evidence:` for the commit `adr-finalize` cites.

### When an ADR is not the tool

The lifecycle costs what it costs because a decision record binds later work. A change whose
whole rollback is `git revert` — wording in a guide, a README line, a comment — binds nothing
beyond itself, and `adr-propose` now says so and writes no file: its `preconditions:` ask
what the revert would *not* undo (a public API, a data schema, a module boundary, a protocol,
a dependency, an obligation later work is measured against). One decision is one ADR; the
obligations that follow from it are lines of `rules:` inside it, not sibling ADRs. And
refinement ends on a condition, not on taste: a pass that changes no `decision:`, `scope:`,
`constraints:` or `rules:` line is the last one, and the ADR goes to `adr-accept`.

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
| `init` | Scaffold the ADR directory structure (idempotent) |
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
| `format [name]` | Print the CNL-P standard, or a profile such as `adr`; `--path` prints where it resolved instead |

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
ai-factory adr format --path   # where it resolved, if you want to open it
```

**There is nothing to initialize.** `ai-factory adr init` is the only setup a
project needs, and it survives `extension remove` — reinstalling does not call
for a second run. CNL-P adds no project-level files: no `cnlp init`, no
`cnlp.config.json`, no `cnlp/profiles/`, no `cnlp-*` skills. Those belong to a
repository that checks its own documents with the `cnlp` CLI; here the checker is
embedded in `adr validate`, which the CLI cannot replace because it alone knows
an ADR's lifecycle status.

Of the profiles the package carries, this extension uses two: `adr`, taken from
the package as-is, and `skill`, which it maintains itself because its skills use
sections a generic skill profile does not declare.

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

## Current scope

Markdown ADRs in Git are the only source of truth. Decision recall needs no
external service: structured frontmatter, `adr status`, and grep cover it. The
optional Cognee memory integration was evaluated and dropped (the
`adr.memory.provider` config axis stays reserved); the optional
code-intelligence integration remains deferred post-MVP. No runtime code
depends on any MCP server — installs without one lose nothing and cannot fail
because of it.

## Documentation

- [Implementation backlog](./docs/BACKLOG.md)
- [Changelog](./CHANGELOG.md)
- The CNL-P standard — run `ai-factory adr format` (it ships inside the
  extension, so there is no path to link)

## License

MIT — see [LICENSE](./LICENSE).
