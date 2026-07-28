---
name: skill
description: The CNL-P profile of an agent skill — the sections a SKILL.md body uses, in order.
---

format: docs/cnlp-format.md

mood: imperative

headings:
- none: a skill body is one flat run of sections, and frontmatter `name` carries the title

frontmatter_fields:
- name
- description

lexicon_exempt:
- description: it feeds skill routing and needs the phrasing an operator would actually use

sections:
- key: mode
  form: scalar
  required: yes
  note: a human label; no machine consumer reads it
- key: purpose
  form: bullet-list
  required: yes
- key: inputs
  form: bullet-list
  required: yes
  note: "- none when the skill discovers its own"
- key: preconditions
  form: bullet-list
  required: no
  note: when state must hold before step 1
- key: scope
  form: bullet-list
  required: no
  note: only when workflow does not already bound it
- key: forbidden_behaviors
  form: bullet-list
  required: no
  note: when the skill has prohibitions
- key: outputs
  form: bullet-list
  required: no
  note: only when nothing else states what the run produces
- key: quality_rules
  form: bullet-list
  required: no
  note: the 2 shared rubrics are copied verbatim; test/skill-rubric.test.js asserts byte-identity within each group
- key: workflow
  form: numbered-list
  required: yes
  note: aif-adr-overview is the one reference-material skill and has none
- key: transitions
  form: record-list
  required: no
  record_keys: from, condition, action
  note: when the skill changes an ADR's lifecycle status
- key: status_footer
  form: keyed-block
  required: no
  record_keys: format, source
  optional_record_keys: note, empty_form
  note: the workflow states when the footer is emitted, this states what shape it has
- key: invocation
  form: bullet-list
  required: yes

custom_sections:
- command_behaviour
- documentation_only_adrs
- documentation_only_overlay
- expected_warnings
- file_shape
- follow_up
- improving_the_plan
- instruction_pointer
- lenses
- lifecycle_flow
- linear_flow_skills
- off_flow_skills
- order_fields
- plan_disposition
- plan_frontmatter
- pre_1_6_overlay
- pre_cnlp_overlay
- report_format
- retrieval_order_afterwards
- rules_that_always_hold
- status_directories
- status_mapping
- targeting_rationale
- verdicts
- when_to_supersede_instead_of_editing

enforcement:
- `npm test` (`test/skill-format.test.js`), over every skill in `skills/`
- any issue is an error: a skill ships as executable instructions, so there is no draft state to warn about
