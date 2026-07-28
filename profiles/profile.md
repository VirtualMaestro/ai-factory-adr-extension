---
name: profile
description: The CNL-P profile of a profile — the blocks profiles/<name>.md declares, in order.
---

format: docs/cnlp-format.md

mood: declarative

headings:
- none: a profile is one flat run of blocks

frontmatter_fields:
- name
- description

lexicon_exempt:
- none: a profile is read by whoever writes a document of the kind it describes

sections:
- key: format
  form: scalar
  required: yes
  note: the standard this profile's documents obey, by path
- key: mood
  form: scalar
  required: yes
  note: imperative or declarative; read by whoever writes the document, not by the checker
- key: headings
  form: bullet-list
  required: yes
  note: the ## headings in order, or "- none" for a flat body
- key: frontmatter_fields
  form: bullet-list
  required: yes
  note: the fields the body may not restate
- key: lexicon_exempt
  form: bullet-list
  required: yes
  note: frontmatter fields the lexicon does not police; frontmatter is not checked, so this is for the reader
- key: sections
  form: record-list
  required: yes
  record_keys: key, form, required
  optional_record_keys: heading, record_keys, optional_record_keys, note
  note: the blocks in order; form is one of the 5 in the format, required is yes or no
- key: custom_sections
  form: bullet-list
  required: yes
  note: names a document of this kind may add, or "- none"
- key: enforcement
  form: bullet-list
  required: yes
  note: the command or test that checks this profile, and its severity

custom_sections:
- none: a profile declares values, so a block outside this list is a rule that escaped the format

enforcement:
- `npm test` (`test/profile.test.js`), over every file in `profiles/`
- any issue is an error: a profile that is wrong makes every document of its kind wrong
- this file is checked against itself; nothing checks that, and the recursion stops here
