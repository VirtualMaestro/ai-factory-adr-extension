# cnlp-kit — take the format to another repository

Authoring material. It is not part of the ADR extension and never ships in its package.

```
node cnlp-kit/export.mjs ../other-project --skills-dir .claude/skills
```

| Flag | Effect |
|---|---|
| `--skills-dir <dir>` | where that repository keeps skills; default `.claude/skills` |
| `--no-test` | skip the conformance test, for a repository without Node |
| `--force` | overwrite the seeded files too; without it an authored profile is kept |

## What lands, and who owns it after

| File | Owner |
|---|---|
| `docs/cnlp-format.md` | the format. Copied verbatim; re-export to update it |
| `profiles/profile.md` | the profile of a profile. Verbatim |
| `tools/cnlp/cnlp.js` | the checker. Verbatim, no dependencies, node builtins only |
| `test/skill-format.test.js` | runs the checker over the skills |
| `profiles/skill.md` | **the target repository.** Seeded with the generic spine; its vocabulary is authored there |
| `docs/cnlp-quality-rules.md` | **the target repository.** A rubric to prune, not a standard |
| `<skills-dir>/cnlp-migrate/SKILL.md` | the migration skill, itself written in CNL-P |

The export reads this repository's live files rather than a second copy, so the kit cannot
drift from the standard it exports. The seeded 3 are never overwritten once authored.

## Order of work

1. export.
2. read `docs/cnlp-format.md`. Nothing below makes sense before it.
3. run `cnlp-migrate`. Its first phase is an inventory: every top-level `key:` the existing
   skills use, mapped onto blocks, which is what fills `custom_sections:` in
   `profiles/skill.md`. **The profile is authored before any skill body is touched.**
4. migrate a single skill end to end, run the check, read the diff. Only then the rest.
5. prune `docs/cnlp-quality-rules.md` and copy the variant a skill needs into its
   `quality_rules:` block, verbatim.

## Without Node

Export with `--no-test`. The standard, the profile and `cnlp-migrate` still apply — the
conformance check is then a reading against `docs/cnlp-format.md` rather than a command, and
`enforcement:` in `profiles/skill.md` should say so. The checker is 1 file with no
dependencies, so adding `node --test` later costs nothing beyond the export.

## What does not travel

- `transitions:` and `status_footer:` — lifecycle conventions of the ADR extension. Add them
  to the profile only if your skills have the same conventions.
- the 24 `custom_sections` names — that vocabulary is about ADRs, plans and lenses.
- `ai-factory adr format` — that command exists because the extension ships its skills into
  *another* project, where the standard is not at the root. A repository that keeps skills and
  standard side by side cites them by path, and the export drops the guard that forbids it.
