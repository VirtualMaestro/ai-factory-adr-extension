---
name: aif-adr-migrate
description: Migrate a project's pre-existing/legacy ADRs into this extension's lifecycle — rewrite each into the template, file it under the right status directory, and repoint stale ADR instructions in AGENTS.md-type files to the new skills.
---

# aif-adr-migrate

Bring an existing body of Architecture Decision Records — written before this
extension was installed (MADR, Nygard, or a homegrown format) — into the audited
lifecycle. **This skill owns the judgment**: reading each legacy decision,
mapping it to a lifecycle status, and rewriting it into the template. The CLI
owns the file mechanics (`init`, `import`, `validate`, `status`, `link-plan`,
`supersede`).

There is no deterministic "migrate" command — legacy formats vary too much to
parse mechanically. You read and map; the commands place and check.

## Preconditions

- An initialized AI Factory project (the `adr` commands gate on `.ai-factory.json`).
- Run `ai-factory adr init` first — idempotent; scaffolds `proposals/`, `drafts/`,
  `accepted/`, `active/`, `superseded/` under the configured root and writes the
  default `.ai-factory/adr-extension.yaml` if absent.
- A **clean working tree**. Create a branch — the whole migration is reviewable
  and revertible there:

  ```text
  git checkout -b adr-migration
  ```

- Read `.ai-factory/adr-extension.yaml` for the configured `adr.root` (default
  `docs/adr`). Use that root everywhere below.

## Workflow

1. **Inventory the legacy ADRs.** **Ask the operator where the legacy ADRs live** —
   there is no reliable way to auto-locate them across projects, and the operator
   knows their own layout. Only if they don't say, fall back to scanning the common
   locations: a top-level `adr/`, pre-existing loose files in `docs/adr/`,
   `docs/decisions/`, `architecture/decisions/`. Read each one. Note its format and
   any existing status/date/title, and whether any two are a replace/deprecate pair.

2. **Map each ADR (judgment).** Decide, per legacy file:
   - **id** — a stable slug, `adr-<lowercase-hyphenated>` derived from the title.
   - **status** —
     - old *accepted/approved* → `accepted`, or `active` **only if** it is
       demonstrably implemented and you can record concrete Evidence;
     - old *proposed/draft/RFC* → `proposed` or `draft`;
     - old *deprecated/replaced* — see step 4. **Do not import it directly as
       `superseded` when its replacement is also being migrated**: import it at
       its prior live status (`accepted`/`active`) and let `adr supersede` move
       it. Import directly as `superseded` **only** when there is no live
       replacement to run the command against (e.g. a decision dropped with no
       successor); then fill the frontmatter `replaced_by:` by hand.

   State the full mapping (old file → id + status) before moving anything.

3. **Move + rewrite, one file at a time.**
   - **1:1 file** (the common case) — preserve history with a rename, then
     rewrite the moved file into the template shape:

     ```text
     git mv <legacy-file> <root>/<status-dir>/<id>.md
     ```

     Then edit that file to match `templates/adr.md`: frontmatter (`id`,
     `type: adr`, `status`, `owners`, `depends_on`, `affects`, `supersedes`,
     `code`, `issue`, `plan`, `evidence`, `replaced_by`) and
     the sections **Context** (Problem / Constraints / Decision drivers),
     **Decision**, **Alternatives considered**, **Consequences** (Positive /
     Negative / Risks). Port the old content into these; legacy code/issue
     references go into the frontmatter `code:` / `issue:` fields, not the body;
     **resolve every template placeholder** — do not leave `[decision]`,
     `not implemented`, etc. The `status` field must equal the directory it now
     lives in. For `active` imports, record a short `evidence:` in frontmatter.
     For `active`/`superseded` imports, backfill `code:` with the primary
     entry-point anchors (repo-root paths, POSIX `/`, optional `#symbol`) when
     the implementation location is known; otherwise leave it `[]`.
   - **ADRs written for pre-1.6 versions of this extension** — the machine fields
     lived in the body; hoist them into frontmatter: `- **Plan:** <id>` →
     `plan: <id>`, `- **Evidence:** …` → `evidence: …` (short string),
     `- **Replaced by:** …` → `replaced_by: <new-id>`, `- **Issue:** …` →
     `issue: …`; remove the plan id from `affects`; delete the emptied
     `## Implementation` and `## References` sections (the `- **Code:**` line
     was always a duplicate of the `code:` frontmatter — just drop it).
   - **Messy/partial legacy, or one legacy file that must split into several
     ADRs** — scaffold each target from the template instead, then fill it and
     drop the source:

     ```text
     ai-factory adr import "<title>" --status <status> --id <id>
     git rm <legacy-file>
     ```

     `import` writes a conformant skeleton at `<root>/<status-dir>/<id>.md`. The
     skeleton keeps template placeholders on purpose — it is *expected* to fail
     `validate` until you fill it.
   - **Documentation-only decisions** — set `evidence: documentation-only` in
     the frontmatter (`plan:` stays empty). Prose in the body does not bypass
     planning.

4. **Reconstruct supersede relationships.** For a replace pair, prefer the
   deterministic command over hand-linking. The command **requires the old ADR to
   be `accepted` or `active`** (it is what performs the move to `superseded/`), so
   migrate both sides at their live status first, then run:

   ```text
   ai-factory adr supersede <old-file> <new-file> [--archive-plan | --delete-plan]
   ```

   It writes `supersedes: [<old-id>]` on the new ADR, a reciprocal
   `replaced_by: <new-id>` into the old ADR's frontmatter, and moves the old ADR
   to `superseded/`. Only when there is no live replacement to supersede against,
   place the old ADR directly in `superseded/` (per step 3) and fill
   `replaced_by: <new-id>` by hand.

5. **Carry over plans (if any).** If a legacy decision referenced an
   implementation plan, place the plan doc under AI Factory's `paths.plans` and
   wire reciprocal links:

   ```text
   ai-factory adr link-plan <adr-file> <plan-file>
   ```

6. **Validate each migrated ADR** and fix until clean:

   ```text
   ai-factory adr validate <file>
   ```

   Clears dir↔status, stem==id, no placeholders, and (for `active`) recorded
   Evidence or documentation-only.

7. **Audit the whole set.**

   ```text
   ai-factory adr status --check
   ```

   Must exit 0 — no duplicate ids, dangling relations, cycles, or ADRs with more
   than one active plan.

8. **Repoint the instruction files.** Legacy projects usually describe their old
   ADR process in `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, or `README.md`.
   Find those stale blocks and **replace** each with a short pointer — do not
   invent new rules, point to the skills:

   > **ADRs:** start with `/aif-adr-overview` (Codex: `$aif-adr-overview`).
   > Lifecycle: `propose → refine → accept → plan → implement → finalize`, plus
   > `supersede`. Source of truth = the Markdown ADR files under the configured
   > ADR root.

   Substitute the actual configured `adr.root` for "the configured ADR root" when
   writing the pointer (default `docs/adr/`).

   Leave everything on the branch for the maintainer to review and merge.

9. **Report the status footer** — end with one line so the scope of this migration is obvious at a
   glance: the count and the ids migrated, by resulting status.

   ```text
   ✔ aif-adr-migrate · 4 ADRs → 2 active, 1 accepted, 1 superseded · branch: adr-migration
   ```

   Take the ids/counts from `ai-factory adr status --json`.

## Rules that hold throughout

- **Source of truth = the Markdown ADR files in Git.** Any prior external index
  or wiki is superseded by the migrated files.
- **Skill owns judgment; the CLI owns file mechanics.** Never hand-edit a
  `status` field to fake a transition or move files outside `git mv` / the `adr`
  commands.
- Migrate onto the branch; keep the diff reviewable. When unsure whether a legacy
  item is a real decision, migrate it as `proposed` rather than inventing an
  accepted rule.

## Invocation

Claude Code: `/aif-adr-migrate` · Codex: `$aif-adr-migrate`.
