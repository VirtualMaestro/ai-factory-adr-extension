# cnlp-kit — pack the format for another repository

Authoring material. It never ships in this extension's npm package.

```
npm run kit          # → cnlp-kit.zip at the repository root
```

Then copy `cnlp-kit.zip` into the other project and unpack it **at its root**. The archive is
that project's tree, so every file lands where it belongs. `README.md` inside the archive
takes over from there.

The archive is gitignored and rebuilt on every `npm version`, which is what happens each time
the format changes. Run `npm run kit` by hand for anything in between.

## Why a generator and not a folder of copies

The archive holds a copy of `docs/cnlp-format.md`, but this repository does not. Everything is
read from the live files at build time — a checked-in second copy of the standard drifts from
the original, which is the defect this project has already fixed twice (`blast_radius` in the
standard but not the template; the profile table in 3 places).

## The other mode

```
node cnlp-kit/export.mjs ../other-project [--skills-dir <dir>] [--no-test] [--force]
```

Writes the same set straight into a project instead of packing it. Useful when the target's
skills are not in `.claude/skills`, since the archive fixes that path.

| Flag | Effect |
|---|---|
| `--skills-dir <dir>` | where that repository keeps skills; default `.claude/skills` |
| `--no-test` | skip the conformance test, for a repository without Node |
| `--force` | overwrite the seeded files; without it an authored profile is kept |

## What is in the box

| File | Source | Owner after unpacking |
|---|---|---|
| `docs/cnlp-format.md` | live file, verbatim | upstream |
| `profiles/profile.md` | live file, verbatim | upstream |
| `tools/cnlp/cnlp.js` | `src/artifacts/cnlp.js`, verbatim | upstream |
| `test/skill-format.test.js` | live file, retargeted | upstream |
| `profiles/skill.md` | `seed/profiles/skill.md` | the target repository |
| `docs/cnlp-quality-rules.md` | `seed/quality_rules.md` | the target repository |
| `.claude/skills/cnlp-migrate/SKILL.md` | `seed/skills/…` | the target repository |
| `README.md` | `seed/BUNDLE-README.md`, version stamped | — |

`tools/cnlp/` sits 2 levels under the root, the same depth as `src/artifacts/` here, so
`resolveDoc`'s `../../` resolves without a rewrite. `test/kit.test.js` asserts that rather
than trusting it.

The retargeted test differs in 2 things: the checker's import path, and the `SKILLS_DIR`
constant. It also drops the blocks marked `cnlp-kit:strip` — guards about shipping skills
inside an npm package, which do not hold for a repository that keeps its skills next to its
standard.
