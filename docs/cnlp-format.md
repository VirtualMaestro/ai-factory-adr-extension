# CNL-P format — the standard

A way to write any document an agent has to read precisely. This file is the source of
truth for it. Extend it when the format grows; do not re-derive the rules from an existing
file.

**Two profiles are defined today**: skills (§5) and ADRs (§7). A profile names the sections
its document kind uses and their order — nothing else. §2–§4 and §8–§10 hold for every
profile, so a third one is added by writing its section vocabulary, not by changing the
format.

**What is enforced:** `test/skill-format.test.js` checks the mechanical rules on every
`npm test`, for the skills profile only. The ADR profile is held by review and by
`ai-factory adr validate`, because this repository ships the ADR lifecycle for other
projects and holds no ADRs of its own to check against.

## 1. What it is

A document written as structured `key:` blocks instead of prose. One idea per line, one
term per concept, no narrative connective tissue.

Prose leaves the reader to work out which sentence is intent, which is policy, which is
sequence and which is the shape of the answer — by inference, every time the document is
read. A `key:` block states which is which. That helps a document that is executed, like a
skill, and a document that is consulted, like an ADR, for the same reason: neither reader
should have to reconstruct the structure before using the content. A human reviewer gets
the same benefit — the file is auditable in one pass.

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

Universal:

- **Frontmatter is never rewritten.** For skills the runtime parses `name` and
  `description` for discovery and routing; for ADRs the frontmatter is the machine
  contract (`id`, `type`, `status`, `plan`, `evidence`, `code`, `replaced_by`, …).
- Sections are top-level `key:` lines in `lower_snake_case`.
- A section ends where the next **unindented** `key:` begins, or where the next `##`
  heading begins. Anything indented belongs to the section above it.

Per profile:

- **skills** — no H1 and no `##` headings; the body is one flat run of sections, and
  `name:` in the frontmatter carries the title.
- **ADRs** — an H1 holds the decision title, and 4 `##` headings partition the body. The
  `key:` blocks live inside them, so a heading is also a section boundary.

## 3. Section types

Every section is one of five forms. A section declares its form by its shape; mixing forms
inside one section is not allowed.

**scalar** — one value on the key line.

```
mode: adr_refinement
decision: use a shared external session store for all authenticated sessions
```

**bullet-list** — the default. Unindented `- ` items.

```
purpose:
- refine a proposal or draft ADR (PRD §19.2)
- keep the task limited to ADR refinement
```

**numbered-list** — `workflow:` and ADR `rules:` only. Unindented `N. ` items, ordered.

```
workflow:
1. run `ai-factory adr validate <file>`
2. fix the validation errors it reports
```

**record-list** — repeated records. Each record opens with `- key: value` and continues
with **two-space-indented** keys. Every record in one section has the same keys.

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
`type:` lines inside `aif-adr-plan`'s `plan_frontmatter:` are ADR frontmatter fields, not
CNL-P sections. Anything reading this format skips fenced regions before looking for
section keys.

## 4. Line rules

- One idea per bullet. A bullet carrying two obligations is two bullets.
- **Length: 150 characters is the target, 250 is the hard limit.** The median across the
  migrated skills is 72. Past 150, check whether the line holds a condition, a reason and an action at once;
  if so, split it. A line that is long only because one idea enumerates its parts is fine
  and is not split — that is the `give per approach: a, b, c` case below. Past 250 the
  line is compound whatever it claims, and the conformance test rejects it.
- Plain lowercase prose in the bullet. No `MUST` / `MUST NOT` ceremony, no line ids.
- A rule and its reason go on one line, separated by a colon:
  `do not move files by hand: the command owns the atomic move`.
- An enumerated list inside one idea is fine and is not two ideas:
  `give per approach: consequences over 6–12 months, effect on coupling, hidden risks`.
- **Markdown code fences and tables stay** wherever content is verbatim or tabular: shell
  commands, frontmatter examples, text inserted into another file, diagrams, report
  templates. A format that cannot hold a shell command is useless here.

## 5. Profile — skills

Order as listed. `required` means the file is not conformant without it.

| Section | Form | Required |
|---|---|---|
| `mode` | scalar | yes — a human label; no machine consumer reads it |
| `purpose` | bullet-list | yes |
| `inputs` | bullet-list | yes — `- none` when the skill discovers its own |
| `preconditions` | bullet-list | when state must hold before step 1 |
| `scope` | bullet-list | only when `workflow:` does not already bound it |
| `forbidden_behaviors` | bullet-list | when the skill has prohibitions |
| `outputs` | bullet-list | only when nothing else states what the run produces |
| `quality_rules` | bullet-list | for the ten skills that carry the shared rubric |
| `workflow` | numbered-list | yes, unless the skill is reference material |
| *any custom sections (§6)* | any, see §6 | — |
| `transitions` | record-list | when the skill changes an ADR's lifecycle status |
| `status_footer` | keyed-block (`format`, `source`) | when the skill emits a footer |
| `invocation` | bullet-list | yes |

A backticked name in that table is a literal key, written verbatim into the file. The
italic row is a placement marker, not a section name — it shows where a skill's custom
sections sit in the order; §6 says how each one is named.

`aif-adr-overview` is the one reference-material skill and has no `workflow:`.

The two `quality_rules:` variants — long and short — are copied verbatim into the skills
that carry them. There is no include mechanism in the runtime, so the duplication is
deliberate; `test/skill-rubric.test.js` asserts byte-identity within each group.

## 6. Custom sections — skills profile

The placement rule below names `forbidden_behaviors:`, `workflow:` and `status_footer:`, so
it applies to the skills profile only. §7's "optional blocks" paragraph is the ADR
equivalent.

A custom section is allowed when the content is **neither a rule, a step, nor an output**:
a reference table, a vocabulary the workflow refers to, or behaviour owned by a command
rather than by the skill.

- `lower_snake_case`, and it declares one of the five forms in §3.
- It sits between `forbidden_behaviors:` and `status_footer:`, and **its side of
  `workflow:` follows what it is**: a vocabulary the workflow refers to by name goes
  *before* the workflow, so it is read first (`verdicts`, `lenses`, `order_fields`,
  `plan_disposition`); behaviour owned by a command, or anything describing what happens
  after the run, goes *after* it (`command_behaviour`, `follow_up`, `report_format`,
  `expected_warnings`).
- **Reuse a name from the list below before inventing one.** A new name is a new place for
  prose to hide.

In use today: `command_behaviour`, `documentation_only_adrs`, `documentation_only_overlay`,
`expected_warnings`, `file_shape`, `follow_up`, `improving_the_plan`, `instruction_pointer`,
`lenses`, `lifecycle_flow`, `linear_flow_skills`, `off_flow_skills`, `order_fields`,
`plan_disposition`, `plan_frontmatter`, `report_format`, `retrieval_order_afterwards`,
`rules_that_always_hold`, `status_directories`, `status_mapping`, `targeting_rationale`,
`verdicts`, `when_to_supersede_instead_of_editing`.

## 7. Profile — ADRs

An ADR keeps its H1 decision title and the 4 template `##` headings, and puts CNL-P blocks
inside them. The headings are the shared contract with `templates/adr.md`,
`aif-adr-accept`'s preconditions and `aif-adr-migrate`; the blocks replace the prose.

| Heading | Blocks | Form |
|---|---|---|
| `## Context` | `problem`, `constraints`, `decision_drivers` | bullet-list |
| `## Decision` | `decision` | scalar |
| | `scope` | bullet-list |
| | `rules` | numbered-list |
| `## Alternatives considered` | `alternatives` | record-list: `id`, `description`, `rejected_because`, optional `kept_as` |
| `## Consequences` | `positive`, `negative`, `risks`, `blast_radius` | bullet-list |

```markdown
## Context

problem:
- what breaks today, one observable statement per line

constraints:
- what cannot be violated

decision_drivers:
- the criteria that decide the choice

## Decision

decision: one sentence naming the choice and its scope

scope:
- what this decision covers
- excludes: what it deliberately does not

rules:
1. the obligation the decision creates

## Alternatives considered

alternatives:
- id: short-slug
  description: what it was
  rejected_because: the concrete reason
  kept_as: what survived from it, when anything did

## Consequences

positive:
- what improves

negative:
- what it costs

risks:
- risk -> mitigation, or "not eliminated"

blast_radius:
- what the change touches
```

Optional blocks that earn their place on a real ADR: `out_of_scope` (record-list with a
`trigger` per deferred item), `unproven_hypothesis` (keyed-block with `acceptance_test` and
`metric`), `increment_order` (numbered-list) when the decision ships in stages. They are blocks inside
the 4 headings, not headings of their own.

A worked example lives at `docs/proposals/adr_lens_judgment_cnlp_rewrite_example.md`. **Copy
its register and its block style, not its heading set** — it was written before this profile
existed, so it names its first heading `## Problem` instead of `## Context` and promotes
`out_of_scope` and a sibling-ADR note to `##` headings. The 4 headings above are the
contract, because `templates/adr.md`, `aif-adr-accept` and `aif-adr-migrate` all key off
them.

**Hard constraint from the tooling.** `ai-factory adr validate`
(`src/lifecycle/validate.js`) does not check body headings, but on an `accepted` or
`active` ADR it rejects the template sentinels: `[decision]`, `[scope]`, `[main reason]`,
`[Alternative]`, `not created`, `not implemented`. A scaffolded ADR carries them on
purpose — `templates/adr.md` ships them and `validate` is expected to fail until they are
filled. A finished ADR contains none.

## 8. Lexicon

- Use plain, common words over rare or literary ones.
- One term per concept, and do not vary the word once it is chosen.
- No idioms, no slang, no figurative language.
- No word with several unrelated senses unless this file fixes the sense.
- A short concrete verb over an abstract one.
- Define a specialized term once, then reuse it verbatim.
- The frontmatter `description` is **exempt** in the skills profile: it feeds skill routing
  and needs the phrasing an operator would actually use.

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

The conformance test enforces the quantified form — a number after `at least`, `exactly`,
`more than`, `fewer than`, `no more than` or `only`. A limit stated without one of those
words is a judgment call, the same split §4 makes between the 150-character target and the
250-character hard limit.

Canonical verbs: `run`, `read`, `inspect`, `identify`, `name`, `cite`, `compare`,
`present`, `ask`, `update`, `transition`, `report`, `record`, `state`, `stop`, `verify`,
`validate`.

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

## 9. No section restates another

Each fact appears once, in the section that owns it.

In the skills profile:

- A rule already in `preconditions` is not repeated in `forbidden_behaviors`, and the
  workflow step that checks it names the check, not the rule again.
- `outputs:` is dropped when `workflow:`, `purpose:` or `command_behaviour:` already states
  what the run produces.
- `scope:` is dropped when it only paraphrases `workflow:`.

In the ADR profile:

- `constraints` holds what the decision cannot violate; `decision_drivers` holds what
  chooses between the options. A line that appears in both means one of them is doing the
  other's job.
- `negative` holds a cost the decision is known to incur; `risks` holds something that may
  or may not happen, with its mitigation. A certainty in `risks` belongs in `negative`.
- `rejected_because` on an alternative is not restated in `negative`: the cost of the road
  not taken is not a consequence of the decision.

**The footer is the one deliberate exception, and it is not a repetition.** The workflow's
last step states *when* it is emitted; `status_footer:` states *what shape* it has. Those
are two facts. Naming it a third time in `outputs:` is the repetition, and that one goes.

This is the rule most often broken by a first draft. When a file grows during migration,
look here first.

## 10. Migration procedure

1. **List the source's rules before rewriting.** Every normative statement, including the
   ones buried in a subordinate clause.
2. Rewrite into the sections above.
3. **Tick each listed rule against the result.** Anything deliberately dropped is stated
   out loud, with the reason.
4. **Check the reverse direction.** Any rule in the result that has no origin in the
   source is an addition — say so; do not let it arrive silently.
5. **Measure the size and state the cause of any growth.** Growth is not automatically a
   defect: splitting one prose sentence into the three obligations it was hiding
   legitimately adds lines, and so does fixing a defect found during the rewrite. Growth
   with no such cause means §9 was broken or prose survived.
6. Run the profile's checks: `npm test` for a skill, `ai-factory adr validate <file>` for an
   ADR.

Formalizing prose finds defects in the prose — contradictory rules, branches that turn out
not to be mutually exclusive, instructions the tooling rejects. Report them; do not resolve
them silently inside a format migration.
