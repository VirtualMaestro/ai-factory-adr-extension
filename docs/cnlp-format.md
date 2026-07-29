# CNL-P format — the standard

A way to write any document an agent has to read precisely. This file is the source of
truth for it. Extend it when the format grows; do not re-derive the rules from an existing
file.

**Every rule here holds for every document.** What differs between one kind of document and
another — its blocks, their order, whether it has headings — is declared in a *profile*
(§7), never branched inside a rule. Two profiles ship today, `profiles/skill.md` and
`profiles/adr.md`; a third kind of document is added by writing a third profile, with no
change to this file.

**What is enforced:** `src/artifacts/cnlp.js` checks the mechanical rules, reading the
profile for the values. Each profile's `enforcement:` block names the command or test that
runs it. No check can judge whether a bullet says something useful — only whether the
document is shaped and worded as declared.

## 1. What it is

A document written as structured `key:` blocks instead of prose. One idea per line, one
term per concept, no narrative connective tissue.

Prose leaves the reader to work out which sentence is intent, which is policy, which is
sequence and which is the shape of the answer — by inference, every time the document is
read. A `key:` block states which is which. That helps a document that is executed and a
document that is consulted for the same reason: neither reader should have to reconstruct
the structure before using the content. A human reviewer gets the same benefit — the file is
auditable in one pass.

## 2. Shape

```
---
name: …          <- YAML frontmatter, untouched
description: …
---

first_key:
- one idea
- one idea

second_key:
1. first step
2. second step
```

- **Frontmatter is never rewritten.** It is the machine contract of the document kind; the
  profile lists its fields in `frontmatter_fields:`.
- Sections are top-level `key:` lines in `lower_snake_case`.
- A section ends where the next **unindented** `key:` begins, or where the next `##`
  heading begins. Anything indented belongs to the section above it.
- **Headings come from the profile.** A profile that declares `headings:` has an H1 title
  and those `##` headings partitioning the body, and each block names the heading it sits
  under. A profile that declares none has a flat body and the title lives in the
  frontmatter.

## 3. Section forms

Every section is one of five forms. **The profile declares the form of each block**; mixing
forms inside one section is not allowed.

**scalar** — one value on the key line.

```
mode: adr_refinement
decision: use a shared external session store for all authenticated sessions
```

**bullet-list** — the default. Unindented `- ` items.

```
purpose:

```

**numbered-list** — unindented `N. ` items, ordered, for a sequence.

```
workflow:
1. run `ai-factory adr validate <file>`
2. fix the validation errors it reports
```

**record-list** — repeated records. Each record opens with `- key: value` and continues
with **two-space-indented** keys. Every record in one section carries the keys the profile
lists in `record_keys:`, and may carry those in `optional_record_keys:`. A key the profile
does not declare is not added to a record: it is prose looking for a home.

```
transitions:
- from: proposed
  condition: first refine and the file is actually improved
  action: `ai-factory adr transition <file> draft`
- from: draft
  condition: repeat refine
  action: none, it stays draft
```

**keyed-block** — a fixed set of named sub-values, or one verbatim fenced block. Sub-keys
are **two-space-indented**; a fenced block sits directly under the key.

```
status_footer:
  format: "✔ aif-adr-refine · ADR: <adr-id> [<status>] · Plan: <plan-id or none>"
  source: `ai-factory adr status <adr-file>`

report_format:
```text
| # | Suggestion | Verdict | Justification |
```
```

**Nesting is one level deep**, and only inside a record-list or a keyed-block. A bullet
never carries sub-bullets to hold a second thought — that is two bullets.

**A fenced block is opaque.** Its contents are verbatim data, not structure: the `id:` and
`type:` lines inside a `plan_frontmatter:` fence are frontmatter fields of another document,
not CNL-P sections. Anything reading this format skips fenced regions before looking for
section keys.

**An empty block.** A required block with nothing in it carries `- none` and the reason:
`- none: no alternative was viable at this scale`. That single line is the whole content and
replaces the form the block would otherwise take, so a record-list or a keyed-block says it
the same way a bullet-list does. It is the *whole* content: `- none` next to a real item says
the block is both empty and not, and the check rejects it. An optional block with nothing in
it is deleted rather than marked, so `- none` in one is also rejected. A key with no items at
all is neither, and the check rejects that too.

A **scalar** has no empty form: it holds the one value the block exists for, so a scalar with
nothing to say means the document is unfinished, and the check says so.

A block whose content is a fenced region is not empty — the fence is opaque, not absent.

## 4. Line rules

- One idea per bullet. A bullet carrying two obligations is two bullets.
- **Length: 150 characters is the target, 250 is the hard limit.** It applies to every line
  outside a fence — a bullet, a step, a scalar value, a record sub-key — because each of them
  holds one idea. The median across the
  migrated corpus is 72. Past 150, check whether the line holds a condition, a reason and an action at once;
  if so, split it. A line that is long only because one idea enumerates its parts is fine
  and is not split — that is the `give per approach: a, b, c` case below. Past 250 the
  line is compound whatever it claims, and the check rejects it.
- Plain lowercase prose in the bullet. No `MUST` / `MUST NOT` ceremony, no line ids.
- A rule and its reason go on one line, separated by a colon:
  `do not move files by hand: the command owns the atomic move`.
- An enumerated list inside one idea is fine and is not two ideas:
  `give per approach: consequences over 6–12 months, effect on coupling, hidden risks`.
- **Markdown code fences and tables stay** wherever content is verbatim or tabular: shell
  commands, frontmatter examples, text inserted into another file, diagrams, report
  templates. A format that cannot hold a shell command is useless here.

## 5. Lexicon

- Use plain, common words over rare or literary ones.
- One term per concept, and do not vary the word once it is chosen.
- No idioms, no slang, no figurative language.
- No word with several unrelated senses unless this file fixes the sense.
- A short concrete verb over an abstract one.
- Define a specialized term once, then reuse it verbatim.

**Quoted text is data.** Anything inside quotes or backticks is a value the document carries
— a command, a name, a claim being reported — not a claim the document makes, so no rule
below applies to it. That is what lets a document name a bad argument in order to reject it:
`do not accept "faster to write" as justification`.

**Prohibition is always `do not`.** `never` is not used as a bullet opener — one concept,
one term. `never` inside a sentence, qualifying a clause, is fine
(`the operator decides, do not silently downgrade`).

**A threshold is a digit.** `exactly 1 primary decision`, `at least 2 viable approaches`,
`more than 1 non-archived plan` — the reader has to check the value against something, so
it is written as a value. A digit also stands out against lowercase prose, and reads as a
parameter rather than as a word that must first be mapped to a number.

A number that is not a threshold stays a word: inside an idiom (`two ways of doing one
thing is a real cost`), inside a hyphenated adjective (`one-line`, `two-space-indented`),
or as an ordinal (`first refine`). Digits there read as a typo.

**A limit is written as a comparison.** The canonical form is
`<subject> <operator> <value> <unit>`: `open connections per client <= 2`,
`p95 latency <= 200 ms`. The phrase form leaves the reader to work out whether the bound is
inclusive; the operator makes the author decide once, at the time the decision is made.

- operators are `<`, `<=`, `>`, `>=`, `=`, `!=`, and a closed range written `2..5`.
- the subject and the unit stay attached: `open connections per client <= 2`, not a bare `<= 2`.
- do not invent a threshold nobody agreed: an unagreed "fast startup" stays prose and marks
  the document unfinished; the rule formalizes a limit, it does not fabricate one.
- a number that is a determiner inside a sentence keeps the word-plus-digit form:
  `present at least 2 viable approaches` is an instruction, not a limit to check a value against.

The check rejects only the phrases whose bound is genuinely open — `no more than`,
`at most`, `up to`, `not exceeding`, `no fewer than`, `not less than`. `at least`,
`exactly`, `more than`, `fewer than` and `only` state their bound, so they are left to
review, the same split §4 makes between the 150-character target and the 250-character
hard limit.

**An unquantified comparative is not a decision.** A comparative claims a value the reader
cannot check, so it is replaced by the property and its bound, or dropped.

| Instead of | Write |
|---|---|
| better, faster, cleaner | the property and its bound: `p95 latency <= 200 ms` |
| significantly, substantially | the measured delta |
| flexible, scalable, extensible | the axis it varies on, with its bound |
| where possible, if needed, as appropriate | the condition that triggers it |
| should probably, we may want to | the decision, or move the line to the block that owns doubt |

**Canonical verbs**, for a profile whose `mood:` is `imperative`: `run`, `read`, `inspect`,
`identify`, `name`, `cite`, `compare`, `present`, `ask`, `update`, `transition`, `report`,
`record`, `state`, `stop`, `verify`, `validate`. A profile whose mood is `declarative`
states what is true instead of what to do, in the present tense, and has no verb list.

Deny-list, each with its replacement:

| Instead of | Write |
|---|---|
| surface | `state` or `report` |
| sharpen | `improve` |
| weigh | `compare` |
| leverage | `use` |
| ensure | `verify` |
| handle | name the action |
| robust | name the property |
| sanity-check | `check` |

Established domain terms are not on the deny-list even when they read as figures of
speech: `blast radius` is precise here and stays.

## 6. No section restates another

Each fact appears once, in the block that owns it.

- **The frontmatter is a block like any other.** A body line repeating a frontmatter field —
  a code path, an id, a status, a link to another document — is a second copy that goes
  stale. Naming another document inside a sentence is fine; carrying the relation there is
  not.
- A rule already stated in one block is not repeated in another, and the step that checks it
  names the check, not the rule again.
- A block is dropped when another block already states its content.
- Two blocks that state *different* facts about one thing are not a repetition: when
  something is emitted and what shape it has are two facts. Stating it a third time is the
  repetition, and that one goes.

A profile adds the pairs its own blocks confuse, as `note:` on the sections concerned — for
example, a cost that is certain against a risk that may not happen.

This is the rule most often broken by a first draft. When a file grows during migration,
look here first.

## 7. The profile contract

A profile is itself a CNL-P document, in `profiles/<name>.md`. It declares values, never
rules — a rule in a profile is a rule that escaped this file.

**`format:` closes the loop.** This file states the rules and a profile states the values, so
the two are read together and neither is complete alone. A reader arriving at a profile —
sent there by a skill, or by the document kind it describes — follows `format:` to the rules
first, then reads the profile for the blocks they apply to.

**The path in `format:` is inside the extension package**, which is not the root of the
project the documents live in. From a project, `ai-factory adr format` prints the standard,
`ai-factory adr format <profile>` prints a profile, and `--path` gives the resolved location
to open directly. A document that names one of these files by path is naming something its
own reader cannot find.

| Block | Form | Holds |
|---|---|---|
| `format` | scalar | the standard this profile's documents obey, by path |
| `mood` | scalar | `imperative` or `declarative` (§5) |
| `headings` | bullet-list | the `##` headings in order, or `- none` for a flat body |
| `frontmatter_fields` | bullet-list | the fields §6 forbids the body to restate |
| `lexicon_exempt` | bullet-list | frontmatter fields the lexicon does not police, with the reason |
| `sections` | record-list | the blocks, in order |
| `custom_sections` | bullet-list | names a document of this kind may add, or `- none` |
| `enforcement` | bullet-list | the command or test that checks this profile, and its severity |

A `sections:` record carries `key`, `form` (one of the five in §3) and `required`
(`yes`/`no`), plus `heading`, `record_keys`, `optional_record_keys` and `note` where they
apply. The order of the records is the order the blocks appear in. `required: yes` means the
document is not conformant without the block; a block that is needed only under some
condition is `required: no` with the condition in its `note:`, because that judgment is not
mechanical.

A `custom_sections:` name is a block the checker accepts but does not shape: reference
material, a vocabulary the document refers to, or behaviour owned by something else. Reuse a
name already on the list before inventing one — a new name is a new place for prose to hide.

**Where a custom block sits** is decided by what it is, in every profile, and the test is
whether the reader needs it in hand or is sent to it:

- a **term** the steps use without introducing it goes *before* the block that uses it, so it
  is read first: `verdicts`, `lenses`, `order_fields`, `plan_frontmatter`.
- a **case table** a step names at the point of use goes *after*: `status_mapping`,
  `file_shape`, the `*_overlay` blocks. The step that says "apply the one matching case in
  `file_shape`" resolves the reference itself, and moving the table above the steps buries
  them.
- **behaviour owned by something else**, or anything describing what happens after the run,
  goes *after*: `command_behaviour`, `follow_up`, `report_format`, `expected_warnings`.

A custom block is allowed only when its content is neither a rule, a step, nor an output —
those have declared blocks already. Placement is judgment: no check enforces it.

**What the checker reads.** `headings`, `frontmatter_fields`, `sections` and
`custom_sections` shape the check. `format`, `mood`, `lexicon_exempt`, `enforcement` and
every `note:` are for whoever writes the document: a mood is a register, not a grammar, and
`lexicon_exempt` names frontmatter fields, which no body check sees. A profile states both
kinds, and this table says which is which so neither is mistaken for the other.

`profiles/profile.md` is the profile of a profile, so the same check covers the profile
files themselves — including that one, which is checked against itself. Nothing checks that
last step; the recursion stops there on purpose.

## 8. Migration procedure

1. **List the source's rules before rewriting.** Every normative statement, including the
   ones buried in a subordinate clause.
2. Rewrite into the profile's blocks.
3. **Tick each listed rule against the result.** Anything deliberately dropped is stated
   out loud, with the reason.
4. **Check the reverse direction.** Any rule in the result that has no origin in the
   source is an addition — say so; do not let it arrive silently.
5. **Measure the size and state the cause of any growth.** Growth is not automatically a
   defect: splitting one prose sentence into the three obligations it was hiding
   legitimately adds lines, and so does fixing a defect found during the rewrite. Growth
   with no such cause means §6 was broken or prose survived.
6. Run the check named in the profile's `enforcement:`.

Formalizing prose finds defects in the prose — contradictory rules, branches that turn out
not to be mutually exclusive, instructions the tooling rejects. Report them; do not resolve
them silently inside a format migration.
