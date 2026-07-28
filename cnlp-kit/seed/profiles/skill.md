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
  note: "- none with the reason when the skill discovers its own"
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
  note: the shared rubric, copied verbatim into every skill that carries it
- key: workflow
  form: numbered-list
  required: yes
  note: reference material states "- none" with the reason instead of carrying steps
- key: invocation
  form: bullet-list
  required: yes

custom_sections:
- none: fill this from the inventory step of cnlp-migrate, before rewriting any skill

enforcement:
- `node --test test/skill-format.test.js`, over every skill in the configured skills directory
- any issue is an error: a skill ships as executable instructions, so there is no draft state to warn about
- a repository without Node holds this profile by review against the standard instead
