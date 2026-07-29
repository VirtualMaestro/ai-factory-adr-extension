# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [2.0.1] — 2026-07-29

### Fixed

- **`aif-adr-migrate` looks before it asks.** The skill opened with "where are the legacy ADR
  files?" and scanned the common locations only if the operator stayed silent, so Codex asked
  first while Claude usually scanned first — 1 instruction, 2 behaviours, and the operator got
  the expensive one: they answer "somewhere under docs" while the files sit in
  `architecture/decisions/`. The scan runs first now and reports each path with its count; the
  question survives for the case it was written for, a scan that finds nothing.
- The scan skips the 5 status directories under `adr.root`. A second migration run would
  otherwise pull already-migrated ADRs back through migration, since `docs/adr/` is commonly
  the configured root itself.

## [2.0.0] — 2026-07-29

The audit half of cross-ADR consistency, and the end of the documents the build was steered
by. 1.19.0 gave the corpus a digest; this release gives it a reader that judges the corpus
against itself.

### Added

- **`aif-adr-check-consistency`, the 16th skill.** `aif-adr-verify-all` checks decisions
  against code; nothing checked decisions against each other. This one reads the digest in 1
  pass, names the pairs whose obligations touch the same subject, then opens both ADRs in full
  before any verdict — `contradiction`, `redundant`, or `shared-area`, which is a report line
  and not a defect. There is no pair-matching prefilter: a lexical one misses a session
  colliding with a shopping basket, and the whole digest costs 1 read anyway.
- It recommends `aif-adr-refine` only when 1 ADR of a contradicting pair is still `accepted`.
  Two `active` ADRs, or two `accepted` ones, are named and left to the operator: `supersede`
  takes an explicit old and new ADR, and the conflict does not say which is which. It never
  recommends `depends_on` for an overlap — that edge orders implementation and a spurious one
  blocks `ai-factory adr order` with a cycle.
- **`test/fixtures/consistency-corpus/`** — 14 labelled ADRs, the first checked-in fixture
  directory here. A skill cannot be scored by a unit test, so the corpus carries
  `expected.json`: 3 contradicting pairs (1 per follow-up branch, 1 of them sharing no
  vocabulary), 1 redundant pair, and 2 same-area pairs that must not be called contradictions.
  `npm run corpus` builds a throwaway project pointed at it; 3 cold runs scored 3/3 on the
  contradictions with no false positive and no extra pair.

### Fixed

- **A block written in the wrong form is reported, not silently halved.** `constraints: first`
  with `- second` under it kept only `first` and raised nothing, so the digest claimed to be
  the complete body of obligations while dropping one. The form each required block takes is
  read from `profiles/adr.md`, a mismatch becomes `invalid-block`, and the content is taken
  whole either way.

### Removed

- **The PRD, the MVP build log, the Cognee proposal and the cross-consistency plan.** They
  steered the build and it is built; they stay in Git history. Every link to them is gone —
  `README.md` lost its PRD row, `docs/BACKLOG.md` states the MVP log and the Cognee reasoning
  inline. The `PRD §N` citations in the skill bodies are left alone: they mark where a rule
  came from, not where to read it.

## [1.19.0] — 2026-07-28

### Added

- **`ai-factory adr decisions` — what every accepted and active ADR obliges, in ~8 lines each.**
  A new ADR was written against whichever earlier decisions the agent guessed were related,
  because learning what an ADR says meant opening it: `adr status` prints ids and statuses and
  nothing else. The contradiction then surfaced during implementation. The digest prints
  `decision:`, `constraints:`, `scope:`/`excludes:` and `rules:` for the whole corpus, so 50
  ADRs cost about one ADR file to read. It is derivable without an LLM only because those
  blocks are required by `profiles/adr.md` — the first return on the CNL-P migration.
- **`issues` instead of silence.** A digest that claims to be the complete body of obligations
  and quietly drops a file is worse than no digest, so `unreadable`, `invalid-id`,
  `duplicate-id`, `status-mismatch`, `empty-block` and `invalid-block` are reported per file.
  `invalid-block` catches the case nothing else does: 2 `rules:` blocks in one body, where the
  digest would take the first and say nothing. The exit code stays 0 — the authoring skills
  read this on every run, and an incomplete corpus is a gap to name, not a reason to stop.

### Changed

- **`aif-adr-propose`, `aif-adr-refine`, `aif-adr-plan` and `aif-adr-accept` read the digest.**
  Each already carried the duty and none had the means: propose was told to "read the
  candidates that look related", refine to "record every conflict found with an active ADR",
  accept to check a precondition that conflicts are resolved. `aif-adr-accept` is where a
  draft becomes a rule, so it is also where 2 drafts in flight stop contradicting each other —
  the first one accepted is in the digest by the time the second is.
- **`aif-adr-refine` states where an obligation belongs.** A rule left in the prose of
  `## Context` is invisible to the digest and to every later reader; it goes in `rules:` or
  `constraints:`.
- `itemsOf` is exported from `src/artifacts/cnlp.js`: the digest reads block contents with the
  same parser the checker uses, rather than a second copy of it.

## [1.18.0] — 2026-07-28

### Changed

- **The archive occupies 2 entries at the target root, not 7.** It unpacked `docs/`,
  `profiles/`, `tools/`, `test/` and a skill folder straight into the project — scattered
  leftovers from something needed once. Now `cnlp/` holds everything the kit brings and
  `cnlp-migrate/` sits beside it, so unpacking is 2 moves: copy `cnlp/` to the root, move
  `cnlp-migrate/` into whichever agent runs it. Deleting `cnlp/` afterwards leaves the root
  exactly as it was.
- **The checker is retargeted instead of relying on depth.** The old layout put `cnlp.js` 2
  levels under the root so `resolveDoc`'s `../../` resolved by luck of matching depth; the
  standard and the profiles now sit beside it, and the export rewrites those 2 path
  expressions. Content is still verbatim from the live file, and `test/kit.test.js` imports
  the exported checker and resolves every document through it rather than trusting the rewrite.
- `SKILLS_DIR` now means only "where this repository keeps its skills", with no relation to
  where `cnlp-migrate` was moved, and the check refuses to run with a clear message when that
  directory does not exist — instead of an `ENOENT` from `readdir`.

## [1.17.1] — 2026-07-28

### Fixed

- **The archive no longer names a runtime.** It put `cnlp-migrate` in `.claude/skills/`, which
  picks 1 agent for a kit that is about a document format. The skill is stored at
  `agents/skills/cnlp-migrate/SKILL.md`, which belongs to no runtime; the packed README says
  how to make it invocable in Claude Code, in Codex, or in an agent with no skill mechanism at
  all — where the body is read by path, the slash command being only a shortcut to it. Storing
  it neutrally means a second agent costs a copy rather than a fork.
- `SKILLS_DIR` in the exported test defaults to `agents/skills` accordingly, and the kit test
  asserts the archive contains no `.claude/` entry.

## [1.17.0] — 2026-07-28

### Changed

- **The kit is delivered as an archive, not as a script pointed at another repository.**
  1.16.0 required running `node cnlp-kit/export.mjs ../other-project` from here, which is the
  wrong shape for "give me something I can copy". `npm run kit` now writes `cnlp-kit.zip`: the
  target project's tree, so unpacking it at a project root puts every file in place, with a
  version-stamped `README.md` as the entry point. The archive is gitignored and rebuilt by the
  `version` lifecycle script, so every version bump — which is what happens each time the
  format changes — refreshes it.
- **The generator stays, because the copies must not drift.** This repository still holds no
  second copy of `docs/cnlp-format.md`; the archive is built from the live files each time.
  The direct mode (`export.mjs <target>`) remains for a target whose skills are not in
  `.claude/skills`.
- `test/skill-format.test.js` reads a `SKILLS_DIR` constant instead of inlining the path, so a
  repository with another layout edits 1 line — which is what the packed README tells it to
  do. The export rewrites that constant rather than pattern-matching `path.join` calls.
- `adm-zip` added as a devDependency: write-only use, no transitive dependencies, and
  devDependencies never reach the published package. `npm audit` reports 0 vulnerabilities;
  a pre-existing high-severity advisory in `fast-uri`, transitive through `ajv`, was resolved
  in the same pass.

### Verified

- `test/kit.test.js` unpacks the built archive into a temp directory and runs
  `node --test test/skill-format.test.js` inside it. The unpacked kit checks its own migration
  skill with nothing pointing back to this repository — that is the delivery, asserted rather
  than described.

## [1.16.0] — 2026-07-28

### Added

- **`cnlp-kit/` — the format, portable to another skill repository.** The standard, the
  checker and the profile-of-profiles were general already; what was missing was a way to put
  them in a repository that has its own skills. `node cnlp-kit/export.mjs <target>` lands the
  standard, `profiles/profile.md` and the checker verbatim, seeds `profiles/skill.md` with the
  generic spine, seeds the rubric to prune, writes a retargeted conformance test, and installs
  the `cnlp-migrate` skill. `--skills-dir` follows the target's layout, `--no-test` covers a
  repository without Node, `--force` overwrites the seeds, which are otherwise kept once
  authored.
- **The export reads the live files, never a second copy of them.** One fact in 3 places is
  how `blast_radius` and the profile table drifted here; a kit holding its own copy of the
  standard would repeat it on a longer cycle.
- **`cnlp-migrate` — the skill the agent is given in the target repository.** It is written in
  CNL-P and `test/kit.test.js` asserts it conforms to the profile it exports, because a
  migration skill that breaks the format it teaches is worthless. Its first phase is an
  inventory of every top-level `key:` the existing skills use, which is what fills
  `custom_sections:` — the profile is authored before a body is touched. Its
  `forbidden_behaviors` carry what went wrong here: no invented rule, no silent drop, no block
  the profile does not declare, no behaviour change smuggled into a format change.

### Changed

- `test/skill-format.test.js` marks its packaging guard with `cnlp-kit:strip` markers. That
  guard exists because this extension ships its skills into *another* project; a repository
  that keeps skills and standard side by side cites them by path on purpose, so the export
  drops it.

## [1.15.1] — 2026-07-28

### Added

- **`ai-factory adr format [name]` — the format, reachable from the project that uses it.**
  The skills told the agent to follow `profiles/adr.md` and `docs/cnlp-format.md §5`, paths
  that resolve in this repository and nowhere else: `extension add` copies the package to
  `<project>/.ai-factory/extensions/ai-factory-adr-extension/` while the skills are installed
  to `.claude/skills/`, so an agent writing an ADR in a real project had no source for the
  format — only `adr validate` rejecting its guesses afterwards. The command prints the
  standard, `adr format adr` a profile, `--path` the resolved location to open directly, and
  `--json` all of it. Paths are resolved inside the package by `resolveDoc`, the function
  `loadProfile` already used.

### Changed

- **8 path citations across 5 skills are gone.** 7 of the replacements name the command, in
  `aif-adr-propose`, `aif-adr-refine`, `aif-adr-accept` and `aif-adr-migrate`; the remaining
  3 lines — 2 in `aif-adr-migrate`'s case tables, 1 in `aif-adr-finalize` — say "the ADR
  profile" in prose, because they state a rule rather than send the reader anywhere.
  `aif-adr-propose` and `aif-adr-migrate` read the standard *and* the profile as a workflow
  step, since they are the 2 skills that author a body from nothing.
- `docs/cnlp-format.md` §7 states that `format:` is a path inside the extension package, and
  that a document naming one of these files by path is naming something its own reader cannot
  find.
- `test/skill-format.test.js` fails on any bare `profiles/…` or `docs/cnlp-format.md` in a
  skill body, and the integration suite installs the extension into a temp project and asserts
  `adr format adr --path` resolves under `.ai-factory/extensions/` — the assertion is where
  the question is actually decided.

### Fixed

- **`resolveDoc` rejects a name that is a path.** `adr format ../docs/cnlp-format` walked out
  of `profiles/` and printed any markdown file it could reach. The name arrives from a command
  line and names a document, so it now matches `^[a-z][a-z0-9-]*$` or is refused, which covers
  every caller rather than the command alone.
- **The tarball is checked, not assumed.** The packed-install test asserts
  `docs/cnlp-format.md` and all 3 profiles are in `npm pack --json` output and that the packed
  install serves `adr format adr`. Every other integration test installs the checkout, where
  dropping an entry from `package.json` `files` is invisible.

## [1.14.1] — 2026-07-28

A second review pass. 4 findings, all accepted; 1 of its proposed fixes was solved in the
skill rather than in the CLI, with the reason stated below.

### Fixed

- **No skill is exempt from its profile any more.** `aif-adr-overview` lacked the required
  `workflow:` and `test/skill-format.test.js` deleted that one error — a specialization
  living in the test instead of in the profile. It now declares
  `workflow: - none: …reference material…`, using the universal empty form, and the test has
  no exception left.
- **The `- none` sentinel no longer contradicts itself.** It passed in an optional block,
  which the standard says to delete rather than mark, and it passed beside real items, which
  says the block is both empty and not. Both are rejected: the sentinel belongs to a required
  block and is its whole content.
- **3 lifecycle skills checked the ADR at the wrong moment.** `aif-adr-refine` validated at
  step 1 and edited at step 10, so it judged the file it then replaced; `aif-adr-reconcile`
  validated before applying its adopted changes; `aif-adr-finalize` never validated before
  `adr finalize` moved the ADR to `active`, where body issues become errors. Each now
  re-validates the file it wrote.
- **`aif-adr-finalize` no longer sends implementation prose to the ADR body.** The ADR
  profile declares every block an ADR has and none of them holds a build log, so the detail
  goes to the plan or to the tracker named by `issue:`.

### Not done, and why

- **`adr status --check` still reports errors only** (`src/status.js`), which is why a
  warning on a `draft` ADR is invisible in the aggregate. Surfacing warnings there would put
  every unmigrated legacy ADR into the output of a cross-artifact audit that exists to gate
  exit codes. The skills that edit an ADR now run `adr validate <file>` on it instead, which
  is the command that owns per-file findings.

## [1.14.0] — 2026-07-28

An external review of 1.13.x found that the profiles promised more than the checker
delivered. Every finding is addressed below; nothing new was added to the format.

### Fixed

- **Structurally ambiguous documents used to pass.** A repeated top-level block, a repeated
  or unknown `##` heading, a repeated key inside a record, and blocks sitting before any
  heading were all silent. Each is now reported, and the headings are checked for sequence,
  not only for presence.
- **Forms allowed conflicting data.** A repeated record key silently overwrote the first
  value, a keyed-block accepted sub-keys the profile never declared, and a numbered-list
  checked `N. ` without checking that the numbers run `1..n`. All three are reported — a
  second copy of a value is two readings of one document. This immediately found a real one:
  `aif-adr-next` carries `empty_form:` in its `status_footer:`, which the profile now
  declares.
- **The standard contradicted the checker in 2 places.** `- none` with the reason is now
  accepted as the whole content of a block in any form, where a record-list previously
  produced 5 errors for the form the standard prescribes; and a block whose content is a
  fenced region is no longer read as empty. A scalar is stated to have no empty form, which
  is what the check already did.
- **The 250-character hard limit now covers every line outside a fence**, not only bullets
  and steps. §4 said "a line" and meant it; a long scalar or record sub-key passed.
- **A profile typo no longer reads as a default.** `required: ye` became `no` — the check the
  profile meant to declare, silently gone. `readProfile` rejects any `required` or `form`
  value outside its domain at load.
- `package-lock.json` said 1.7.0 while `package.json` said 1.13.1. Bumped through
  `npm version`, so the two stay in step.
- **3 skills stated `- none` without its reason** — `aif-adr-next` and `aif-adr-verify-all`
  separated it with a semicolon, `aif-adr-overview` gave none at all. Fixed, and the reason
  is now required by the check: a bare `- none` states an absence and explains nothing.

### Changed

- **The profile contract states what the checker reads.** `headings`,
  `frontmatter_fields`, `sections` and `custom_sections` shape the check; `format`, `mood`,
  `lexicon_exempt`, `enforcement` and every `note:` are for the reader — a mood is a
  register, not a grammar, and `lexicon_exempt` names frontmatter fields, which no body check
  sees. The promise is labelled instead of over-claimed.
- **`custom_placement:` left `profiles/skill.md` for the standard.** It was a rules block in a
  file the standard says declares values only, and its content holds for every profile. The
  rule also gained the distinction the corpus already made and the old wording denied: a
  **term** the steps use without introducing it goes before them, while a **case table** a
  step names at the point of use goes after — which is why `aif-adr-migrate` keeps
  `status_mapping` and `file_shape` below its workflow instead of burying the steps under
  55 lines of tables.
- **`profiles/profile.md`: a profile is checked by the same machinery as everything else.**
  It declares the 8 profile blocks, and `test/profile.test.js` runs `bodyIssues` over all 3
  profile files, `profile.md` included — it conforms to itself. That closes the gap where a
  profile could carry an unknown or missing block undetected, and it is the third profile
  added with no new code, which is what §7 claims is possible.

## [1.13.1] — 2026-07-28

### Fixed

- **A profile now names the format it obeys.** 1.13.0 pointed the format at its profiles but
  not back, and the skills send the agent to `profiles/adr.md` — a file that lists blocks and
  forms and never mentions the lexicon, the line rules or what `bullet-list` means. Every
  profile carries `format: docs/cnlp-format.md` as its first block, `readProfile` returns it,
  and `test/profile.test.js` asserts it is declared and resolves, so a third profile cannot
  ship orphaned. The chain closes: skill → profile → format, one hop each.

## [1.13.0] — 2026-07-28

### Changed

- **One format, no profile branching.** `docs/cnlp-format.md` carried 13 passages of the
  form "for skills …, for ADRs …". Each one was a decision the agent had to re-make on every
  read, and the branching cost most where it helped least: skills are migrated once, ADRs
  are written continuously. The spec now states rules only; the words "skill" and "ADR"
  appear nowhere in it outside fenced examples and the pointer to the profiles.
- **A profile is a document, not a section of the spec.** `profiles/skill.md` and
  `profiles/adr.md` are themselves CNL-P, and they declare values rather than rules: `mood`,
  `headings`, `frontmatter_fields`, `lexicon_exempt`, `sections` (key, form, required,
  heading, record keys), `custom_sections`, `enforcement`. A third kind of document is a
  third file, with no change to the format and no new code.
- **The profile table stopped living in 3 places.** It was in the spec, in
  `src/artifacts/cnlp.js` and in `test/skill-format.test.js` — which is how `blast_radius`
  came to be required by the standard and absent from the template. One
  `bodyIssues(raw, profile)` now serves `ai-factory adr validate` and the skills test;
  `adrBodyIssues` and the test's 8 hand-written checks are gone.
- **The limit rule is universal, and stated more precisely.** It was ADR-only because the
  operator form reads badly in an instruction (`states = 1 primary decision`). The real
  split is grammatical, not by document kind: a limit that stands alone is written
  `<subject> <operator> <value> <unit>` (`open connections per client <= 2`), while a number
  that is a determiner inside a sentence keeps its digit form (`present at least 2 viable
  approaches`). The check rejects only phrases whose bound is open — `no more than`,
  `at most`, `up to`, `not exceeding`, `no fewer than`, `not less than`. No skill line uses
  those, so no skill body changed.
- **The comparative ban is universal**, with a new universal exemption: quoted or backticked
  text is data, not a claim the document makes. That is what keeps
  `do not accept "faster to write" as justification` legal.
- **"The body holds no machine field" became "no block restates the frontmatter"**, and the
  empty-block convention — `- none` with the reason, or delete the optional block — is
  stated once instead of twice in different words.
- New: a block declaring a `heading:` is now checked to sit under it, and a section key may
  contain digits (`pre_1_6_overlay` was invisible to the old parser).
- `test/profile.test.js` asserts both profiles parse, name only the 5 declared forms, and
  keep their record-list keys — a typo in a profile would otherwise silently disable a check.

### Fixed

- **`package.json` `files` now ships `profiles/` and `docs/cnlp-format.md`.** Skills tell the
  agent to follow the standard by path, and that path did not exist in an adopting project.

## [1.12.0] — 2026-07-28

### Added

- **The ADR body is now checked by `ai-factory adr validate` (inv 12).** The CNL-P profile
  was held by review only, so an ADR could be born in prose and stay there. Validate now
  reports the 4 `##` headings, every required §7 block, its form, the record keys on
  `alternatives`, machine fields that belong in the frontmatter, and the §8 lexicon.
- **The severity follows the lifecycle.** Non-conformance is a warning while the ADR is
  `proposed`, `draft` or `superseded`, and an error once it is `accepted` or `active` —
  the same gate inv 6 already uses, because that is where the document becomes a rule.
  **Existing ADRs in an adopting project must run `aif-adr-migrate`**, which gains a
  `pre_cnlp_overlay` for a prose body already in this extension's frontmatter format.
- **`src/artifacts/cnlp.js` — one grammar module for both profiles.** The parser and the
  lexicon regexes lived in `test/skill-format.test.js`; they now serve the test and
  `validate` from one place, so a rule cannot drift between them.
- **§8: a limit is written as a comparison — ADR profile.** `<= 2 open connections per
  client`, not `no more than two connections`. The phrase leaves the reader to work out
  whether the bound is inclusive; the operator makes the author decide once, when the
  decision is made. The unit stays attached, and the rule never fabricates a threshold the
  decision did not make. The skills profile keeps the phrase form: a skill line is read as
  an instruction.
- **§8: an unquantified comparative is not a decision — ADR profile.** `better`, `faster`,
  `significantly`, `flexible`, `where possible`, `should probably` and their neighbours are
  replaced by the property and its bound, or dropped.

### Changed

- **§7 states what a conformant ADR contains.** The block table gains a required column and
  a declared order; `blast_radius` is optional and now ships in `templates/adr.md`, which
  disagreed with the standard.
- §7 states 3 rules that existed only inside a skill or not at all: the body holds no
  machine field, an empty required block carries `- none` with its reason, and an ADR block
  is a statement in the present tense while a skill block is an instruction.
- §3 resolves its own contradiction with §7: records in one section share their keys, except
  for a key the profile declares optional — `kept_as` is the only one today.
- **`templates/adr.md` no longer invites a §9 violation.** `decision:` shipped as
  `we will use [decision] for [scope] because [main reason]`, restating two blocks that own
  those facts in the one line that should carry only the choice. `[scope]` and
  `[main reason]` stay in the sentinel list for ADRs scaffolded from the older template.
- `aif-adr-propose`, `aif-adr-refine` and `aif-adr-accept` name the CNL-P blocks instead of
  the prose headings, and `aif-adr-supersede` states that a rewrite into CNL-P is a
  non-material edit — the same decision in a different shape is not a supersession.
- The worked example at `docs/proposals/` is deleted. It predated the profile and broke it
  in 3 ways while §7 told authors to copy its style; the §7 code block is the example.

## [1.11.4] — 2026-07-28

### Changed

- **`docs/cnlp-format.md` reframed as a document format with profiles.** It was written
  straight after the skill migration and read as a skills document with an ADR section
  appended, which let skill assumptions be stated as universal rules. The format is general;
  skills (§5) and ADRs (§7) are the two profiles defined today, and a third is added by
  writing its section vocabulary rather than by changing §2–§4 or §8–§10.
- **Fixed a rule that contradicted what shipped.** §2 stated "No H1" without qualification,
  while `templates/adr.md` and the worked example both carry one. H1 and `##` headings are
  now per-profile: a skill has neither, an ADR has an H1 decision title and 4 `##` headings.
- §2 also states the boundary the ADR profile already relied on: a section ends at the next
  unindented `key:` **or** at the next `##` heading.
- §1's rationale covered only executed documents; it now covers consulted ones on the same
  grounds — neither reader should have to reconstruct the structure before using the
  content.
- Scoped the remaining leaks: the 72-character median is attributed to the migrated skills,
  the frontmatter `description` exemption is marked skills-profile, and §10's final step
  runs the profile's check — `npm test` for a skill, `ai-factory adr validate` for an ADR.
- §9 gains ADR examples, so the no-restatement rule has teeth in both profiles:
  `constraints` versus `decision_drivers`, `negative` versus `risks`, and
  `rejected_because` versus `negative`.
- §7 now warns that the worked example predates the profile — it names its first heading
  `## Problem` rather than `## Context` and promotes two optional blocks to headings. Copy
  its register, not its heading set.
- Stated what is enforced: the conformance test covers the skills profile only. This
  repository ships the ADR lifecycle for other projects and holds no ADRs of its own, so
  the ADR profile is held by review and by `ai-factory adr validate`.

## [1.11.3] — 2026-07-27

### Changed

- **A threshold is now written as a digit.** `exactly 1 primary decision`,
  `at least 2 viable approaches`, `more than 1 non-archived plan` — 28 occurrences across
  the skills and the standard. A digit stands out against lowercase prose and reads as a
  parameter rather than as a word that has to be mapped to a number first; spelling out
  numbers under ten is a prose-style convention, which is the register this format left.
- Numbers that are **not** thresholds stay words: inside an idiom (`two ways of doing one
  thing`), inside a hyphenated adjective (`one-line`, `two-space-indented`), or as an
  ordinal (`first refine`). Digits there read as a typo.
- `docs/cnlp-format.md` §8 states the rule and the split between what the test enforces —
  a number after `at least`, `exactly`, `more than`, `fewer than`, `no more than`, `only` —
  and what stays a judgment call, mirroring §4's 150-character target versus 250-character
  hard limit.
- `test/skill-format.test.js` gains that assertion, verified to fire before being trusted.

## [1.11.2] — 2026-07-27

### Added

- **`test/skill-format.test.js` — conformance check for the CNL-P grammar.** Seven
  assertions: required sections present, no section name outside the known vocabulary,
  standard sections in their declared order, `status_footer:` sub-keys indented, no bullet
  opening with `never`, no deny-list word, no bullet over the 250-char hard limit. It parses
  the body with fenced regions blanked, so the `id:`/`type:` lines inside a fenced example
  are not mistaken for sections.
- **`templates/adr.md` rewritten in CNL-P.** `## Context` now carries `problem`,
  `constraints`, `decision_drivers`; `## Decision` carries `decision`, `scope`, `rules`;
  alternatives are `id`/`description`/`rejected_because` records; consequences are
  `positive`, `negative`, `risks`. The four headings and every placeholder sentinel are
  unchanged, so `ai-factory adr new` still scaffolds a file that validates as a proposal and
  is rejected at `accepted` until filled. **Without this a new ADR was born non-CNL-P and
  the standard's ADR section applied to nothing.**

### Changed

- **`docs/cnlp-format.md` made self-consistent.** It defined where a section ends but never
  what one contains. Added: five section types (scalar, bullet-list, numbered-list,
  record-list, keyed-block) with their indentation; fenced blocks declared opaque; nesting
  allowed for record-lists and keyed-blocks, not only cases; the required-section set;
  a rule for adding a custom section plus the 23 already in use; a 250-char hard limit with
  150 as the target. The "any growth is a defect" rule was wrong — splitting one prose
  sentence into the obligations it hid legitimately adds lines — and now reads "measure it
  and state the cause".
- **`status_footer:` grammar fixed in 13 skills.** `format:`/`source:` were unindented, so
  by the standard's own rule they were separate top-level sections and `status_footer:` was
  empty.
- **Duplication removed.** The redundant `status footer` bullet in `outputs:` (12 skills);
  `scope:` in `aif-adr-propose` and `aif-adr-implement`, which restated `workflow:`;
  `outputs:` in `aif-adr-plan`, which restated `purpose:`; and the verification-failure
  clause duplicated between `forbidden_behaviors` and the workflow in `aif-adr-finalize`.
- **`aif-adr-overview`** lists both skill groups as tables of skill → does → constraint. Its
  bullets ran to 305 characters against a corpus median of 72.
- Compound lines split in `aif-adr-migrate` and `aif-adr-finalize`.

## [1.11.1] — 2026-07-27

### Added

- **`docs/cnlp-format.md` — the CNL-P format standard.** The rules that produced the 1.11.0
  skill rewrite, written down once: file shape, the section vocabulary for skills and for
  ADRs, line rules, the lexicon with its deny-list, the no-section-restates-another rule,
  and the migration procedure. It is the reference for migrating ADR documents next, and
  the place to extend when the format grows.

### Changed

- **Lexicon applied to all 15 skills.** `ensure` → `verify`, `surface` → `report`, and one
  reworded `sharpens`. Prohibition is now a single term: 25 bullets opening with `never`
  became `do not`, so one concept is written one way across the corpus.
- **`aif-adr-supersede` deduplicated.** One rule was stated three times — as a
  precondition, a `forbidden_behaviors` bullet, and a workflow step — and `outputs:`
  repeated `command_behaviour:`. Both removed; the workflow now names the check instead of
  restating the rule.

### Removed

- `docs/proposals/cnlp-pilot/` — pilot material for a format that was not adopted. Its
  test files were also being picked up by the bare `node --test` script, inflating the
  suite from 94 to 109.

## [1.11.0] — 2026-07-27

### Changed

- **All 15 skill bodies rewritten in CNL-P form.** Every `skills/aif-adr-*/SKILL.md` body is
  now a flat set of `key:` sections — `purpose`, `inputs`, `preconditions`, `scope`,
  `forbidden_behaviors`, `outputs`, `quality_rules`, `workflow`, `transitions`,
  `status_footer`, `invocation` — with one idea per bullet and a numbered workflow, instead of
  documentation prose. Narrative connective tissue is gone; every rule the prose carried is
  kept. Corpus size **1353 → 1155 lines, 68404 → 63591 bytes**. YAML frontmatter is untouched,
  so skill discovery and routing are unaffected.
- **`test/skill-rubric.test.js` repointed** from the `## Evaluating solutions` heading to the
  `quality_rules:` section. It still asserts the rubric appears exactly once per target skill,
  precedes the workflow, is byte-identical within the long-variant and short-variant groups,
  and is absent from the five skills that never carried it.

### Fixed

- **`aif-adr-migrate`: the four step-3 branches were not mutually exclusive.** 1:1-versus-split
  is the movement method, pre-1.6 is a source-format property, and documentation-only is a
  property of the decision — one legacy file can be all three. Read as a single exclusive
  list, a pre-1.6 ADR would have its frontmatter hoisted and never be moved or rewritten. The
  movement cases are now a `file_shape` choice of exactly one, with `pre_1_6_overlay` and
  `documentation_only_overlay` applied on top.
- **`aif-adr-migrate`: "deprecated with no successor" was unimplementable.** It instructed
  filing the ADR as `superseded` and hand-filling `replaced_by:`, but `validate` rejects a
  `superseded` ADR with an empty `replaced_by:` (inv 11), so its own validation step could
  never pass. That case now stops and asks the operator which status the decision should carry.
- **`aif-adr-migrate`: the status footer contradicted itself.** It required reporting "the
  count and the ids migrated" while the format string it mandated has no slot for ids. Ids
  now live in the mapping output, one row per file; the footer stays count-only.

## [1.10.0] — 2026-07-22

### Added

- **New skill `aif-adr-verify-all`.** Runs the `aif-adr-verify` conformance check over **every
  active ADR** in one sweep and reports an aggregated verdict table (implemented / partial /
  drift / not-implemented / doc-only), sorted worst-first, plus a summary footer with per-verdict
  counts. Read-only — never edits an ADR or the code. Scope is **active** ADRs only: an
  `accepted` ADR is decided but not yet implemented (a half-implemented one stays `accepted`
  until finalize), so there is no finished code to judge — those stay with `aif-adr-next` /
  `aif-adr-implement`. No new CLI code — it orchestrates the existing `ai-factory adr status`,
  `verify-anchors`, and `resolve-plan` commands. Carries the evidence/deviation "Evaluating
  solutions" rubric, matching the single `aif-adr-verify`.

## [1.9.0] — 2026-07-21

### Added

- **"Evaluating solutions" decision-quality rubric in nine skills.** The judging skills now
  carry an explicit rubric so recommendations are ranked by what serves the project long-term,
  not by session-local convenience ("faster", "easier", "smaller diff"). Two variants:
  - **Full rubric** (design-time, open solution space): `aif-adr-propose`, `aif-adr-refine`,
    `aif-adr-reconcile`, `aif-adr-plan`, `aif-adr-plan-improve` — invariants and concrete
    grounds behind every judgment, at least two viable alternatives for architectural changes,
    agent convenience banned as an argument while blast radius stays a named cost, honest
    presentation of the correct-but-costlier option, and position changes only on new facts —
    never on mere pushback.
  - **Evidence/deviation variant** (decision already made): `aif-adr-implement`,
    `aif-adr-verify`, `aif-adr-finalize`, `aif-adr-accept` — grounded verdicts, deviations
    surfaced instead of quietly absorbed, tactics follow existing conventions.

  `aif-adr-next` (deterministic dependency ordering) and `aif-adr-migrate` (own explicit
  mapping rules) are deliberately excluded. A new `test/skill-rubric.test.js` keeps the copies
  byte-identical within each variant group and correctly positioned.

## [1.8.0] — 2026-07-21

### Added

- **New skill `aif-adr-reconcile`.** After a refine, a second reviewer often proposes further
  improvements to an ADR or its plan. This skill encodes the prompt you kept retyping: it
  critically adjudicates each suggestion (ADOPT / PARTIAL / REJECT, each with a one-line
  justification), applies the adopted ones to the document, and rejects the rest — a second
  opinion is treated as input, not instruction. It detects whether the target is an ADR or a plan
  and judges with the matching lens (ADR-specific criteria, as `aif-adr-refine`; stock
  `aif-improve` semantics, as `aif-adr-plan-improve`). It never advances status, implements, or
  touches frontmatter/links. No new CLI code.

## [1.7.0] — 2026-07-21

### Added

- **New skill `aif-adr-plan-improve`.** Improve an ADR's implementation plan by naming the
  **ADR**, not the plan file: it resolves the single active plan via
  `ai-factory adr resolve-plan <adr-file>` and applies the stock `aif-improve` semantics to it.
  Removes the friction of having to remember or look up the plan's path. No new CLI code — it
  reuses existing plan resolution.

### Changed

- **Every single-ADR skill now ends with a one-line status footer** naming the ADR (and its
  plan, where relevant), so a run's context is obvious at a glance when switching between many
  parallel sessions — e.g. `✔ aif-adr-plan · ADR: <id> [accepted] · Plan: <plan-id>
  (in_progress)`. Fields come from the existing `ai-factory adr status <adr-file>`. Read-only
  reporters `aif-adr-status` / `aif-adr-overview` are unchanged. Some skills' existing free-text
  report steps were standardized to this format.
- **`aif-adr-plan`'s "Improving the plan" note** now points at `aif-adr-plan-improve` as the
  by-ADR-name shortcut (the manual `resolve-plan` → `aif-improve` path is still documented).

## [1.6.0] — 2026-07-21

### Changed

- **ADR machine state moved from the body into frontmatter.** The plan link, implementation
  evidence, and supersede back-reference are now structured frontmatter fields — `plan:`,
  `evidence:`, `replaced_by:` — instead of `- **Plan:** / - **Evidence:**` lines in a
  `## Implementation` section and a `- **Replaced by:**` reference line. The section and the
  reference line are removed from the template; the ADR body is now pure decision content and
  is never rewritten by `link-plan`, `finalize`, or `supersede`. Semantics: empty `plan:` =
  no plan yet; empty `evidence:` = not implemented (a filled `plan:` with empty `evidence:`
  is the pending state — the old `Evidence: pending` convention is gone); `evidence:
  documentation-only` marks a doc-only decision (replaces the `Plan: not required` sentinel);
  `replaced_by:` holds the superseding ADR **id**, not a relative path.
- **The `## References` section is gone too.** Its `- **Code:**` line was always a duplicate
  of the machine-read `code:` frontmatter array; its `- **Issue:**` line moved to a new
  frontmatter `issue:` field (external tracker link or ticket id). Nothing parsed either body
  line. With `## Implementation` and `## References` both removed, the ADR body is pure
  decision content (Context / Decision / Alternatives / Consequences).
- **`link-plan` no longer writes the plan id into `affects`.** That relation is reserved for
  genuinely affected artifacts. Consequence: the parent `ai-factory audit-artifacts` warning
  "Accepted ADR without `affects` links" reappears while `affects` is honestly empty — this is
  expected and acceptable.
- **`validate` reads the frontmatter fields** (inv 10 on `evidence:`, inv 11 on
  `replaced_by:`) and gains a denormalization guard: a `plan:` value with no plan (live or
  archived) implementing the ADR is warned about. Legacy body-format ADRs fail inv 10 with a
  hint to run `aif-adr-migrate`, which now documents the body→frontmatter hoisting steps.
- **`adr status <file>` JSON** now reports `plan` (declared frontmatter link) alongside
  `activePlan`, and `evidence` / `replacedBy` come from frontmatter (`replacedBy` is an id,
  not a path).

### Migration

For each pre-1.6 ADR: hoist `- **Plan:** <id>` → `plan: <id>`, `- **Evidence:** …` →
`evidence: …`, `- **Replaced by:** …` → `replaced_by: <new-id>`, `- **Issue:** …` →
`issue: …`; remove the plan id from `affects`; delete the emptied `## Implementation` and
`## References` sections (`- **Code:**` was a duplicate of the `code:` frontmatter — drop it).
`/aif-adr-migrate` covers this.

## [1.5.1] — 2026-07-18

### Fixed

- **Release metadata.** The 1.5.0 tarball shipped `extension.json` still pinned at `1.4.1`, so
  `ai-factory extension update` reported `v1.4.1 → v1.4.1` and skipped the upgrade even though
  the files were copied. No skill or command content changed; 1.5.1 republishes the 1.5.0
  content with correct version metadata. A `prepack` guard now aborts publishing whenever
  `package.json` and `extension.json` disagree.

## [1.5.0] — 2026-07-18

### Changed

- **`aif-adr-refine` is now explicitly refinement-only.** The skill had no stated scope
  boundary, so after improving an ADR the agent would sometimes drift into implementing the
  decision or offering to. A new "Scope — refinement only" section forbids writing production
  code, producing an implementation plan, and closing with follow-up offers such as "shall I
  implement this now?" — refinement ends by reporting what changed in the ADR and any
  transition applied. Implementation stays with the skills that own it (`aif-adr-next`, the
  plan skills), invoked by the author.

## [1.4.1] — 2026-07-15

### Documentation

- **Improving a plan uses the standard `aif-improve`.** Clarified in `aif-adr-plan` (and the
  `aif-adr-overview` map) that an ADR's plan is an ordinary AI Factory plan artifact, so it is
  refined with the stock `aif-improve` — no ADR-specific improve skill is needed. Noted that
  `aif-improve` targets the plan by **path or branch/single-plan auto-resolution, not by id**
  (pass `@<plan-path>`, or run it with no argument on the plan's branch), and that it edits the
  plan body not its frontmatter, so the reciprocal `implements`/`depends_on` links are preserved;
  re-verify afterward with `adr resolve-plan` / `adr status --check`. (`aif-adr-refine` remains
  decision-only, deliberately not delegating to `aif-improve`.)

## [1.4.0] — 2026-07-14

### Added

- **Dependency-ordered "what to implement next".** New `aif-adr-next` skill and `adr order`
  subcommand read the `depends_on` graph across all ADRs and answer "which ADR do I implement
  next, and in what order?" — previously the author had to trace every dependency by hand.
  `adr order` computes a deterministic topological plan: `next` (the ready-now list — `accepted`
  ADRs whose every dependency is already `active`), the full topological `order` of the
  schedulable backlog, `blocked` ADRs (a dependency is missing/`superseded`, or they sit behind a
  cycle), and `cycles` (exits non-zero, since no valid order exists until they are broken). The
  skill layers judgment on top, recommending the concrete ADR to pick up. Read-only; cross-artifact
  cycle *validation* remains `ai-factory audit-artifacts`' job — `order` only surfaces cycles to
  explain why an order can't be produced.

## [1.3.1] — 2026-07-14

### Fixed

- **`adr finalize` no longer clobbers authored Evidence.** Finalize previously overwrote the
  `- **Evidence:**` field with the literal `implemented` on every activation, destroying any
  content the author had written (commit refs, artifact lists) — and, because `setField` only
  replaced the field's first line, a multiline Evidence was left with orphaned continuation lines
  and broken markdown. Finalize now overwrites Evidence (and, on the documentation-only path,
  Plan) **only** when the value is empty or a template sentinel; content-ful values are left
  intact. `setField` is now multiline-aware, so replacing a value consumes its continuation lines
  and never leaves an orphan.

## [1.3.0] — 2026-07-14

### Added

- **ADR-vs-code verification.** New `aif-adr-verify` skill and `adr verify-anchors`
  subcommand answer, on demand, "was this ADR implemented, and does the code still
  match the Decision?" — a re-runnable, read-only check that complements
  `aif-adr-finalize`'s one-shot, plan-based gate. `verify-anchors` deterministically
  confirms every `code:` anchor (and any `#symbol`) resolves on disk, exiting non-zero
  when any is missing (CI-usable); the skill layers agent judgment over it, classifying
  the ADR as implemented / partial / drift / not-implemented / doc-only and reporting a
  verdict without ever mutating the ADR or the code. Symbol matching is a naive
  word-boundary grep for now; deep resolution is deferred to Phase 6 code-intelligence.

## [1.2.0] — 2026-07-14

### Added

- **`code` source anchors.** New optional `code: []` frontmatter array on ADRs —
  primary entry-point anchors (repo-root paths, POSIX `/`, optional `#symbol`)
  linking a decision to where it lives in the source. `aif-adr-finalize`
  promotes the free-text `- **Code:**` line into it at activation;
  `aif-adr-migrate` backfills it on `active`/`superseded` imports;
  `adr validate` warns (never errors) when an `active` non-documentation-only
  ADR has no anchors. 

### Removed

- **Phase 5 (optional Cognee memory) dropped.** Resolved by spike: decision
  recall at solo-dev corpus size is served by frontmatter + `adr status` + grep;
  Cognee's LLM-at-ingestion cost is not justified. The `adr.memory.provider`
  config axis stays reserved (`none`).

## [1.1.0] — 2026-07-13

### Added

- **Legacy migration.** New `aif-adr-migrate` skill to bring a project's
  pre-existing/homegrown ADRs into the lifecycle (map status, rewrite into the
  template on a branch, repoint `AGENTS.md`-type instruction files), backed by a
  new `ai-factory adr import <topic> --status <s> [--id <id>]` command that
  scaffolds a conformant skeleton at any status. `adr new` now delegates to it.

## [1.0.1] — 2026-07-13

### Fixed

- Bundle the runtime `yaml` dependency in the npm package.
- Reject missing or malformed AI Factory project markers.
- Roll back multi-file lifecycle operations on failure and protect managed transitions.
- Restrict documentation-only detection to structured Implementation fields.
- Align status output, skills, and MVP documentation with delivered behavior.

## [1.0.0] — 2026-07-13

First stable release. MVP (Phases 0–4) complete; all acceptance criteria
(Acc 1–30) met, verified end-to-end against `ai-factory@2.17.0`.

### Added

- **Packaging (Phase 0):** `extension.json` manifest (skills + `adr` command),
  vendored `extension.schema.json` validation, AI Factory project detection and
  version-compatibility gate, `extension add/update/remove` integration coverage.
- **Core lifecycle (Phase 1):** frontmatter parsing, stable IDs, status↔directory
  mapping, transition-legality table with atomic moves + rollback, plan
  resolution via `implements` metadata, path-safety guards, and the full
  `ai-factory adr` command surface (`init`, `new`, `validate`, `transition`,
  `link-plan`, `resolve-plan`, `finalize`, `supersede`, `status`).
- **Skills:** `aif-adr-overview` (lifecycle map) plus eight stage skills —
  `propose`, `refine`, `accept` (Phase 2); `plan`, `implement`, `finalize`
  (Phase 3); `supersede` (Phase 4); `status`. Installed for Claude and Codex
  runtimes.
- **Audit integration:** `ai-factory adr status --check` exits non-zero on
  blocking errors for CI; artifact auditing invoked with an explicit ADR root.
- Superseding archives the old ADR's plan with an `archived_reason` note.

### Deferred

- Phase 5 (optional Cognee memory) and Phase 6 (optional code-intelligence) are
  post-MVP and do not block this release.

[1.2.0]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.2.0
[1.0.1]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.0.1
[1.0.0]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.0.0
