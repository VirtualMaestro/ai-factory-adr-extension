---
name: adr
description: The CNL-P profile of an architecture decision record — the blocks an ADR body uses, in order.
---

format: docs/cnlp-format.md

mood: declarative

headings:
- ## Context
- ## Decision
- ## Alternatives considered
- ## Consequences

frontmatter_fields:
- id
- type
- status
- owners
- depends_on
- affects
- supersedes
- code
- issue
- plan
- evidence
- replaced_by

lexicon_exempt:
- none: every field of an ADR body is read by a person deciding whether the rule applies

sections:
- key: problem
  form: bullet-list
  required: yes
  heading: "## Context"
  note: what breaks today, one observable statement per line
- key: constraints
  form: bullet-list
  required: yes
  heading: "## Context"
  note: what the decision cannot violate; what chooses between options is decision_drivers
- key: decision_drivers
  form: bullet-list
  required: yes
  heading: "## Context"
  note: the criteria that decide the choice
- key: decision
  form: scalar
  required: yes
  heading: "## Decision"
  note: the choice alone; its boundary is scope and its reason is decision_drivers
- key: scope
  form: bullet-list
  required: yes
  heading: "## Decision"
  note: what the decision covers, and one line opening "excludes:" for what it does not
- key: rules
  form: numbered-list
  required: yes
  heading: "## Decision"
  note: the obligations the decision puts on the codebase
- key: out_of_scope
  form: record-list
  required: no
  heading: "## Decision"
  record_keys: item, trigger
  note: a deferred item and the event that would reopen it
- key: increment_order
  form: numbered-list
  required: no
  heading: "## Decision"
  note: for a decision that ships in stages
- key: alternatives
  form: record-list
  required: yes
  heading: "## Alternatives considered"
  record_keys: id, description, rejected_because
  optional_record_keys: kept_as
  note: rejected_because is the cost of the road not taken, so it is not restated in negative
- key: positive
  form: bullet-list
  required: yes
  heading: "## Consequences"
  note: what improves
- key: negative
  form: bullet-list
  required: yes
  heading: "## Consequences"
  note: a cost the decision is known to incur; something that may not happen is a risk
- key: risks
  form: bullet-list
  required: yes
  heading: "## Consequences"
  note: risk -> mitigation, or "not eliminated"
- key: unproven_hypothesis
  form: keyed-block
  required: no
  heading: "## Consequences"
  record_keys: claim, acceptance_test, metric
  note: a claim the decision rests on and how it would be measured
- key: blast_radius
  form: bullet-list
  required: no
  heading: "## Consequences"
  note: required when the decision changes code; what the change touches

custom_sections:
- none: an ADR block that is not listed above is prose looking for a home

enforcement:
- `ai-factory adr validate <file>` (`src/lifecycle/validate.js`, inv 12)
- a warning while the ADR is `proposed`, `draft` or `superseded`, an error once it is `accepted` or `active`
- the gate is where the document becomes a rule other work is measured against
- the template sentinels are rejected on the same gate: `[decision]`, `[scope]`, `[main reason]`, `[Alternative]`, `not created`, `not implemented`
