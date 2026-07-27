# Proposal: migrate the ADR skill set to a CNL-P-like controlled format

Status: draft (v3) · Decision required before any skill is rewritten.

## 1. Context

This extension ships fifteen skills (`skills/aif-adr-*/SKILL.md`, 1338 lines) as a
versioned package (`extension.json`, currently 1.10.0). Each file is loaded verbatim
into an agent's context when the skill is invoked, and is expected to constrain that
agent's behaviour for the rest of the run.

The files are written as documentation prose. That is comfortable to author and review,
and it is the wrong shape for the job. A skill file is not documentation about a process
— it *is* the process, and the reader that matters executes it. Prose mixes intent,
policy, exception, sequence, and output format into the same paragraphs, and leaves the
agent to separate them by inference on every run.

The concrete symptoms this proposal targets:

- **Layer mixing.** `skills/aif-adr-refine/SKILL.md:12-20` states scope, three
  prohibitions, a stop condition, an output limit, and a redirect, in four sentences of
  running prose.
- **Soft obligation.** "Do not end with offers like…" and "must **never** implement" sit
  in the same paragraph at different strengths, with nothing marking which is which.
- **Hidden branching.** `skills/aif-adr-migrate/SKILL.md:58-101` contains four mutually
  exclusive cases (1:1 rename, pre-1.6 hoist, split, documentation-only) as nested
  bullets under one numbered step.
- **Guard drift.** The refine transition table (`skills/aif-adr-refine/SKILL.md:68-74`)
  is preceded by the guard "only when the file is actually improved" in a heading, not in
  any row — so the guard is easy to lose on the next edit.

None of this is a defect in the current authoring. It is the ceiling of the format.

### 1.1 Revision history

- **v1** argued the case from one skill and stopped short of a buildable specification.
- **v2** added a file contract, profiles, a fidelity rule, and a pilot.
- **v3 (this version)** fixes eleven defects found in review of v2: a profile rule that
  silently added new policy to two skills, a pilot that did not cover the contract it
  claimed to test, an unreproducible experiment with a post-hoc control, a grammar
  contradicted by its own examples, a one-directional fidelity rule, a line budget
  already falsified, a rollout that would leave the test suite red between waves, an
  understated scope, over-specified identifiers, five open questions that blocked the
  contract, and an unqualified `§17`. Each fix is marked **[v3]** where it lands.

## 2. What "CNL-P-like" means here

A controlled natural language for prompts treats an instruction artifact as an API
contract rather than as persuasive text: fixed structure, one term per concept, visible
obligation levels, and a declared output shape.

This migration adopts a deliberate subset.

**Adopted**

- Fixed section vocabulary and fixed section order.
- Exactly one obligation per line, carrying exactly one modal (`MUST`, `MUST NOT`, `MAY`).
- Identifiers on every normative line, so lines can reference each other.
- A declared output contract, separate from the workflow that produces it.
- Controlled lexicon: one word per concept, no idiom, no near-synonym variation.

**Rejected, on purpose**

- A formal grammar or parser-enforced syntax. The files stay markdown a human reads in
  one pass. §4 is checkable by a small linter, not by a parser generator.
- A type system or schema over the body.
- Elimination of prose. Judgment rules keep short controlled sentences; compressing
  architectural reasoning into keywords destroys the thing the skill exists to do.

In-repo prior art: `docs/proposals/adr_lens_judgment_cnlp_rewrite.md` is an ADR already
written in this register — useful for tone and density, though it is an ADR, not a skill,
and does not follow the section contract below.

## 3. Scope **[v3]**

v2 declared "the body of fifteen skill files" and then required a glossary, a linter,
test changes, changelog entries, and version bumps. The full deliverable set:

**In scope**

| Deliverable | Note |
|---|---|
| bodies of 14 `skills/aif-adr-*/SKILL.md` files | see the exclusion below |
| `skills/GLOSSARY.md` | **authoring-only**: the runtime never loads it, so no rule may live only there |
| section + lexicon linter, wired into `npm test` | §13 |
| `test/skill-rubric.test.js` update | §12 |
| CHANGELOG entries and version bumps, one per wave | §14 |
| an ADR recording this decision, once §11 returns a result | §14 |

**Excluded**

- **`aif-adr-overview`** **[v3]**. It is reference material about the lifecycle
  (`## Lifecycle flow`, `## Status directories`, `## Rules that always hold`), not an
  executable procedure. Forcing it into a workflow contract would distort it. It stays as
  it is. This closes v2's open question 5.
- **YAML frontmatter** (`name`, `description`). The runtime parses it for skill discovery
  and routing; `description` must stay natural trigger phrasing. Not rewritten; §13's
  lexical rules do not apply to it.
- `templates/adr.md` and the ADR corpus. Whether ADRs adopt the same register is a
  separate decision.
- CLI source, command output formats, `README.md`, `docs/BACKLOG.md`.

## 4. File contract

Everything else in this document depends on this section. v2's version was contradicted
by v2's own examples; this one states the grammar precisely enough to lint. **[v3]**

### 4.1 Shape

```markdown
---
name: aif-adr-refine          <- unchanged, out of scope
description: ...              <- unchanged, out of scope
---

# aif-adr-refine              <- H1, skill name only

## Purpose                    <- first section follows H1 directly, no prose between
- ...

## Workflow
W1 MUST ...
```

1. Frontmatter is untouched.
2. The H1 is the skill name and nothing else. No paragraph between the H1 and the first
   `##`. (Today every skill has one; its content moves to `## Purpose`.)
3. Body sections are `##` headings from the §6 catalog, in the catalog's order. No other
   `##` heading is legal. `###` may be used only inside `## Cases`.
4. Markdown tables and fenced code blocks are legal inside a section. A controlled format
   that cannot hold a shell command is useless for this corpus.

### 4.2 Lines, obligations, identifiers **[v3]**

**A line** is one logical item: a list item or an id-prefixed item. It may wrap across
physical lines with indentation; the linter joins wrapped lines before checking.

**A normative line** states an obligation. Its form is exact:

```text
<ID> <MODAL> <text ending in a period>
```

- `<MODAL>` is `MUST`, `MUST NOT`, or `MAY`. **Exactly one modal per line.** A sentence
  carrying two obligations is two lines. This is the rule v2 stated and then broke six
  times in its own example.
- An enumerated list *inside* one obligation is allowed and is not a second obligation:
  `R10 MUST give per approach: consequences over 6–12 months, effect on coupling, hidden
  risks.` is one line.
- `SHOULD` is not used. In an instruction artifact it degrades to noise; every current
  "should" in the corpus is either a `MUST` or a preference belonging in
  `## Decision rules` with its condition stated.

**Non-normative content** carries no id and no modal: `## Purpose` bullets, `## Commands`
table rows, `## Transitions` table rows, `## Cases` labels, the `## Invocation` line, and
fenced blocks. Non-normative content is *data*. It becomes binding only when a normative
line references it — `W11 MUST apply the row of ## Transitions whose guard holds.`
**[v3]** This resolves v2's unnamed `MUST` under Transitions and its modal-less table rows.

**Identifier prefixes**, one per section:

| Prefix | Section |
|---|---|
| `S<n>` | Scope |
| `F<n>` | Forbidden |
| `P<n>` | Preconditions |
| `R<n>` | Decision rules |
| `W<n>` | Workflow |
| `A<n>` | Abort conditions |
| `O<n>` | Output |
| `C<n>` | Cases (labels — data, referenced by a `W<n>`) |
| `T<n>` | Transitions (table rows — data, referenced by a `W<n>`) |

**Identifiers are unique within their file and every reference resolves within that
file.** That is the whole rule. **[v3]** v2 additionally forbade renumbering and required
retiring removed ids; neither is checkable without a registry or a git-diff rule, and
neither buys anything at this corpus size. Dropped.

### 4.3 Size budget **[v3]**

v2 set one budget of +10% lines and its own worked example broke it by 33%. Two fixes:
measure the cost that is actually paid, and set the limit per profile before measuring,
not after.

- **Unit: characters, not lines.** Characters are monotone with context tokens; line
  count is not (one prose line can hold four obligations).
- **Budgets:** judgment ≤ +45%, procedural ≤ +20%, wrapper ≤ +20%, against the current
  file. Judgment gets the larger allowance because its prose rules pack several
  obligations per sentence and splitting them is the point of the exercise.
- **Over budget is not resolved by raising the budget.** It is resolved by cutting rules
  on their own merits, or by rejecting the migration for that profile.

Current baseline, characters: `refine` 4966 · `status` 1259 · `migrate` 8384 · corpus
total ≈ 46k.

## 5. Skill profiles

The corpus has three shapes, distinguished by where the skill's value sits.

| Profile | Value sits in | Skills |
|---|---|---|
| **judgment** | the standing criteria for a decision | `propose`, `refine`, `reconcile`, `plan`, `plan-improve` |
| **procedural** | correct execution of a branching sequence | `migrate`, `supersede`, `accept`, `finalize`, `implement`, `verify`, `verify-all` |
| **wrapper** | reading a CLI result and reporting it | `status`, `next` |

| Section | judgment | procedural | wrapper |
|---|---|---|---|
| `Purpose` | required | required | required |
| `Scope` | required | required | optional |
| `Forbidden` | required | required | optional |
| `Preconditions` | optional | required | optional |
| `Commands` | required | required | required |
| `Decision rules` | **see below** | **see below** | **see below** |
| `Workflow` | required | required | required |
| `Cases` | optional | optional | forbidden |
| `Transitions` | required where the skill moves an ADR | required where the skill moves an ADR | forbidden |
| `Abort conditions` | required | required | optional |
| `Output` | required | required | required |
| `Invocation` | required | required | required |

### 5.1 `Decision rules` is a corpus fact, not a profile property **[v3]**

v2's table required `Decision rules` for the whole procedural profile — which silently
added the rubric to `aif-adr-migrate` and `aif-adr-supersede`, two skills that have never
had one, and which `test/skill-rubric.test.js:60-65` asserts must not have one. That is a
behavioural change smuggled in as a formatting rule, and it also falsified v2's claim that
the test needed only a constant change.

**Rule: `Decision rules` is required exactly where the rubric exists today, and forbidden
elsewhere.**

| Has the rubric today | Skills |
|---|---|
| long variant | `propose`, `refine`, `reconcile`, `plan`, `plan-improve` |
| short variant | `implement`, `verify`, `verify-all`, `finalize`, `accept` |
| none | `migrate`, `supersede`, `next`, `status`, (`overview`, excluded) |

Whether `migrate` and `supersede` *should* gain a rubric is a real question and a separate
decision, made on its own merits with its own ADR. A format migration must be
behaviour-preserving; that is the entire premise of §8.

## 6. Section catalog

One entry per legal section. The order below is the mandated file order.

| Section | Holds | Does not hold |
|---|---|---|
| `Purpose` | why the skill exists; what it produces; the one sentence that would survive if everything else were deleted | how it works; prohibitions |
| `Scope` | `S<n>`: what the skill is allowed to act on | prohibitions (those are `Forbidden`) |
| `Forbidden` | `F<n>`, all `MUST NOT`, one prohibition each, with the reason where the reason is what makes it stick | soft preferences |
| `Preconditions` | `P<n>`: state that must hold before `W1`, each with the check that confirms it | setup the skill performs itself (that is workflow) |
| `Commands` | table: the exact CLI invocation and what it owns | prose about the CLI |
| `Decision rules` | `R<n>`: standing judgment policy applied throughout, not at one step | ordered actions |
| `Workflow` | `W<n>`: ordered actions, one observable action each, referencing rules, cases and transitions by id | judgment criteria; branching detail |
| `Cases` | `C<n>` labels: mutually exclusive branches with the discriminator that selects one | anything a step can state inline |
| `Transitions` | `T<n>` table rows: from, guard, command | file moves by hand |
| `Abort conditions` | `A<n>`: when the skill stops without completing, and what it reports instead | error prose scattered in steps |
| `Output` | `O<n>`: everything the agent may emit, what it must omit, the footer and its source | analysis instructions |
| `Invocation` | the Claude Code and Codex invocation lines | anything else |

Six of these — `Preconditions`, `Commands`, `Cases`, `Abort conditions`, `Invocation`, and
the guard column of `Transitions` — had no slot in v1, yet all are present in the current
corpus. `Preconditions` already appears in seven skills; `Invocation` in all fifteen.

**Order decision [v3]:** `Decision rules` precedes `Workflow`. This matches the current
layout and `test/skill-rubric.test.js:45-47`, which asserts the rubric precedes the
workflow heading. Whether an agent applies standing policy more reliably when it reads it
before the steps is measurable and unmeasured; the pilot may revisit it, but the contract
does not stay open on it. Closes v2's open question 3.

**Duplication decision [v3]:** a prohibition appears once, in `Forbidden`. A workflow step
that depends on it references the id (`W7 … under F4`). No restating. Closes v2's open
question 4.

## 7. Change classes

1. **Structural normalization** — narrative sections become catalog sections in order.
2. **Modal normalization** — implicit instruction becomes `MUST` / `MUST NOT` / `MAY`.
3. **Obligation splitting** **[v3]** — a sentence carrying two obligations becomes two
   lines.
4. **Output contract extraction** — emissions, omissions, and the footer leave the workflow.
5. **Workflow atomization** — one observable action per `W<n>`.
6. **Policy extraction** — judgment criteria leave the step sequence and become `R<n>`.
7. **Transition formalization** — every transition becomes a row with an explicit guard
   column, so no guard survives only in a heading.
8. **Preconditions extraction** — entry conditions become `P<n>`, each with its check.
9. **Case formalization** — nested conditional bullets become `## Cases` with a stated
   discriminator.
10. **Command-contract extraction** — the CLI calls a skill wraps are listed once.
11. **Lexical tightening** — §13.

## 8. Fidelity rule — two-directional **[v3]**

v2 checked original → new, which catches losses only. A rewrite can equally well *add* an
obligation nobody approved, or promote a descriptive sentence to `MUST`. Both change
behaviour as surely as a deletion.

**A migration commit carries a map with three columns: original clause → result line →
disposition.** Every row is one of:

| Disposition | Meaning | Requires |
|---|---|---|
| `carried` | same obligation, same strength | nothing |
| `split` | one clause became several lines | nothing |
| `strengthened` | descriptive or soft in the original, `MUST` in the result | a stated reason |
| `weakened` | `MUST` in the original, `MAY` or absent in the result | a stated reason |
| `added` | no origin in the original | a stated reason |
| `dropped` | in the original, absent from the result | a stated reason |

Every result line must appear in the map. An unmapped result line is a defect, not a
detail. The linter can check totals and column completeness; only a human judges a reason.

This rule exists because v1 violated its own first principle. v1's rewrite of
`aif-adr-refine` silently dropped: steelmanning rejected options
(`skills/aif-adr-refine/SKILL.md:38-39`); the 6–12 month consequence horizon (`:37`); "at
equal architectural correctness prefer the smaller change" and "no abstractions for
hypothetical needs" (`:45-46`); "sunk effort counts for nothing by itself, migration cost
does" (`:46-48`); "hard-to-reverse choices demand stronger grounds" (`:50-51`);
"disagreement alone is not new information" (`:55-56`); the reason for the `aif-improve`
non-delegation (`:9-10`); the transition guard "only when the file is actually improved"
(`:68`); and `## Invocation` entirely. It also introduced `mode: adr_refinement`, a key
with no consumer — an `added` row nobody would have approved.

§9 below demonstrates the reverse direction catching three items v2 would have shipped
blind.

## 9. Worked example — `aif-adr-refine` (judgment profile)

````markdown
---
name: aif-adr-refine
description: Refine an ADR — on first refine move it from proposed to draft and apply ADR-specific quality criteria.
---

# aif-adr-refine

## Purpose
- Discuss and improve a proposal or draft ADR (PRD §19.2).
- Apply ADR-specific refinement criteria: validating a decision record is a different task
  from validating an implementation plan.

## Scope
S1 MUST act on the ADR document only.
S2 MUST update Context, Decision, Alternatives, and Consequences in that document.
S3 MUST stop when refinement is done.

## Forbidden
F1 MUST NOT implement the decision.
F2 MUST NOT write or modify production code.
F3 MUST NOT create an implementation plan.
F4 MUST NOT delegate to `aif-improve`: its criteria are for implementation plans, not decision records.
F5 MUST NOT propose implementation as a next step, or end with an offer such as "shall I implement this now?".
F6 MUST NOT report anything beyond what changed in the ADR and the transition applied.
F7 MUST NOT act on implementation intent: the operator invokes `aif-adr-next` or the plan skills.
F8 MUST NOT move ADR files by hand: `ai-factory adr transition` owns the atomic move and the legality check (PRD §17).

## Commands
| Command | Owns |
|---|---|
| `ai-factory adr validate <file>` | structural validation of one ADR |
| `ai-factory adr transition <file> draft` | the atomic move and the legality check (PRD §17) |
| `ai-factory adr status <adr-file>` | id, status, and active plan for the footer |

## Decision rules
R1 MUST measure every option by what serves the project best over its lifetime.
R2 MUST state delivery cost, risk, and timeline explicitly for the operator.
R3 MUST NOT let the agent's own convenience in this session stand in for R2.
R4 MUST name the project invariants the change touches: module boundaries, public APIs, data schemas, active ADRs, `.ai-factory/RULES.md`, `.ai-factory/ARCHITECTURE.md`.
R5 MUST cite the concrete rule, ADR, or code location each judgment rests on.
R6 MUST NOT recommend an option with no ground named.
R7 MUST research until the ground can be named, instead of guessing.
R8 MUST present at least two viable approaches when the change touches a module boundary, public API, data schema, or architectural invariant.
R9 MUST state why the other approaches are not viable when only one is.
R10 MUST give per approach: consequences over the next 6–12 months of project evolution, effect on coupling, hidden risks.
R11 MUST reject each alternative in its strongest version, naming the reason.
R12 MUST NOT accept "faster to write", "easier", or "smaller diff for me now" as justification for violating an invariant or an established convention of the codebase.
R13 MUST justify explicitly any divergent local pattern, because two ways of doing one thing is a real cost.
R14 MUST name a large blast radius — many call sites, data migrations, compatibility breaks — as genuine risk and cost.
R15 MUST prefer the smaller change at equal architectural correctness.
R16 MUST NOT add abstractions for hypothetical needs.
R17 MUST count effort already sunk into existing code as nothing by itself.
R18 MUST count the compatibility and migration cost of replacing existing code.
R19 MUST present both the correct option and the cheap option when the correct one costs more, each with its cost, risk, and reversibility.
R20 MUST demand stronger grounds for hard-to-reverse choices such as data schemas and public APIs.
R21 MUST end with exactly one explicit recommendation.
R22 MUST NOT silently downgrade to the cheap option: the operator decides.
R23 MAY revise a recommendation on a new fact, a new constraint, a found reasoning error, a clarified goal, or an explicit operator decision.
R24 MUST name what changed when revising under R23.
R25 MUST NOT treat disagreement alone as new information.
R26 MUST treat a flip with no new grounds as evidence that the original recommendation was ungrounded.

## Workflow
W1 MUST run `ai-factory adr validate <file>`.
W2 MUST address every error W1 reports.
W3 MUST inspect project rules, architecture documents, relevant code, and existing ADRs.
W4 MUST ensure the document states exactly one primary decision.
W5 MUST improve Context, Decision, Alternatives, and Consequences under R1–R26.
W6 MUST keep the rationale explicit rather than implied.
W7 MUST state every conflict found with an active ADR.
W8 MUST ask only questions that materially block the decision.
W9 MUST NOT ask any other question.
W10 MUST update the ADR after the analysis.
W11 MUST apply the row of `## Transitions` whose guard holds, under F8.
W12 MUST end with O4.

## Transitions
| Id | From | Guard | Action |
|---|---|---|---|
| T1 | `proposed` | first refine **and** the file is actually improved | `ai-factory adr transition <file> draft` (moves it to `drafts/`) |
| T2 | `draft` | repeat refine | none — it stays `draft` |
| T3 | `accepted` | explicit operator intent **and** its active plan explicitly archived or removed | transition back to `draft` |

## Abort conditions
A1 MUST stop and report the unresolved error when `ai-factory adr validate` cannot be made to pass.
A2 MUST stop and ask when a question that blocks the decision has no answer available in the repository.

## Output
O1 MUST emit the refined ADR text.
O2 MUST emit a summary of what changed in the ADR.
O3 MUST emit the transition applied, when one was applied.
O4 MUST end with the footer `✔ aif-adr-refine · ADR: <adr-id> [<status>] · Plan: <plan-id or none>`, filled from `ai-factory adr status <adr-file>`.

## Invocation
Claude Code: `/aif-adr-refine @adr-file` · Codex: `$aif-adr-refine @adr-file`.
````

### 9.1 Fidelity map, summary

55 original clauses → 55 `carried`/`split` rows. Then the reverse direction, which v2 had
no mechanism to surface: **[v3]**

| Result line | Disposition | Reason |
|---|---|---|
| `A1` | `added` | the original states "address reported errors" with no exit when they cannot be addressed; the skill would loop or improvise. Approved as a new obligation. |
| `A2` | `added` | same gap for an unanswerable blocking question. Approved. |
| `R26` | `strengthened` | the original states "flipping without new grounds means the original was ungrounded" as an observation; the rewrite makes it an obligation. Approved: the observation exists only to constrain the behaviour. |

Three behavioural changes, all declared, none discovered later in production.

### 9.2 Size

Measured: **5652 characters versus 4966, +14%** — inside the judgment budget of +45%
(§4.3). Lines went 89 → 96, **+8%**.

The two numbers disagree by nearly a factor of two, in the direction that matters: under
this grammar one obligation is one line however long, so line count *understates* the
context cost. v2 measured lines and would have read this rewrite as cheaper than it is.
That is the case for §4.3's unit, and it is why the +45% judgment budget is set with room
rather than tuned to this single result — `propose`, `reconcile`, `plan`, and
`plan-improve` have not been measured.

## 10. Worked example — `aif-adr-status` (wrapper profile)

````markdown
---
name: aif-adr-status
description: Report ADR status by wrapping the `ai-factory adr status` command.
---

# aif-adr-status

## Purpose
- Report ADR state, read-only (PRD §19.8).

## Forbidden
F1 MUST NOT mutate any state.

## Commands
| Command | Owns |
|---|---|
| `ai-factory adr status` | corpus overview (`--json` for machine-readable output) |
| `ai-factory adr status --check` | cross-artifact audit; exits non-zero on blocking errors |
| `ai-factory adr status <file>` | single-ADR report |

## Workflow
W1 MUST select the mode: no argument selects W2, `@adr-file` selects W3.
W2 MUST run `ai-factory adr status` and report: proposals; drafts; accepted ADRs without plans; accepted ADRs with active plans; active ADRs; superseded ADRs; status-directory mismatches; ADR validation errors; ADRs with more than one non-archived plan.
W3 MUST run `ai-factory adr status <file>` and report: id; status; lifecycle location; linked active plan; archived plan references; implementation evidence; dependencies; affected artifacts; superseding and replacement relationships; validation errors and warnings.
W4 MUST run `ai-factory adr status --check` for duplicate ids, broken artifact references, and other cross-artifact diagnostics.

## Output
O1 MUST report the result of the selected mode.
O2 MUST NOT report optional-memory diagnostics: post-MVP, not currently produced.

## Invocation
Claude Code: `/aif-adr-status [@adr-file]` · Codex: `$aif-adr-status [@adr-file]`.
````

Fidelity: all clauses carried, nothing added. **1479 characters versus 1259, +17%** —
inside the +20% wrapper budget, but with almost no margin, on the thinnest file in the
corpus. The gain is small and honest: the mode branch becomes an
explicit `W1` instead of two `###` headings, and "never mutates state" moves from a bolded
phrase inside a sentence to `F1`. Whether that justifies touching the wrapper skills is
the one question §15 leaves open.

## 11. Pilot **[v3 — rewritten]**

v2's experiment was not reproducible and introduced its control only after a positive
result. Both are fixed. The pilot has two independent parts; conflating them was v2's
second error.

### 11.1 Part A — contract coverage (no measurement)

`refine` + `status` exercise no `Preconditions`, no `Cases`, and no procedural profile.
Claiming they "exercise every part of the contract" was false.

**`aif-adr-migrate` is rewritten as part of the pilot, for contract coverage only.** It is
the largest file (8384 chars) and the only one that heavily exercises `## Cases` (four
mutually exclusive branches), `## Preconditions` (clean tree, branch, `adr init`, config
read), verbatim insert blocks, and embedded shell. It is not measured — a repeatable
behavioural run would need a synthetic legacy-ADR corpus, which is a larger investment
than the marginal signal justifies.

**Exit criterion:** every §6 section that `migrate` needs exists in the catalog and holds
its content without a `##` heading outside the catalog, without prose smuggled back in,
and inside the procedural budget. If it does not, the contract is wrong and §6 changes
before any wave.

### 11.2 Part B — behavioural measurement

**Hypothesis.** A skill in the controlled format produces fewer contract violations per
run than the same skill in prose.

**Variants, all three pre-registered before any run:**

| Variant | Description |
|---|---|
| A | current prose, unchanged |
| B | prose re-edited with equal attention, same clause set, no structural change |
| C | controlled format (§9, §10) |

B is the control that separates *the format* from *the rewriting attention*. v2 added it
only conditionally, after a positive result, which is exactly how a confirmatory result
gets manufactured.

**Subjects:** `aif-adr-refine` and `aif-adr-status`.

**Inputs, fixed and committed to the repo:** for `refine` — one `proposed` ADR, one
`draft`, one `accepted` with an active plan, one that fails `validate`; for `status` — a
corpus with a status-directory mismatch and a double-plan ADR.

**Runs:** N = 10 per (variant × input), each in a **fresh session with no prior context**.
Model pinned to one exact snapshot id, recorded in the results file. Temperature at the
product default, recorded. Variant order randomised per input, not blocked, so ordering
effects do not align with variant.

**Scoring:** one human scorer against a written oracle committed alongside the inputs. The
oracle states, per input, the legal transition, the set of blocking questions, and the
exact expected footer. A second scorer independently scores a 20% sample; disagreements
are resolved by amending the oracle and rescoring that metric across all runs. Raw
transcripts and the score sheet are committed under `docs/proposals/cnlp-pilot/`.

**Metrics and minimum effect [v3]:**

| Metric | Type | Decision rule |
|---|---|---|
| scope violations (run ends offering implementation, or edits a non-ADR file) | primary | C must show ≥50% relative reduction versus **B** |
| transition legality (applied without its guard, or omitted when the guard held) | primary | C must show ≥50% relative reduction versus **B** |
| footer-format compliance (exact match) | guard | must not regress versus B |
| blocking-question discipline | secondary | reported, not decisive |
| grounding (recommendation with no rule/ADR/code cited) | secondary | reported, not decisive |
| size, characters | budget | §4.3 |

Comparison is against **B**, not A. Comparing against A measures rewriting effort.

**Zero-baseline rule.** If a primary metric records zero violations under B across all
runs, that metric cannot be improved and is dropped from the decision, with the fact
recorded. **If both primaries are zero under B, the reliability claim is unsupported at
this corpus's difficulty**: the migration is then not justified on reliability, and
proceeds only if it is justified on maintainability alone — which is a different decision,
made explicitly, not inherited.

**Stop condition.** Neither primary improves → the migration stops at the pilot and this
proposal is rejected. Improvement on judgment (`refine`) but not wrapper (`status`) →
scope narrows to judgment and procedural profiles; wave 3 is dropped.

## 12. Impact on the existing test suite **[v3 — corrected]**

`test/skill-rubric.test.js` asserts three things:

1. `## Evaluating solutions` appears exactly once per target skill, before the workflow
   heading (`:40-49`);
2. the block is byte-identical within the FULL group and within the SHORT group (`:51-58`);
3. the five NONE skills contain no such block (`:60-65`).

**Decision: the rubric stays duplicated across the ten skills that have it.** The runtime
loads only `SKILL.md`; there is no include mechanism. A shared rules file that skills
merely reference would very likely not be read at execution time, so the judgment policy
would silently stop applying — a behavioural loss traded for an editorial gain.

**Correction to v2.** v2 claimed the heading constant was the only change. That was true
only because v2 had not noticed its own §5 added the rubric to `migrate` and `supersede`,
which assertion 3 forbids. With §5.1 in force — rubric required exactly where it exists
today — the group memberships are unchanged and the change is again the single constant
`HEADING` (`:19`) → `'## Decision rules'`. Assertion 1 still matches `## Workflow` via
`/^## .*workflow/i` (`:45`); assertion 2 keeps enforcing byte-identity, which is the
guarantee the duplication needs.

**The rename must be atomic across all ten skills** — see §14, wave 0. A test with one
heading constant cannot describe a corpus that is half renamed.

A second test ships with the linter (§13): required sections present per profile, catalog
order, no heading outside the catalog, ids unique and references resolving, every
`Forbidden` line `MUST NOT`, exactly one modal per normative line, size within the profile
budget.

## 13. Lexical discipline

Structure without a controlled lexicon is an API with unstable parameter names.

```text
L1 MUST use plain, common words over rare or literary synonyms.
L2 MUST use one term per concept.
L3 MUST NOT vary the word once the term is chosen.
L4 MUST NOT use idiom, slang, or figurative language.
L5 MUST NOT use a word with several unrelated senses unless the glossary fixes the sense.
L6 MUST prefer a short concrete verb over an abstract one.
L7 MUST define a specialized term once in the glossary and reuse it verbatim.
```

**`skills/GLOSSARY.md`** holds canonical verbs, controlled terms, and the deny-list with a
replacement per entry. It is **authoring-only** — the runtime never loads it, so no
obligation may live there. Versioned with the skills; owned by whoever owns the skill set.

Canonical verbs for this corpus: `run`, `read`, `inspect`, `identify`, `name`, `cite`,
`compare`, `present`, `ask`, `update`, `transition`, `report`, `stop`, `validate`.

Deny-list starting point, each with its replacement: *surface* → `state` or `report`;
*sharpen* → `improve`; *weigh* → `compare`; *leverage* → `use`; *robust* → name the
property; *sanity-check* → `check`; *handle* → name the action; *ensure* → `verify`.

Two deliberate exemptions:

- **Frontmatter `description`** (§3). It feeds skill routing and needs phrasing that
  matches how an operator asks.
- **Established domain terms are not banned**, even when they read as figures of speech.
  `blast radius` is precise in this corpus (`skills/aif-adr-refine/SKILL.md:40`) and goes
  in the glossary rather than on the deny-list.

## 14. Rollout **[v3 — resequenced]**

v2's waves would have left the suite red between wave 1 and wave 2: the FULL group would
carry `## Decision rules` while the SHORT group still carried `## Evaluating solutions`,
and the test has one constant for both. Fixed by pulling the rename out into its own
atomic step, before any structural work.

| Wave | Content | Test state |
|---|---|---|
| **0** | rename `## Evaluating solutions` → `## Decision rules` in all ten rubric skills + the one test constant. Pure rename, no other edit, one commit. | green |
| **pilot A** | rewrite `migrate` on a branch for contract coverage (§11.1); land nothing until the contract is confirmed | untouched |
| **pilot B** | variants A/B/C, measurement (§11.2); results committed under `docs/proposals/cnlp-pilot/` | untouched |
| **decide** | proceed / narrow to a subset of profiles / reject. Record the outcome in this file and in an ADR. | — |
| **1** | judgment profile (5 skills), one commit per skill, each carrying its §8 fidelity map | green |
| **2** | procedural profile (7 skills), `migrate` last | green |
| **3** | wrapper profile (2 skills), only if the pilot justified it | green |

**Linter sequencing [v3].** The reviewer's version — blocking before wave 1 — would fail
on all fourteen unmigrated files on day one. The correct form is scoping: the linter reads
an allowlist of migrated skills, is **blocking from wave 1** on everything in that
allowlist, and the allowlist grows with each wave. Unmigrated files are not checked
because they are not yet claimed to conform. After wave 3 the allowlist is deleted and the
linter checks everything.

**Release:** minor version bump per wave, CHANGELOG entry naming the migrated skills.

**Revert:** one file per commit, one profile per wave — reverting a wave is `git revert` of
its commits. That is why the waves are cut this way.

## 15. Open question

One remains, and it blocks nothing before wave 3:

**Is the wrapper profile worth migrating?** §10 shows +15% size for a small structural
gain on two thin files. §11.2's `status` arm answers it with data. If the answer is no,
`status` and `next` stay as they are, alongside the already-excluded `overview`.

v2's other four open questions are closed in this version: the size budget (§4.3), the
position of `Decision rules` (§6), duplicate prohibitions (§6), and `overview` (§3).

## 16. References

**In-repo**

- `skills/aif-adr-refine/SKILL.md`, `skills/aif-adr-status/SKILL.md`,
  `skills/aif-adr-migrate/SKILL.md` — the skills quoted throughout.
- `test/skill-rubric.test.js` — the rubric invariant of §12.
- `docs/proposals/adr_lens_judgment_cnlp_rewrite.md` — in-repo prior art for the register.

**PRD**

`§17` (transition legality), `§19.2` (refine), `§19.8` (status) refer to sections of the
AI Factory PRD, archived at `docs/archive/ai-factory-adr-extension-PRD.md`. **[v3]** v2
wrote a bare `§17`; the corpus uses bare `§17`, `§18.3`, `§23`, `§27` too, and every one of
them should be qualified `PRD §n` in the migrated files.

**External**

The CNL-P source work is not cited here. v1 carried `[cite:N]` markers resolving to no
bibliography; they were removed rather than left implying support the document did not
contain. Every argument above rests on the corpus in this repository. If this proposal is
accepted, the CNL-P reference is filled in by the author.
