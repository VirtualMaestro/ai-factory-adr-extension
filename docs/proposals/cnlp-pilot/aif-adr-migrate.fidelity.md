# Fidelity map — `aif-adr-migrate`

Source: `skills/aif-adr-migrate/SKILL.md` — 180 lines, **8384 bytes** (8301 chars)
Result: `docs/proposals/cnlp-pilot/aif-adr-migrate.SKILL.md` — 149 lines, **9900 bytes**, **+18.1%**
Contract: `docs/proposals/cnlp_skill_migration_proposal.md` §4–§6, procedural profile
Purpose: pilot part A, contract coverage only (§11.1). Not measured, not landed.

**Counting units, stated because v1 of this map conflated them:**

- **original clause** — one normative statement in the prose source. 87 of them, §1 rows.
- **result line** — one id in the rewrite. 82 of them: 73 normative + 9 case labels
  (labels are discriminators, not obligations).

Mechanical state: `check.mjs` reports 82 ids, no findings. Its 15 mutation tests
(`check.test.mjs`) all fire, so the clean result is evidence rather than absence of
checking.

## 1. Original → result

| # | Original (line) | Result | Disposition |
|---|---|---|---|
| 1 | bring legacy ADRs (MADR/Nygard/homegrown) into the audited lifecycle (`:8-10`) | Purpose | carried |
| 2 | this skill owns the judgment: read, map to status, rewrite into template (`:10-12`) | S2 | strengthened |
| 3 | the CLI owns file mechanics: init/import/validate/status/link-plan/supersede (`:12-13`) | S3, Commands | strengthened |
| 4 | no deterministic migrate command; formats vary too much to parse (`:15-16`) | Purpose | carried |
| 5 | you read and map; the commands place and check (`:16`) | Purpose | carried |
| 6 | initialized project; `adr` commands gate on `.ai-factory.json` (`:20`) | P1 | carried |
| 7 | run `adr init` first; idempotent; scaffolds the five status dirs (`:21-23`) | W1 | **moved** |
| 8 | writes default `.ai-factory/adr-extension.yaml` if absent (`:23`) | W1 | **moved** |
| 9 | a clean working tree (`:24`) | P2 | carried |
| 10 | create a branch; migration reviewable and revertible there (`:24-25`) | W2 | **moved** |
| 11 | `git checkout -b adr-migration` (`:28`) | W2 | **moved** |
| 12 | read `adr.root` from config, default `docs/adr`; use it everywhere (`:31-33`) | W3 | **moved** |
| 13 | ask the operator where the legacy ADRs live (`:36-37`) | W4 | carried |
| 14 | reason: no reliable auto-location; the operator knows their layout (`:37-39`) | W4 | carried |
| 15 | only if they don't say, scan the four common locations (`:39-41`) | W5 | carried |
| 16 | read each one (`:41`) | W6 | carried |
| 17 | note format, existing status/date/title (`:41-42`) | W7 | carried |
| 18 | note whether any two are a replace/deprecate pair (`:42`) | W8 | carried |
| 19 | id — stable slug `adr-<lowercase-hyphenated>` from the title (`:45`) | W9 | carried |
| 20 | decide a status per legacy file (`:43-44`, `:46`) | W10 | carried |
| 21 | old accepted/approved → `accepted` (`:47`) | C1.1 | split |
| 22 | → `active` only if demonstrably implemented and evidence recordable (`:47-48`) | C1.2 | split |
| 23 | old proposed/draft/RFC → `proposed` or `draft` (`:49`) | C2.1 | carried |
| 24 | old deprecated/replaced — see step 4 (`:50`) | C3, C4, C5 | split |
| 25 | do not import directly as `superseded` when the replacement is also migrating (`:50-52`) | C3.1 | carried |
| 26 | import at prior live status and let `adr supersede` move it (`:52-53`) | C3.1 | carried |
| 27 | import directly as `superseded` only when no live replacement exists (`:53-55`) | C4.1, C5.1 | split |
| 28 | then fill frontmatter `replaced_by:` by hand (`:55-56`) | C4.2 | carried |
| 29 | state the full mapping (old file → id + status) before moving anything (`:56`) | W11, O1 | split |
| 30 | move + rewrite, one file at a time (`:58`) | W12, W13 | split |
| 31 | 1:1 is the common case; preserve history with a rename (`:59-60`) | C6, C6.1 | carried |
| 32 | `git mv <legacy-file> <root>/<status-dir>/<id>.md` (`:63`) | C6.1 | carried |
| 33 | then edit the moved file to match `templates/adr.md` (`:60-61`, `:65-66`) | C6.2 | carried |
| 34 | frontmatter field list (`:66-68`) | C6.3 | carried |
| 35 | section list: Context/Decision/Alternatives/Consequences with sub-parts (`:68-71`) | C6.4 | carried |
| 36 | port the old content into these (`:71`) | C6.5 | carried |
| 37 | legacy code/issue refs go into frontmatter, not the body (`:71-73`) | F4 | carried |
| 38 | resolve every template placeholder; no `[decision]`, `not implemented` (`:73-74`) | F3 | carried |
| 39 | `status` must equal the directory it now lives in (`:74-75`) | C6.6 | carried |
| 40 | for `active` imports record a short `evidence:` (`:75`) | C6.7 | carried |
| 41 | for active/superseded, backfill `code:` with entry-point anchors when known (`:76-78`) | C6.8 | carried |
| 42 | anchor form: repo-root paths, POSIX `/`, optional `#symbol` (`:77-78`) | C6.8 | carried |
| 43 | otherwise leave it `[]` (`:78`) | C6.9 | split |
| 44 | pre-1.6 ADRs: machine fields lived in the body; hoist them (`:79-81`) | C8 | carried |
| 45 | `- **Plan:** <id>` → `plan: <id>` (`:81-82`) | C8.1 | carried |
| 46 | `- **Evidence:** …` → `evidence: …` (short string) (`:82`) | C8.2 | carried |
| 47 | `- **Replaced by:** …` → `replaced_by: <new-id>` (`:83`) | C8.3 | carried |
| 48 | `- **Issue:** …` → `issue: …` (`:83-84`) | C8.4 | carried |
| 49 | remove the plan id from `affects` (`:84`) | C8.5 | carried |
| 50 | delete the emptied `## Implementation` and `## References` (`:84-85`) | C8.6 | carried |
| 51 | drop `- **Code:**`: always a duplicate of the `code:` frontmatter (`:85-86`) | C8.7 | carried |
| 52 | messy/partial, or one file splitting into several: scaffold from template (`:87-89`) | C7, C7.1 | carried |
| 53 | `ai-factory adr import "<title>" --status <status> --id <id>` (`:91`) | C7.1 | carried |
| 54 | `git rm <legacy-file>` (`:92`) | C7.3 | carried |
| 55 | `import` writes a conformant skeleton at `<root>/<status-dir>/<id>.md` (`:94-95`) | Commands | carried |
| 56 | the skeleton keeps placeholders on purpose; expected to fail `validate` (`:95-96`) | C7.4 | carried |
| 57 | documentation-only: set `evidence: documentation-only` (`:97-99`) | C9, C9.1 | carried |
| 58 | `plan:` stays empty (`:99`) | C9.2 | carried |
| 59 | prose in the body does not bypass planning (`:99-100`) | F5 | carried |
| 60 | for a replace pair prefer the command over hand-linking (`:102-103`) | W17 | carried |
| 61 | the command requires the old ADR to be `accepted` or `active` (`:103-104`) | W16 | carried |
| 62 | migrate both sides at live status first (`:105`) | W16 | carried |
| 63 | `ai-factory adr supersede <old> <new> [--archive-plan \| --delete-plan]` (`:108`) | W17 | carried |
| 64 | it writes `supersedes:`, the reciprocal `replaced_by:`, and moves to `superseded/` (`:110-114`) | Commands | carried |
| 65 | only when no live replacement: place directly and hand-fill (`:114-115`) | C4.1, C4.2 | carried |
| 66 | place a referenced legacy plan doc under `paths.plans` (`:117-119`) | W18 | carried |
| 67 | wire reciprocal links: `ai-factory adr link-plan <adr-file> <plan-file>` (`:121`) | W18 | carried |
| 68 | validate each migrated ADR and fix until clean (`:125-129`) | W19 | carried |
| 69 | what validate clears: dir↔status, stem==id, placeholders, evidence for active (`:131-132`) | Commands | carried |
| 70 | audit the whole set: `ai-factory adr status --check` (`:134-137`) | W20 | carried |
| 71 | must exit 0 — no dup ids, dangling relations, cycles, multi-plan ADRs (`:140-141`) | W20, Commands | carried |
| 72 | find stale blocks in AGENTS/CLAUDE/CONTRIBUTING/README and replace (`:143-146`) | W21 | carried |
| 73 | do not invent new rules; point to the skills (`:146`) | F7 | carried |
| 74 | the pointer block, verbatim (`:148-151`) | W21 fence | carried |
| 75 | substitute the configured `adr.root` for "the configured ADR root" (`:153-155`) | W22 | carried |
| 76 | leave everything on the branch for the maintainer to review and merge (`:156`) | F9 | strengthened |
| 77 | report a footer at the end (`:158`) | W23, O2 | split |
| 78 | the footer reports the count **and the ids** migrated, by resulting status (`:159`) | O1 | **dropped (resolved, see §3)** |
| 79 | footer format string (`:162`) | O2 fence | carried |
| 80 | take ids/counts from `ai-factory adr status --json` (`:165`) | O2, Commands | carried |
| 81 | source of truth = the Markdown files in Git; a prior index or wiki is superseded (`:169-171`) | F8 | strengthened |
| 82 | skill owns judgment; CLI owns file mechanics (`:171-172`) | S2, S3 | strengthened |
| 83 | never hand-edit a `status` field to fake a transition (`:172-174`) | F1 | carried |
| 84 | never move files outside `git mv` / the `adr` commands (`:174`) | F2 | carried |
| 85 | migrate onto the branch; keep the diff reviewable (`:174-175`) | W2, F9 | split |
| 86 | when unsure whether a legacy item is a real decision, migrate as `proposed` (`:175-176`) | F6 | carried |
| 87 | invocation lines (`:180`) | Invocation | carried |

## 2. Result → original

All 82 result lines appear in §1 except these nine.

| Result line | Disposition | Reason |
|---|---|---|
| S1 | added | The contract requires `Scope` for the procedural profile; the original has none. S1 bounds the set of files the skill may touch. An unbounded migration skill is the one that edits things nobody asked it to. Approved. |
| W13 | added | The original lists its four step-3 bullets with **no composition rule** (`:58-101`). W13 fixes that one movement case is selected. See §3 defect 1. |
| W14 | added | Same: the pre-1.6 hoist applies *in addition to* a movement case. See §3 defect 1. |
| W15 | added | Same: documentation-only applies *in addition to* a movement case. See §3 defect 1. |
| W23 | added | Bookkeeping: makes the footer a workflow step rather than an implicit ending. No behavioural change. |
| C5.2 | added | Exit for the input the original cannot express. See §3 defect 2. |
| C7.2 | added | The original states the field and section requirements only under its 1:1 bullet (`:65-78`), and separately says a scaffold is "expected to fail `validate` until you fill it" (`:95-96`) — without saying what filling means. C7.2 points the scaffold path at C6.3–C6.9 rather than duplicating them. Approved. |
| A1–A3 | added | The original defines six entry conditions, an operator question, and a "must exit 0" audit, and no exit for any of them failing. Without these the skill improvises past a dirty tree, invents a legacy location, or presents a half-migrated branch as done. Approved. |
| A4 | added | The abort C5.2 refers to. See §3 defect 2. |

**Strengthened — four original clauses (#2/#82, #3/#82, #76, #81), landing on S2, S3, F9,
F8.** All have one shape: the original states them as declarative facts, and a declarative
fact in a skill file exists only to constrain behaviour. Counted by *original clause*, not
by result line, which is why v1 of this map said "4" while listing five rows.

**Moved — five clauses (#7, #8, #10, #11, #12) from `Preconditions` to `Workflow`.** The
original files `adr init`, `git checkout -b`, and reading the config under
`## Preconditions`. Those are actions the skill performs, and §6 assigns actions to
`Workflow` and reserves `Preconditions` for state that must already hold with the check
that confirms it. Only #6 (project initialized) and #9 (clean tree) are conditions. This
is a presentational move with no behavioural change: the order of execution is unchanged.

## 3. Defects in the original that the rewrite surfaced

Three. Two are resolved here; one needs the skill owner.

### Defect 1 — the four step-3 branches are not mutually exclusive

The original presents them as a flat bullet list under one step (`:58-101`): 1:1 rename,
pre-1.6 hoist, messy/split scaffold, documentation-only. **They are not one dimension.**
1:1 and split are alternative *movement* methods; pre-1.6 is a property of the *source
format*; documentation-only is a property of the *decision*. A single legacy file can be
all three at once — a pre-1.6, documentation-only ADR that maps 1:1.

The first draft of this rewrite made it worse by forcing them into one exclusive case set
selected by a single step, which meant a pre-1.6 file would be hoisted and **never moved
or rewritten**.

**Resolved** as three sets with declared composition: set 2 selects exactly one movement
case (C6 or C7) at W13; sets 3 and 4 are overlays applied in addition, at W14 and W15, in
that order. This is the only reading under which every input is implementable. No
behavioural intent is invented — the original's own 1:1 bullet already contains the
rewrite steps a pre-1.6 file needs.

### Defect 2 — "deprecated with no successor" cannot be represented

The original says to import directly as `superseded` when there is no live replacement to
run the command against, "e.g. a decision dropped with no successor", and then to fill
`replaced_by:` by hand (`:53-56`).

Those two cases are different and the second is impossible:
`src/lifecycle/validate.js:71-72` rejects a `superseded` ADR whose `replaced_by:` is empty
(inv 11), and step 6 of the original requires `validate` to be clean. A dropped decision
with no successor has nothing to put in `replaced_by:`, so the instruction cannot be
carried out on the input it names as its own example.

**Resolved** by splitting: C4 is "the replacement exists but is not itself being migrated"
— implementable, `replaced_by:` points at it. C5 is "no successor exists" — the skill must
not place it in `superseded/`, and stops to ask (A4). The rewrite does not invent a status
for it; **choosing that status is a decision for the skill's owner**, and it is the one
open item this pilot leaves behind.

### Defect 3 — the footer contradicts itself, **resolved**

`:159` requires the footer to report "the count and the ids migrated, by resulting status".
The format string it mandates three lines later has no slot for ids:

```text
✔ aif-adr-migrate · 4 ADRs → 2 active, 1 accepted, 1 superseded · branch: adr-migration
```

`ai-factory adr status --json` does return per-status id arrays (`src/status.js:74-81`), so
this is a presentation choice, not a capability limit. **Resolved: the ids live in the O1
mapping, which already carries one row per migrated file; the footer stays count-only, as
its own format string requires.** Recorded as `dropped` against clause #78 because the
footer loses a stated requirement, not because the information is lost.

## 4. Contract findings

The §11.1 exit criterion: every section `migrate` needs exists in the catalog and holds its
content, no `##` heading outside the catalog, no prose smuggled back in, inside the
procedural budget.

**Passed, with three amendments to the contract.**

### Held

- **Size:** 9900 bytes vs 8384, **+18.1%**, against a +20% procedural budget. Lines fell
  180 → 149. Note the margin: the *semantically correct* rewrite costs four times what the
  first, wrong one did (+4.3%), because defects 1 and 2 each cost real lines. A budget
  validated against a rewrite that has not been checked for semantic drift is worthless.
- **No `##` heading outside the catalog was needed.** The original's
  `## Rules that hold throughout` distributed into `Scope`, `Forbidden`, and
  `Preconditions` — the bucket where unenforceable prose accumulates is exactly the one the
  catalog dissolves.
- **`## Commands`** absorbed six "what the command owns" statements previously rediscovered
  inside four different steps (`:94-95`, `:110-114`, `:131-132`, `:140-141`).
- **The verbatim `AGENTS.md` pointer** sits as a fenced block on W21 under the existing
  §4.1 rule 4. No amendment needed.

### Amendment 1 — `## Cases` must permit normative lines (§4.2)

The contract called `Cases` non-normative data. `migrate`'s cases carry 30 obligations;
pushing them into `## Workflow` produces a conditional sequence twice the length of the
whole skill. **A case label `C<n>` is a discriminator and carries no modal; obligations
inside it are `C<n>.<m>` lines with one modal each.**

### Amendment 2 — several case sets, each declaring its composition (§4.2, §6)

`migrate` has four sets on four discriminators. Two amendments in one: sets are `###`
subsections with flat ids, **and each set states whether it is `select exactly one` or
`apply in addition when it matches`, plus the workflow step that applies it.** Defect 1 is
what a missing composition rule looks like in production — v2's contract had no way to
express it, and the first draft of this rewrite silently picked the wrong one.

### Amendment 3 — `Preconditions` holds conditions, `Workflow` holds actions (§6)

Already in the catalog, and the first draft violated it anyway by carrying the original's
mixed `## Preconditions` across unchanged. Worth stating in §7 as its own change class:
**entry actions move to the front of `Workflow`; only checkable state stays a `P<n>`.**

### Clarification — when `## Transitions` is required

§5 said "required where the skill moves an ADR". `migrate` moves ADR files constantly and
correctly has no `## Transitions`: it *places* files entering the lifecycle and calls
`adr supersede`; it never changes the status of an ADR already under management. Wording
fixed in §5.

### Cost the contract imposed, and paid back

The §6 no-duplication rule caught two prohibitions in the first draft that were positive
obligations with the polarity flipped. The original carries one of them twice — as a
prohibition at `:50-52` and as a condition at `:53-55` — where prose hid the duplication.

## 5. What the linter does and does not check

`check.mjs`, 15 mutation tests, all firing. **Checks:** duplicate ids; missing leading
modal; two modals on one line, including across a continuation line; id prefix against its
section; unknown prefix; orphan `C<n>.<m>` with no parent; unresolved single references;
ranges expanded and every member required (`C1–C5` fails if `C4` is missing); mixed-prefix
and reversed ranges; obligations written with no id at all; the size budget as an exit
code; references inside fenced blocks and blockquotes ignored as data.

**Does not check, and cannot:** that a reference points at the *intended* line. S1 in the
first draft cited `W14` for the instruction files, which live at `W21` — a resolvable
reference to the wrong step. Only reading catches that. It is the argument for the §8 map
being human-reviewed rather than generated.
