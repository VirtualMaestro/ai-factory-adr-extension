# Extracting CNL-P into a standalone repository — analysis

Written 2026-08-08. This is an analysis document, not a governed artifact: it is prose, and it
is deliberately not written in CNL-P.

It covers two repositories:

- `ai-factory-adr-extension` — where CNL-P was invented; currently at package version 2.2.0
- `pure-typescript-reviewer` — the first consumer; carries the export of version 1.18.0

Every file path, line number and quotation below was read in place. Nothing was modified.

---

## 0. Summary

The format is already portable. Of the 331 lines in `docs/cnlp-format.md`, exactly 6 name
`ai-factory` or an ADR command, and the checker in `src/artifacts/cnlp.js` has zero
dependencies beyond Node builtins. `profiles/profile.md` was added in 1.14.0 with no code
change, and `pure-typescript-reviewer` authored two entirely new profiles (`guide`,
`reference`) that also cost no code change. That is three independent confirmations that the
rules-vs-values split holds.

What does not hold is the **distribution model**. `cnlp-kit` pushes a copy into a target
repository, and a copy cannot be upgraded — only overwritten. `pure-typescript-reviewer` is
now two minor versions and 17 lines of checker behind, and its own README documents that
re-unpacking would destroy local work. This is not a bug in the kit; it is what a push model
costs, and it is the reason to invert the direction.

The proposal: a standalone repository that owns the standard, the checker and the generic
profiles, published as an npm package with a CLI. Consumers own only their
`cnlp.config.json`, their `custom_sections` and any local profile. Nothing a consumer writes
is ever overwritten. Starting size is roughly **1300 lines with zero runtime dependencies**,
of which 115 lines of profiles plus 2 tests are genuinely new material contributed by the
second project.

---

## 1. Inventory

Verdicts: **move** (belongs in the standalone repo), **split** (part moves), **stay** (belongs
to the project), **delete** (superseded).

### 1.1 `ai-factory-adr-extension`

| File | Lines | Verdict | Note |
|---|---:|---|---|
| `docs/cnlp-format.md` | 331 | move | 6 project-bound lines to rewrite, plus the examples |
| `src/artifacts/cnlp.js` | 333 | move | parameterize document resolution first |
| `profiles/profile.md` | 62 | move | 2 lines to retarget (`format:`, `enforcement:`) |
| `profiles/skill.md` | 100 | split | generic spine moves; 24 ADR `custom_sections`, `transitions:` and `status_footer:` stay |
| `profiles/adr.md` | 116 | move | generalize `enforcement:` only; the block vocabulary is industry-standard ADR |
| `cnlp-kit/export.mjs` | 130 | delete | superseded by the package |
| `cnlp-kit/README.md`, `seed/BUNDLE-README.md` | 129 | delete | replaced by the repo's own README |
| `cnlp-kit/seed/profiles/skill.md` | 66 | move | this *is* the generic skill profile already |
| `cnlp-kit/seed/quality_rules.md` | 65 | move | strip the `[adr]`-tagged lines into an ADR overlay |
| `cnlp-kit/seed/skills/cnlp-migrate/SKILL.md` | 59 | move | verbatim; already runtime-neutral |
| `test/profile.test.js` | 86 | move | this is the format's own test, not the project's |
| `test/skill-format.test.js` | 44 | move | becomes the config-driven corpus runner |
| `test/adr-format.test.js` | 190 | split | format-rule cases move; lifecycle severity cases stay |
| `test/kit.test.js` | 116 | delete | with the kit |
| `test/skill-rubric.test.js` | 68 | stay | its FULL/SHORT/NONE group lists are this project's |
| `src/lifecycle/validate.js` | — | stay | inv 12, the ADR severity gate; becomes a package consumer |
| `src/decisions.js` | — | stay | reuses `parseBlocks`/`itemsOf`/`loadProfile('adr')` |
| `commands/adr.js` (`format` subcommand, L243-267) | — | stay | serves the docs from the dependency instead of from `docs/` |
| `skills/aif-adr-*` (16), `templates/adr.md` | — | stay | the corpus |

### 1.2 `pure-typescript-reviewer`

| File | Lines | Verdict | Note |
|---|---:|---|---|
| `cnlp/cnlp-format.md` | 332 | delete | stale copy; 3 lines differ from upstream |
| `cnlp/cnlp.js` | 316 | delete | stale copy; 17 lines behind upstream |
| `cnlp/profiles/profile.md` | 62 | delete | stale copy; 1 line behind |
| `cnlp/README.md` | 84 | delete | the kit's bundle README |
| `cnlp/quality-rules.md` | 64 | delete | dead weight here — see finding 9 |
| **`cnlp/profiles/guide.md`** | **53** | **move** | new work; generic except `custom_sections` |
| **`cnlp/profiles/reference.md`** | **62** | **move** | new work; generic except `custom_sections` and the `checks:` note |
| `cnlp/profiles/skill.md` | 76 | stay | its 11 TS-review `custom_sections` are this project's |
| `cnlp/skill-format.test.js` | 97 | split | 2 of 5 tests move; 1 becomes a format feature; 2 become config |
| `.claude/skills/cnlp-migrate/SKILL.md` | 59 | delete | duplicate of the next row |
| `.agents/skills/cnlp-migrate/SKILL.md` | 59 | delete | comes from the package |
| `AGENTS.md`, `ts-reviewer/**` | — | stay | the corpus |

Of the 5 tests in `cnlp/skill-format.test.js`: the skill-corpus and reference-corpus tests
become `corpus` entries in config; the guide test becomes a config entry too; the
profiles-check-themselves loop moves to the standalone repo as a packaged test; and the
`checks:`-line contract test is the one piece of real new signal — see finding 10.

---

## 2. Findings

### 2.1 Structural — why the current model cannot continue

**1. The kit has no upgrade path, only overwrite.**
`cnlp-kit/seed/BUNDLE-README.md:29-30` — "Re-unpacking overwrites the upstream 4 and would
overwrite your 2 as well". The consumer's copy says it more sharply,
`pure-typescript-reviewer/cnlp/README.md:31-32` — "**Re-unpacking would destroy work.** It
overwrites the upstream 3 harmlessly, but `skill-format.test.js` is no longer stock".

The predicted outcome has already happened. `pure-typescript-reviewer/cnlp/README.md:3` stamps
"generated by ai-factory-adr-extension 1.18.0"; upstream is at 2.2.0. Measured drift in the
checker alone: upstream exports `itemsOf`, and `lexiconIssues` gained the "item carries no
word" check and the unclosed backtick/paren/bracket check. The consumer has none of them and
no way to get them without a manual three-way merge.

*Fix:* a versioned dependency. The consumer never holds a copy of the upstream files.

**2. The consumer must edit an upstream-owned file to configure its corpus.**
`test/skill-format.test.js:13` declares `SKILLS_DIR` as a top-of-file constant, and
`cnlp/skill-format.test.js` in the consumer added `REFERENCE_DIR` (`:33`) and `GUIDE_FILES`
(`:77`) beside it. So the one file the exporter overwrites is also the one file every consumer
must edit. The conflict is structural, not accidental.

*Fix:* `cnlp.config.json`, owned by the consumer, naming which profile applies to which glob.

**3. Document resolution is hardcoded, then de-projected by string replacement.**
`resolveDoc` in `src/artifacts/cnlp.js` hardcodes both `'docs/cnlp-format.md'` and the
relative base `` `../../${rel}` ``. `cnlp-kit/export.mjs:88-92` rewrites them:

```js
function retargetChecker(src) {
  return src
    .replace("'docs/cnlp-format.md'", "'cnlp-format.md'")
    .replace('`../../${rel}`', '`./${rel}`');
}
```

Any refactor of those two expressions silently breaks the export; only `test/kit.test.js`
catches it, and only because it executes the unpacked tree.

*Fix:* `loadProfile(name, { root })` and `resolveDoc(name, { root })`. No rewriting.

### 2.2 Correctness — already wrong in a shipped copy

**4. `profiles/profile.md` is exported verbatim while its own paths are project-bound.**
`profiles/profile.md:6` — `format: docs/cnlp-format.md`; `profiles/profile.md:60` —
`` `npm test` (`test/profile.test.js`), over every file in `profiles/` ``.

The kit retargets code but not documents, so in `pure-typescript-reviewer` this file points at
a `docs/` directory that does not exist and a test that was never exported, while its three
sibling profiles correctly say `cnlp/cnlp-format.md`. One repository, two contradictory
answers to "where is the standard". This is the clearest single symptom of finding 3.

**5. The standard hardcodes a profile roster that is false in every consumer.**
`docs/cnlp-format.md:9-10` — "Two profiles ship today, `profiles/skill.md` and
`profiles/adr.md`". The consumer has four profiles and none of them is `adr`.

**6. The standard names the enforcer by a path that only exists upstream.**
`docs/cnlp-format.md:13` — "`src/artifacts/cnlp.js` checks the mechanical rules". In the
consumer it is `cnlp/cnlp.js`.

**7. §7 makes an `ai-factory` CLI the way to reach the standard.**
`docs/cnlp-format.md:261-263` — "**The path in `format:` is inside the extension package** …
From a project, `ai-factory adr format` prints the standard". A repository that does not
install this extension has no such command, and the paragraph is the only guidance the
standard gives on the subject.

**8. A profile meant to be portable leaks a project test path.**
`profiles/skill.md:51` — "the 2 shared rubrics are copied verbatim; test/skill-rubric.test.js
asserts byte-identity within each group". The seed copy in `cnlp-kit/seed/profiles/skill.md`
is the one that travels, so this specific line does not ship — but it shows the pattern:
enforcement details written into the profile rather than into the enforcement layer.

**9. The exported rubric has no enforcement at its destination.**
`cnlp/quality-rules.md` (64 lines) sits in `pure-typescript-reviewer`, but no skill there
carries a `quality_rules:` block, and `skill-rubric.test.js` — the byte-identity test that is
the entire point of a verbatim rubric — was never part of the export. Shipped, unused,
silently rotting. Either the rubric travels with its check or it should not travel.

### 2.3 Format gaps — where the generalization stops short

**10. There is no way to declare an intra-block line grammar.**
`pure-typescript-reviewer/cnlp/profiles/reference.md:39` states the form of a `checks:` line as
prose inside a `note:`:

> `note: "a pattern line reads `<group> — <pattern>: <severity>, <fix>`, a qualifier line reads `<group> — fix:` or `<group> — note:` and carries no severity, and every group holds at least 1 pattern line"`

Because `bodyIssues` checks the *form of a block* and never looks inside a line, the consumer
had to write a bespoke 25-line test (`cnlp/skill-format.test.js:51-75`) with its own
`SEVERITY` regex.

This is a confirmed miss by the project's own stated criterion,
`docs/BACKLOG.md:46-48` — "If it needs a change to `docs/cnlp-format.md` or to
`src/artifacts/cnlp.js`, the generalization did not go far enough — that is the real test of
it." A profile needed a code change, and got a private test instead.

*Fix:* an optional `item_pattern:` record key on a section, checked by the core. It generalizes
immediately: severity scales, ID formats and citation forms are the same shape of rule in any
domain.

**11. Severity is entirely the caller's decision and nothing states the contract.**
`bodyIssues` returns `[{line, message}]` with no severity. `src/lifecycle/validate.js:41-48`
decides it from ADR lifecycle status:

```js
const live = data.status === 'accepted' || data.status === 'active';
for (const { line, message } of bodyIssues(body, await loadProfile('adr'))) {
  (live ? errors : warnings).push(text);
}
```

Every other profile states "any issue is an error" in prose in its `enforcement:` block
(`profiles/skill.md:100`, `cnlp/profiles/guide.md:52`, `cnlp/profiles/reference.md:61`) and
nothing reads it. A consumer has no declarative way to say "warn while a document is a draft,
error once it is live" — it has to write the branch itself, which is exactly what the standard
says a profile exists to prevent.

*Fix:* a severity policy in the config or the profile, read by the runner.

**12. The format has no version of its own.**
`pure-typescript-reviewer/cnlp/README.md:3` stamps the ADR extension's package version. A
consumer cannot answer "which CNL-P do I conform to" without referring to an unrelated tool's
release cadence, and a breaking change to the format is invisible inside a patch release of an
ADR extension.

*Fix:* own semver, own `CHANGELOG.md`, `cnlp --version`.

**13. The examples teach ADR vocabulary as if it were format vocabulary.**
`docs/cnlp-format.md:80` — `1. run `ai-factory adr validate <file>``;
`:93` — `action: `ai-factory adr transition <file> draft``;
`:104-105` — `format: "✔ aif-adr-refine · ADR: <adr-id> [<status>] · Plan: <plan-id or none>"`
with `source: `ai-factory adr status <adr-file>``. §5 also picks `blast radius` as its model of
an "established domain term". A reader learning the format from these examples absorbs an ADR
tool's surface along with the grammar.

*Fix:* neutral examples. A profile-agnostic document (a runbook, a checklist) illustrates every
one of the five forms without naming any tool.

**14. Node is the only implementation, and nothing defines conformance independent of it.**
`cnlp-kit/seed/BUNDLE-README.md:54-58` — "**No Node in this repository?** Delete `cnlp/cnlp.js`
and `cnlp/skill-format.test.js`, and set `enforcement:` … to say the profile is held by review
against the standard." That is an honest answer, and it is also the ceiling on the stated goal
of a format usable by a project of any technology.

*Fix:* a language-neutral conformance corpus — for each case, an input document, a profile and
the expected issue list as JSON. A Python or Go checker then proves itself against the same
cases the Node one passes. This is what makes "any technology" true rather than claimed, and it
is cheap: the cases already exist scattered across `test/adr-format.test.js` (190 lines,
11 tests) and `test/profile.test.js`.

**15. Two byte-identical copies of the migration skill.**
`pure-typescript-reviewer/.claude/skills/cnlp-migrate/SKILL.md` and
`.agents/skills/cnlp-migrate/SKILL.md`, 59 lines each. The kit hands over one folder to move
into whichever agent runs it; it got copied into both. Any edit to one silently diverges.

**16. The acronym is never expanded** in either repository. `docs/cnlp-format.md:1` opens with
"CNL-P format — the standard" and never says what the letters stand for.

---

## 3. Proposed standalone repository

### 3.1 Layout

```
cnlp-format.md              the standard, de-projected
README.md                   what it is, how to adopt it
CHANGELOG.md                the format's own semver
profiles/
  profile.md                the meta-profile
  skill.md                  agent SKILL.md bodies — generic spine
  guide.md                  AGENTS.md / CLAUDE.md — from pure-typescript-reviewer
  reference.md              checklists and protocols — from pure-typescript-reviewer
  adr.md                    architecture decision records — generalized
  plan.md                   new; the open BACKLOG item
src/cnlp.js                 the checker, root-parameterized, zero dependencies
bin/cnlp.js                 check | print <doc> [--path] | init
test/                       the format's own tests
test/conformance/           language-neutral fixtures: document + profile + expected issues
skills/cnlp-migrate/        the migration skill
quality-rules.md            the rubric seed, without the [adr] lines
```

Package name `cnlp` — availability on npm is unverified; `cnlp-format` and `@<scope>/cnlp` are
the fallbacks.

### 3.2 The ownership rule

This is the whole design, and it is worth stating in the repository's README verbatim:

> The package owns the standard, the checker and the generic profiles.
> The consumer owns its `cnlp.config.json`, its `custom_sections`, and any local profile.
> Nothing the consumer writes is ever overwritten.

The kit already invented this split — its README has an "Owner after unpacking" column — but a
file copy cannot enforce it. A package boundary can.

### 3.3 Consumer integration

```json
{
  "profiles": "cnlp/profiles",
  "corpus": [
    { "profile": "skill",     "glob": "skills/*/SKILL.md" },
    { "profile": "reference", "glob": "ts-reviewer/references/*.md" },
    { "profile": "guide",     "glob": "AGENTS.md" }
  ]
}
```

```
npm i -D cnlp
npx cnlp check
npx cnlp print format --path
```

`profiles:` names a directory of local profiles that resolve before the packaged ones. A
consumer extends `skill` by copying it there and adding its own `custom_sections` — the
existing practice, minus the file collision. `npx cnlp init` writes a starter config and a
local `profiles/` directory.

`npx cnlp print` replaces `ai-factory adr format` as the answer to finding 7: it is the
runtime-neutral way to reach a file inside a package from a project root, and it is exactly
what the ADR extension's own command already does — just without the ADR.

---

## 4. Generalization work, in dependency order

1. **De-project the standard.** Findings 5, 6, 7, 13 — 6 lines plus the examples of §3 and §5.
2. **Parameterize `resolveDoc` / `loadProfile` with a root.** Finding 3. Deletes
   `retargetChecker` outright.
3. **`cnlp.config.json` + `bin/cnlp.js check`.** Finding 2. Replaces the edited test constants.
4. **Move `guide.md` and `reference.md` up**, with their `custom_sections` emptied.
5. **Generalize `profiles/adr.md`'s `enforcement:`** so it names a severity policy rather than
   `ai-factory adr validate` (`profiles/adr.md:113`). The other three bullets are already
   tool-independent.
6. **`item_pattern:` on a section.** Finding 10. The one genuine format extension.
7. **Severity policy in the config.** Finding 11. Removes the last reason a consumer writes
   checker code.
8. **Conformance fixtures.** Finding 14. Harvested from `test/adr-format.test.js` and
   `test/profile.test.js`.
9. **Write `profiles/plan.md`.** The open BACKLOG item and the acceptance test for steps 1-8: if
   it costs one file and no code change, the generalization held.

Steps 1-5 are mechanical and could land in a day. Steps 6-8 are the actual design work. Step 9
is the proof.

---

## 5. What each project keeps

**`ai-factory-adr-extension`** — the ADR lifecycle severity gate (`src/lifecycle/validate.js`,
inv 12), the cross-ADR obligation digest (`src/decisions.js`), the rubric group lists
(`test/skill-rubric.test.js`), `ai-factory adr format` now serving from the dependency, the 16
`aif-adr-*` skills, `templates/adr.md`, and the 24 ADR `custom_sections` plus `transitions:`
and `status_footer:` as a local overlay on the packaged `skill` profile.

**`pure-typescript-reviewer`** — its four profiles' vocabularies, `AGENTS.md`, the
`ts-reviewer/` corpus, and a `cnlp.config.json` of 3 corpus entries. It drops 858 lines of
stale copy and one duplicated skill.

---

## 6. Risks

- **`ai-factory adr format` is the documented single path to the standard for an adopting
  project.** `commands/adr.js:243-267`, asserted end-to-end in
  `test/integration/extension-lifecycle.test.js` (npm-pack contents and resolution from an
  installed extension). The split changes what that command reads from, and the integration
  test encodes the current answer.
- **`test/adr-format.test.js` mixes format rules with lifecycle severity.** Splitting the 11
  tests is the fiddliest part of the migration. It belongs to the extension, not to the format
  repository, and should happen after the package exists rather than before.
- **Continued divergence.** Every edit to `cnlp/` in `pure-typescript-reviewer` while the
  standalone repository is being built is another line to reconcile. The cheapest freeze is to
  stop editing that directory now; the two new profiles are the only files there worth
  protecting.
- **`profiles/adr.md` moving out** means the ADR profile's evolution is no longer coupled to
  the extension's release. That is the point, and it is also a coordination cost the extension
  did not have before.
