---
name: plan
description: The CNL-P profile of an ADR implementation plan, with core task checkboxes and reciprocal ADR links.
---

format: cnlp-format.md

mood: imperative

headings:
- ## Original Request
- ## Tasks
- ## Verification

frontmatter_fields:
- id
- type
- status
- depends_on
- implements
- format

lexicon_exempt:
- none: the body directs the implementation of the linked decision

sections:
- key: goal
  form: scalar
  required: yes
  heading: "## Original Request"
  note: the implementation outcome, without copying the ADR decision
- key: scope
  form: bullet-list
  required: no
  heading: "## Original Request"
- key: tasks
  form: bullet-list
  required: yes
  heading: "## Tasks"
  note: retain core "- [ ]" or "- [x]" task checkboxes and stable task ids
- key: task_details
  form: record-list
  required: yes
  heading: "## Tasks"
  record_keys: id, files, change, acceptance, verification
  optional_record_keys: depends_on
  note: each id refers to 1 checkbox task; name the failure each test prevents in acceptance
- key: verification
  form: numbered-list
  required: yes
  heading: "## Verification"
- key: risks
  form: bullet-list
  required: no
  heading: "## Verification"

custom_sections:
- none: the task records carry implementation details

enforcement:
- `ai-factory adr format plan --check <plan-file>` checks the body; every issue is an error regardless of task progress
- `adr-plan` writes `format: cnlp-plan` in new plans; `adr-plan-improve` and `adr-implement` preserve and check that format
- existing plans without the format marker retain their core format; no lifecycle command migrates or rejects them for this profile
- task identity, checkbox syntax and reciprocal ADR links remain core workflow checks rather than CNL-P body checks
