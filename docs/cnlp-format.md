# CNL-P format — the standard

The format all `skills/aif-adr-*/SKILL.md` files use as of 1.11.0, and the target format
for ADR documents. This file is the source of truth for it. Extend it when the format
grows; do not re-derive the rules from an existing file.

## 1. What it is

A document written as structured `key:` blocks instead of prose. One idea per line, one
term per concept, no narrative connective tissue.

The reader that matters executes the document. Prose forces that reader to separate
intent, policy, sequence, and output shape by inference on every run; a `key:` block
states which is which. A human reviewer gets the same benefit — the file is auditable in
one pass.

Compression is a goal, not a side effect. **If a rewrite grows the file, it kept prose it
should have dropped, or it duplicated a section. Both are defects.**

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

- **Frontmatter is never rewritten.** For skills the runtime parses `name` and
  `description` for discovery and routing; for ADRs the frontmatter is the machine
  contract (`id`, `type`, `status`, `plan`, `evidence`, `code`, `replaced_by`, …).
- **No H1.** `name:` in the frontmatter already carries it.
- Sections are top-level `key:` lines in `lower_snake_case`, each followed by its bullets.
- A section ends where the next top-level `key:` begins.
- **Markdown code fences and tables stay** wherever content is verbatim or tabular: shell
  commands, frontmatter examples, text to be inserted into another file, diagrams, report
  templates. A format that cannot hold a shell command is useless here.

## 3. Line rules

- One idea per bullet. A bullet carrying two obligations is two bullets.
- `workflow:` is numbered; every other section is bulleted.
- Plain lowercase prose in the bullet. No `MUST` / `MUST NOT` ceremony, no line ids.
- A rule and its reason go on one line, separated by a colon:
  `do not move files by hand: the command owns the atomic move`.
- An enumerated list inside one idea is fine and is not two ideas:
  `give per approach: consequences over 6–12 months, effect on coupling, hidden risks`.
- Nested bullets are allowed one level deep, only for cases that carry their own steps.

## 4. Sections — skills

Use only the sections a given skill needs. Order as listed.

| Section | Holds |
|---|---|
| `mode` | one-line operating mode of the skill |
| `purpose` | why it exists and what it produces |
| `inputs` | what the operator supplies; `none` when it discovers its own |
| `preconditions` | state that must already hold before step 1 |
| `scope` | what the skill may act on — omit when `workflow` already bounds it |
| `forbidden_behaviors` | prohibitions, one per bullet, each with its reason |
| `outputs` | what the run emits — omit when it duplicates another section |
| `quality_rules` | standing judgment policy applied throughout, not at one step |
| `workflow` | ordered actions, one observable action per step |
| `transitions` | legal state changes, as `from` / `condition` / `action` records |
| `status_footer` | `format:` and `source:` of the closing line |
| `invocation` | the Claude Code and Codex invocation lines |

A skill may add a section its subject genuinely needs — `verdicts`, `lenses`,
`plan_disposition`, `command_behaviour`, `follow_up`, `report_format` are all in use.
Name it for what it holds and keep it in `lower_snake_case`.

## 5. Sections — ADRs

An ADR keeps the four template `##` headings and puts CNL-P blocks inside them. The
headings are the shared contract with `templates/adr.md`, `aif-adr-accept`'s preconditions
and `aif-adr-migrate`; the blocks are what replaces the prose.

```markdown
## Context

problem:
- what breaks today, in one observable statement per line

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
1. named_rule:
   - the obligation it creates

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

Optional blocks that earn their place on a real ADR: `out_of_scope:` with a `trigger:` per
deferred item, `unproven_hypothesis:` with `acceptance_test:` and `metric:`,
`increment_order:` when the decision ships in stages. A worked example lives at
`docs/proposals/adr_lens_judgment_cnlp_rewrite.md`.

**Hard constraint from the tooling.** `ai-factory adr validate`
(`src/lifecycle/validate.js`) does not check body headings, but on an `accepted` or
`active` ADR it rejects the template sentinels: `[decision]`, `[scope]`, `[main reason]`,
`[Alternative]`, `not created`, `not implemented`. A migrated ADR must contain none of
them.

## 6. Lexicon

- Use plain, common words over rare or literary ones.
- One term per concept, and do not vary the word once it is chosen.
- No idioms, no slang, no figurative language.
- No word with several unrelated senses unless this file fixes the sense.
- A short concrete verb over an abstract one.
- Define a specialized term once, then reuse it verbatim.
- The frontmatter `description` is **exempt**: it feeds skill routing and needs the
  phrasing an operator would actually use.

**Prohibition is always `do not`.** `never` is not used as a bullet opener — one concept,
one term. `never` inside a sentence, qualifying a clause, is fine
(`the operator decides, do not silently downgrade`).

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

## 7. No section restates another

Each fact appears once, in the section that owns it.

- A rule already in `preconditions` is not repeated in `forbidden_behaviors`, and the
  workflow step that checks it names the check, not the rule again.
- `outputs:` is dropped when `command_behaviour:` or `workflow:` already states what the
  run produces.
- `scope:` is dropped when it only paraphrases `workflow:`.

This is the rule most often broken by a first draft. When a file grows during migration,
look here first.

## 8. Migration procedure

1. **List the source's rules before rewriting.** Every normative statement, including the
   ones buried in a subordinate clause.
2. Rewrite into the sections above.
3. **Tick each listed rule against the result.** Anything deliberately dropped is stated
   out loud, with the reason.
4. **Check the reverse direction.** Any rule in the result that has no origin in the
   source is an addition — say so; do not let it arrive silently.
5. Compare size. Smaller is expected. Larger means §7 was broken or prose survived.
6. For skills, run `npm test`: `test/skill-rubric.test.js` asserts the shared
   `quality_rules:` block is byte-identical across the skills that carry it.

Formalizing prose finds defects in the prose — contradictory rules, branches that turn out
not to be mutually exclusive, instructions the tooling rejects. Report them; do not resolve
them silently inside a format migration.
