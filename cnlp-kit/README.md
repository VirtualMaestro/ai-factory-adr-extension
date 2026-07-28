# cnlp-kit — pack the format for another repository

Authoring material. It never ships in this extension's npm package.

```
npm run kit          # → cnlp-kit.zip at the repository root
```

Then copy `cnlp-kit.zip` into the other project and unpack it **at its root**. The archive has
2 entries and takes 2 moves: `cnlp/` holds everything the kit brings, and `cnlp-migrate/` is
moved into whichever agent runs it. Deleting `cnlp/` afterwards leaves the root as it was.
`cnlp/README.md` takes over from there.

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
skills are not in `agents/skills`, since the archive fixes that path.

| Flag | Effect |
|---|---|
| `--skills-dir <dir>` | where that repository keeps skills; default `agents/skills`, which names no runtime |
| `--no-test` | skip the conformance test, for a repository without Node |
| `--force` | overwrite the seeded files; without it an authored profile is kept |

## What is in the box

| File | Source | Owner after unpacking |
|---|---|---|
| `cnlp/cnlp-format.md` | live file, verbatim | upstream |
| `cnlp/profiles/profile.md` | live file, verbatim | upstream |
| `cnlp/cnlp.js` | `src/artifacts/cnlp.js`, paths retargeted | upstream |
| `cnlp/skill-format.test.js` | live file, retargeted | upstream |
| `cnlp/profiles/skill.md` | `seed/profiles/skill.md` | the target repository |
| `cnlp/quality-rules.md` | `seed/quality_rules.md` | the target repository |
| `cnlp-migrate/SKILL.md` | `seed/skills/…` | the target repository |
| `cnlp/README.md` | `seed/BUNDLE-README.md`, version stamped | — |

Two rewrites happen on the way out, both mechanical and both asserted by `test/kit.test.js`:

- **the checker** — the standard and the profiles sit beside `cnlp.js` in the kit rather than
  2 levels above it, so `resolveDoc` looks next to itself. The test imports the exported
  checker and resolves every document through it.
- **the check** — the import becomes `./cnlp.js`, `SKILLS_DIR` takes the target's value, and
  the blocks marked `cnlp-kit:strip` are dropped. Those guards are about shipping skills
  inside an npm package and do not hold for a repository that keeps its skills next to its
  standard.

`cnlp-migrate/` is a top-level folder belonging to no runtime: each agent discovers skills in
its own directory, so the kit hands over a folder to move rather than picking one for you. The
packed README says how to wire Claude Code, Codex, or an agent with no skill mechanism at all.
