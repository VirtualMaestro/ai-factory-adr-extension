---
name: aif-adr-migrate
description: Migrate a project's pre-existing/legacy ADRs into this extension's lifecycle — rewrite each into the template, file it under the right status directory, and repoint stale ADR instructions in AGENTS.md-type files to the new skills.
---

# aif-adr-migrate

## Purpose
- Bring ADRs written before this extension — MADR, Nygard, or homegrown — into the audited lifecycle.
- There is no deterministic migrate command: legacy formats vary too much to parse mechanically. This skill reads and maps; the commands place and check.

## Scope
S1 MUST act on the legacy ADR files, the configured ADR root, and the instruction files named in W21.
S2 MUST own the judgment: reading each legacy decision, mapping it to a lifecycle status, and rewriting it into the template.
S3 MUST leave file mechanics to the CLI listed in `## Commands`.

## Forbidden
F1 MUST NOT hand-edit a `status` field to fake a transition.
F2 MUST NOT move ADR files outside `git mv` or the `adr` commands.
F3 MUST NOT leave any template placeholder unresolved, including `[decision]` and `not implemented`.
F4 MUST NOT put legacy code or issue references in the body: they belong in the frontmatter `code:` and `issue:` fields.
F5 MUST NOT treat prose in the body as a substitute for planning.
F6 MUST NOT invent an accepted rule when it is unclear whether a legacy item is a real decision: migrate it as `proposed`.
F7 MUST NOT invent new rules when repointing instruction files: point to the skills.
F8 MUST NOT treat a prior external index or wiki as the source of truth: the Markdown ADR files in Git are, and they supersede it.
F9 MUST NOT merge the migration branch: leave it for the maintainer to review.

## Preconditions
P1 MUST verify the project is initialized: `.ai-factory.json` exists, which the `adr` commands gate on.
P2 MUST verify the working tree is clean: `git status --porcelain` prints nothing.

## Commands
| Command | Owns |
|---|---|
| `ai-factory adr init` | scaffolding the status directories and the default config |
| `ai-factory adr import "<title>" --status <status> --id <id>` | writing a conformant skeleton at `<root>/<status-dir>/<id>.md` |
| `ai-factory adr validate <file>` | dir↔status, stem==id, no placeholders, `replaced_by:` on every `superseded` ADR, and recorded evidence or documentation-only for `active` |
| `ai-factory adr status --check` | duplicate ids, dangling relations, cycles, and ADRs with more than one active plan |
| `ai-factory adr status --json` | the per-status id arrays behind the mapping and the footer |
| `ai-factory adr link-plan <adr-file> <plan-file>` | the reciprocal ADR↔plan links |
| `ai-factory adr supersede <old-file> <new-file> [--archive-plan \| --delete-plan]` | writing `supersedes: [<old-id>]` on the new ADR, writing the reciprocal `replaced_by: <new-id>` into the old ADR, and moving the old ADR to `superseded/` |
| `git mv`, `git rm` | file placement, preserving history |

## Workflow
W1 MUST run `ai-factory adr init`: it is idempotent, scaffolds `proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/` under the configured root, and writes the default `.ai-factory/adr-extension.yaml` when it is absent.
W2 MUST create the migration branch, which is what makes the whole migration reviewable and revertible: `git checkout -b adr-migration`.
W3 MUST read `adr.root` from `.ai-factory/adr-extension.yaml`, default `docs/adr`, and use that root everywhere below.
W4 MUST ask the operator where the legacy ADRs live: there is no reliable way to locate them across projects, and the operator knows their own layout.
W5 MUST scan `adr/`, `docs/adr/`, `docs/decisions/`, and `architecture/decisions/` only when the operator does not answer W4.
W6 MUST read every legacy file found.
W7 MUST note per file its format and any existing status, date, and title.
W8 MUST note which files form a replace or deprecate pair.
W9 MUST assign each file a stable id `adr-<lowercase-hyphenated>` derived from its title.
W10 MUST assign each file a lifecycle status by the one matching case of C1–C5.
W11 MUST state the full mapping, old file → id + status, before moving anything.
W12 MUST process one file at a time.
W13 MUST apply to each file the one matching movement case, C6 or C7.
W14 MUST additionally apply C8 when that file was written for a pre-1.6 version of this extension.
W15 MUST additionally apply C9 when that decision is documentation-only.
W16 MUST migrate both sides of a replace pair at their live status before W17: `ai-factory adr supersede` requires the old ADR to be `accepted` or `active`.
W17 MUST run `ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]` for each pair, in preference to hand-linking.
W18 MUST place any legacy plan doc under the configured `paths.plans` and link it: `ai-factory adr link-plan <adr-file> <plan-file>`.
W19 MUST run `ai-factory adr validate <file>` on each migrated ADR and fix until it is clean.
W20 MUST run `ai-factory adr status --check` and fix until it exits 0.
W21 MUST replace each stale ADR-process block in `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `README.md` with this pointer, under F7:

  > **ADRs:** start with `/aif-adr-overview` (Codex: `$aif-adr-overview`).
  > Lifecycle: `propose → refine → accept → plan → implement → finalize`, plus
  > `supersede`. Source of truth = the Markdown ADR files under the configured
  > ADR root.

W22 MUST substitute the configured `adr.root` for "the configured ADR root" in that pointer.
W23 MUST end with O2.

## Cases

### Set 1 — legacy status → lifecycle status. Select exactly one. Selected at W10.

C1 the legacy status is *accepted* or *approved*
C1.1 MUST map to `accepted`.
C1.2 MUST map to `active` instead only when the decision is demonstrably implemented and concrete evidence can be recorded.

C2 the legacy status is *proposed*, *draft*, or *RFC*
C2.1 MUST map to `proposed` or `draft`.

C3 the legacy status is *deprecated* or *replaced*, and the replacement is also being migrated
C3.1 MUST import it at its prior live status, `accepted` or `active`, and let W17 move it.

C4 the legacy status is *deprecated* or *replaced*, and the replacement exists but is not itself being migrated
C4.1 MUST place it directly in `superseded/`.
C4.2 MUST fill the frontmatter `replaced_by:` with the replacement's id by hand.

C5 the legacy status is *deprecated* or *replaced*, and no successor exists
C5.1 MUST NOT place it in `superseded/`: `ai-factory adr validate` rejects a `superseded` ADR whose `replaced_by:` is empty (inv 11), so W19 could never pass.
C5.2 MUST stop and ask the operator which status the decision should carry, under A4.

### Set 2 — file shape. Select exactly one. Selected at W13.

C6 one legacy file becomes one ADR — the common case
C6.1 MUST preserve history with a rename: `git mv <legacy-file> <root>/<status-dir>/<id>.md`.
C6.2 MUST then edit the moved file to match `templates/adr.md`.
C6.3 MUST fill the frontmatter: `id`, `type: adr`, `status`, `owners`, `depends_on`, `affects`, `supersedes`, `code`, `issue`, `plan`, `evidence`, `replaced_by`.
C6.4 MUST fill the sections: Context with Problem, Constraints, and Decision drivers; Decision; Alternatives considered; Consequences with Positive, Negative, and Risks.
C6.5 MUST port the old content into those sections.
C6.6 MUST set `status` equal to the directory the file now lives in.
C6.7 MUST record a short `evidence:` for an `active` import.
C6.8 MUST backfill `code:` for an `active` or `superseded` import with the primary entry-point anchors when the implementation location is known: repo-root paths, POSIX `/`, optional `#symbol`.
C6.9 MUST leave `code:` as `[]` when the implementation location is not known.

C7 the legacy file is messy or partial, or one legacy file must split into several ADRs
C7.1 MUST scaffold each target from the template instead of renaming: `ai-factory adr import "<title>" --status <status> --id <id>`.
C7.2 MUST fill each scaffold as C6.3 to C6.9 require.
C7.3 MUST drop the source: `git rm <legacy-file>`.
C7.4 MUST expect the skeleton to fail `validate` until it is filled: `import` keeps the template placeholders on purpose.

### Set 3 — source-format overlay. Apply in addition to the movement case when it matches. Applied at W14.

C8 the ADR was written for a pre-1.6 version of this extension, so its machine fields live in the body
C8.1 MUST hoist `- **Plan:** <id>` to `plan: <id>`.
C8.2 MUST hoist `- **Evidence:** …` to `evidence: …` as a short string.
C8.3 MUST hoist `- **Replaced by:** …` to `replaced_by: <new-id>`.
C8.4 MUST hoist `- **Issue:** …` to `issue: …`.
C8.5 MUST remove the plan id from `affects`.
C8.6 MUST delete the emptied `## Implementation` and `## References` sections.
C8.7 MUST drop the `- **Code:**` line: it was always a duplicate of the `code:` frontmatter.

### Set 4 — decision-semantics overlay. Apply in addition to the movement case when it matches. Applied at W15.

C9 the decision is documentation-only
C9.1 MUST set `evidence: documentation-only` in the frontmatter.
C9.2 MUST leave `plan:` empty.

## Abort conditions
A1 MUST stop and report which precondition failed when P1 or P2 cannot be satisfied.
A2 MUST stop and ask when neither W4 nor W5 locates any legacy ADR.
A3 MUST stop and report the unresolved finding when `ai-factory adr status --check` cannot be made to exit 0.
A4 MUST stop and ask when a legacy ADR is deprecated or replaced with no successor, under C5.

## Output
O1 MUST emit the mapping of W11, naming per row the old file, the new id, and the resulting status.
O2 MUST end with the footer, filled from `ai-factory adr status --json`:

  ```text
  ✔ aif-adr-migrate · 4 ADRs → 2 active, 1 accepted, 1 superseded · branch: adr-migration
  ```

## Invocation
Claude Code: `/aif-adr-migrate` · Codex: `$aif-adr-migrate`.
