# ai-factory-adr-extension

Architecture Decision Record (ADR) lifecycle for [AI Factory](https://github.com/lee-to/ai-factory).

Adds an audited, Git-native ADR workflow to an AI Factory project: eight
lifecycle skills for the agent (`propose → refine → accept → plan → implement →
finalize`, plus `supersede` and `status`), an overview skill that maps the flow,
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

This installs the ten skills into each configured runtime (`.claude/skills/`,
`.codex/skills/`) and registers the `adr` command. Then scaffold the ADR
directories:

```bash
ai-factory adr init
```

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
accept, plan, implement, finalize, supersede, status}`.

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
| `transition <file> <status>` | Atomic move between non-terminal lifecycle states |
| `link-plan <adr> <plan>` | Write reciprocal ADR↔plan links |
| `resolve-plan <adr>` | Resolve the plan(s) implementing an ADR |
| `finalize <file>` | Activate an ADR; archive its plan |
| `supersede <old> <new>` | Replace an ADR, preserving history |
| `status [file]` | Overview / diagnostics; JSON detail includes `replacedBy`; `--check` exits non-zero on blocking errors (CI) |

The lifecycle skills wrap these commands — prefer the skills for authoring work
and reserve raw commands for scripting and CI.

`active` and `superseded` are managed states: use `finalize` and `supersede`
rather than `transition`. Returning `accepted → draft` is rejected while a
non-archived plan still implements the ADR.

A documentation-only ADR must declare `Plan: not required` or
`Evidence: documentation-only decision` as a structured field inside its
`## Implementation` section; matching prose elsewhere does not bypass planning.

## Configuration

The ADR root defaults to `docs/adr` and can be changed in
`.ai-factory/adr-extension.yaml`:

```yaml
adr:
  root: docs/decisions
```

Commands and `adr status --check` resolve this setting automatically, including
when the root is outside AI Factory's default audit paths.

## Current scope

Markdown ADRs in Git are the only source of truth. Optional Cognee memory and
code-intelligence integrations are deferred post-MVP and are not included in
the current release.

## Documentation

- [Product requirements](./docs/ai-factory-adr-extension-PRD.md)
- [Implementation backlog](./docs/BACKLOG.md)
- [Changelog](./CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
