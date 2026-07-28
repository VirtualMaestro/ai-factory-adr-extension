---
name: aif-adr-migrate
description: Migrate a project's pre-existing/legacy ADRs into this extension's lifecycle — rewrite each into the template, file it under the right status directory, and repoint stale ADR instructions in AGENTS.md-type files to the new skills.
---

mode: adr_migration

purpose:
- bring ADRs written before this extension — MADR, Nygard, or homegrown — into the audited lifecycle
- read and map each legacy decision; the commands place and check
- there is no deterministic migrate command: legacy formats vary too much to parse mechanically

inputs:
- legacy ADR location, from the operator

preconditions:
- the project is initialized: `.ai-factory.json` exists, which the `adr` commands gate on
- the working tree is clean

scope:
- act on the legacy ADR files, the configured ADR root, and the instruction files named in the repointing step
- own the judgment: reading each legacy decision, mapping it to a lifecycle status, rewriting it into the template
- leave file mechanics to the CLI: `init`, `import`, `validate`, `status`, `link-plan`, `supersede`, `git mv`, `git rm`

forbidden_behaviors:
- do not hand-edit a `status` field to fake a transition
- do not move ADR files outside `git mv` or the `adr` commands
- do not move anything before the full mapping is stated
- do not leave any template placeholder unresolved, including `[decision]` and `not implemented`
- do not put legacy code or issue references in the body: they belong in the frontmatter `code:` and `issue:` fields
- do not treat prose in the body as a substitute for planning
- do not invent an accepted rule when it is unclear whether a legacy item is a real decision: migrate it as `proposed`
- do not invent new rules when repointing instruction files: point to the skills
- do not treat a prior external index or wiki as the source of truth: the Markdown ADR files in Git are, and they supersede it
- do not merge the migration branch: leave it for the maintainer to review

outputs:
- the mapping of old file to new id and resulting status, one row per legacy file
- the migrated ADRs on the branch
- repointed instruction files

workflow:
1. run `ai-factory adr init`: it is idempotent, scaffolds `proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/` under the configured root, and writes the default `.ai-factory/adr-extension.yaml` when it is absent
2. create the migration branch, which is what makes the whole migration reviewable and revertible: `git checkout -b adr-migration`
3. read `adr.root` from `.ai-factory/adr-extension.yaml`, default `docs/adr`, and use that root everywhere below
4. run `ai-factory adr format --path` and `ai-factory adr format adr --path`, then read both: they are the rules and the block set every migrated file is rewritten into
5. ask the operator where the legacy ADRs live: there is no reliable way to locate them across projects, and the operator knows their own layout
6. scan `adr/`, `docs/adr/`, `docs/decisions/`, and `architecture/decisions/` only when the operator does not answer
7. read every legacy file found, noting its format and any existing status, date, and title
8. note which files form a replace or deprecate pair
9. assign each file a stable id `adr-<lowercase-hyphenated>` derived from its title
10. assign each file a lifecycle status by the one matching case in `status_mapping`
11. state the full mapping, old file to id and status, before moving anything
12. process one file at a time, applying the one matching case in `file_shape`
13. additionally apply `pre_1_6_overlay` to that file when it was written for a pre-1.6 version of this extension
14. additionally apply `pre_cnlp_overlay` to that file when its body is prose in this extension's own format
15. additionally apply `documentation_only_overlay` to that file when the decision is documentation-only
16. migrate both sides of a replace pair at their live status before superseding: `ai-factory adr supersede` requires the old ADR to be `accepted` or `active`
17. run `ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]` for each pair, in preference to hand-linking
18. place any legacy plan doc under the configured `paths.plans` and link it: `ai-factory adr link-plan <adr-file> <plan-file>`
19. run `ai-factory adr validate <file>` on each migrated ADR and fix until it is clean
20. run `ai-factory adr status --check` and fix until it exits 0
21. replace each stale ADR-process block in `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `README.md` with the `instruction_pointer` below
22. substitute the configured `adr.root` for "the configured ADR root" in that pointer
23. emit the mapping, then the status footer

status_mapping:
- the overlays below are independent of this list: a file gets exactly 1 status here
- legacy status *accepted* or *approved*: map to `accepted`, or to `active` only when the decision is demonstrably implemented and concrete evidence can be recorded
- legacy status *proposed*, *draft*, or *RFC*: map to `proposed` or `draft`
- legacy status *deprecated* or *replaced*, replacement also being migrated: import at its prior live status, `accepted` or `active`, and let the supersede step move it
- legacy status *deprecated* or *replaced*, replacement exists but is not itself being migrated: place it directly in `superseded/`
- fill that ADR's frontmatter `replaced_by:` with the replacement's id by hand
- legacy status *deprecated* or *replaced*, no successor exists at all: stop and ask the operator which status the decision should carry
- that case has no `superseded/` option: `ai-factory adr validate` rejects a `superseded` ADR whose `replaced_by:` is empty (inv 11), so the validation step could never pass

file_shape:
- select exactly 1 of the cases below, then apply any matching overlay on top of it
- one legacy file becomes one ADR, the common case:
  - preserve history with a rename: `git mv <legacy-file> <root>/<status-dir>/<id>.md`
  - edit the moved file to match `templates/adr.md`
  - fill the frontmatter: `id`, `type: adr`, `status`, `owners`, `depends_on`, `affects`, `supersedes`, `code`, `issue`, `plan`, `evidence`, `replaced_by`
  - fill the 4 `##` headings with the required CNL-P blocks, as the ADR profile declares them
  - add `blast_radius:` when the decision changes code
  - port the old prose into those blocks, one idea per bullet
  - state every numeric limit as a comparison, `<= 2 connections per client`, never as a phrase
  - replace an unquantified comparative with the property and its bound, or drop the claim
  - set `status` equal to the directory the file now lives in
  - record a short `evidence:` for an `active` import
  - backfill `code:` for an `active` or `superseded` import with the primary entry-point anchors when the implementation location is known: repo-root paths, POSIX `/`, optional `#symbol`
  - leave `code:` as `[]` when the implementation location is not known
- the legacy file is messy or partial, or one legacy file must split into several ADRs:
  - scaffold each target from the template instead of renaming: `ai-factory adr import "<title>" --status <status> --id <id>`, which writes a conformant skeleton at `<root>/<status-dir>/<id>.md`
  - fill each scaffold as the frontmatter and section rules above require
  - drop the source: `git rm <legacy-file>`
  - expect the skeleton to fail `validate` until it is filled: `import` keeps the template placeholders on purpose

pre_1_6_overlay:
- applies when the ADR was written for a pre-1.6 version of this extension, so its machine fields live in the body
- applies in addition to the file-shape case, never instead of it: the file still has to be moved and rewritten
- hoist `- **Plan:** <id>` to `plan: <id>`
- hoist `- **Evidence:** …` to `evidence: …` as a short string
- hoist `- **Replaced by:** …` to `replaced_by: <new-id>`
- hoist `- **Issue:** …` to `issue: …`
- remove the plan id from `affects`
- delete the emptied `## Implementation` and `## References` sections
- drop the `- **Code:**` line: it was always a duplicate of the `code:` frontmatter

pre_cnlp_overlay:
- applies when the ADR already uses this extension's frontmatter but its body is prose, written before the CNL-P profile
- applies in addition to the file-shape case, never instead of it
- rewrite each `##` section into the blocks the ADR profile declares, keeping the decision unchanged: this is a format change, not a new decision
- run `ai-factory adr validate <file>` after the rewrite: it names every block and every line that is still prose
- do not supersede an ADR to change its format: a rewrite that keeps the decision is a non-material edit

documentation_only_overlay:
- applies when the decision is documentation-only
- applies in addition to the file-shape case, never instead of it
- set `evidence: documentation-only` in the frontmatter
- leave `plan:` empty

instruction_pointer:
```text
> **ADRs:** start with `/aif-adr-overview` (Codex: `$aif-adr-overview`).
> Lifecycle: `propose → refine → accept → plan → implement → finalize`, plus
> `supersede`. Source of truth = the Markdown ADR files under the configured
> ADR root.
```

status_footer:
  format: "✔ aif-adr-migrate · 4 ADRs → 2 active, 1 accepted, 1 superseded · branch: adr-migration"
  source: `ai-factory adr status --json`
  note: the footer carries counts only; the migrated ids are in the mapping output, one row per file

invocation:
- Claude Code: `/aif-adr-migrate`
- Codex: `$aif-adr-migrate`
