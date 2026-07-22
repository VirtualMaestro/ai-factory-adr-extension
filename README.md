# ai-factory-adr-extension

Architecture Decision Record (ADR) lifecycle for [AI Factory](https://github.com/lee-to/ai-factory).

Adds an audited, Git-native ADR workflow to an AI Factory project: eight
lifecycle skills for the agent (`propose → refine → accept → plan → implement →
finalize`, plus `supersede` and `status`), a `verify` skill that checks an ADR
against the implemented code on demand, an overview skill that maps the flow,
and a deterministic `ai-factory adr` command that does the file mechanics
(status moves, reciprocal links, artifact audit).

The source of truth is always the Markdown ADR files in Git. Any external index
is advisory, never authoritative.

## Requirements

- AI Factory `>=2.0.0 <3.0.0`
- Node.js `>=18`

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

This installs the 15 skills into each configured runtime (`.claude/skills/`,
`.codex/skills/`) and registers the `adr` command. Then scaffold the ADR
directories:

```bash
ai-factory adr init
```

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

To remove the extension while keeping project ADRs and plans:

```bash
ai-factory extension remove ai-factory-adr-extension
```

## Lifecycle

```text
propose ─▶ refine ─▶ accept ─▶ plan ─▶ implement ─▶ finalize ─▶ (active)
proposed    draft    accepted                          active
                                                          │
                                                    supersede ─▶ superseded
```

For the agent, start with the **`/aif-adr-overview`** skill (Codex:
`$aif-adr-overview`) — it maps every stage to its skill and states the
retrieval/immutability rules. The stage skills are `aif-adr-{propose, refine,
accept, plan, implement, finalize, supersede, status}`. Off the linear flow,
`aif-adr-verify` checks any accepted/active ADR against the implemented code
(`aif-adr-verify-all` runs that check over every active ADR in one sweep and reports a
conformance table), `aif-adr-next` reads the `depends_on` graph to tell you which ADR to implement next,
and `aif-adr-reconcile` adjudicates a second reviewer's proposed improvements to an
ADR or plan — adopting the sound ones and rejecting the rest, each with a reason.

### Migrating an existing ADR workflow

Installing into a project that already kept ADRs its own way? Run
**`/aif-adr-migrate`** (Codex: `$aif-adr-migrate`) once. On a branch, it maps each
legacy ADR to a lifecycle status, rewrites it into the template under the right
status directory (`git mv` preserves history), validates the set with
`ai-factory adr status --check`, and repoints stale ADR instructions in
`AGENTS.md`/`CLAUDE.md`/`CONTRIBUTING.md` to `/aif-adr-overview`.

## `ai-factory adr` subcommands

| Command | Purpose |
|---|---|
| `init` | Scaffold the ADR directory structure (idempotent) |
| `new <topic>` | Scaffold a `proposed` ADR from the template |
| `import <topic> --status <s> [--id <id>]` | Scaffold a conformant ADR skeleton at any status (used by migration) |
| `validate <file>` | Check one ADR against the lifecycle invariants |
| `verify-anchors <file>` | Check that an ADR's `code:` anchors resolve on disk (non-zero exit if any are missing) |
| `transition <file> <status>` | Atomic move between non-terminal lifecycle states |
| `link-plan <adr> <plan>` | Write reciprocal ADR↔plan links |
| `resolve-plan <adr>` | Resolve the plan(s) implementing an ADR |
| `finalize <file>` | Activate an ADR; archive its plan |
| `supersede <old> <new>` | Replace an ADR, preserving history |
| `status [file]` | Overview / diagnostics; JSON detail includes `replacedBy`; `--check` exits non-zero on blocking errors (CI) |
| `order` | Dependency-ordered plan: what is ready to implement next, the topological order, blocked ADRs, and cycles (non-zero exit on a cycle) |

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
`aif-adr-verify` skill wrapping it) checks that the listed anchors actually resolve on disk,
catching drift when code is moved or deleted. The reverse
question — "which decisions govern this file?" — is a plain grep over `code:`
in the ADR root; no index or external tooling involved.

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

- [Product requirements](./docs/ai-factory-adr-extension-PRD.md)
- [Implementation backlog](./docs/BACKLOG.md)
- [Changelog](./CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
