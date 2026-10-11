---
name: live
description: The CNL-P profile of LIVE.md — what the product does now, one record per capability.
---

format: cnlp-format.md

mood: declarative

headings:
- none: LIVE.md is 1 flat block, and the frontmatter carries the title

frontmatter_fields:
- type
- title
- since

lexicon_exempt:
- none: every record is read by an agent deciding what the product does now

sections:
- key: capabilities
  form: record-list
  required: yes
  record_keys: id, summary, refs
  note: sorted by id; refs is 1 line of ADR ids, plan stems or repository paths separated by ", "

custom_sections:
- none: a block that is not listed above is history looking for a home

enforcement:
- `ai-factory adr live check`, code `live-format`
- `ai-factory adr live apply` and `ai-factory adr finalize` check the rendered file before they write it, and refuse on any issue
