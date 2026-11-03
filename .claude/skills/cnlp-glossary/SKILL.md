---
name: cnlp-glossary
description: Build and keep the project glossary, GLOSSARY.md — challenge a term the operator uses two ways, pin a vague word to one term, test it against edge cases and the code, and record it the moment it is agreed. Use when discussing project terminology, naming a new concept, or editing GLOSSARY.md.
---

mode: cnlp_glossary

purpose:
- keep 1 glossary per project, `GLOSSARY.md` beside `cnlp.config.json`, so the operator, the agent and every document name a thing by 1 word
- record a term in the turn the operator agrees to it, not in a batch at the end of the session
- turn each word a term replaces into an `avoid:` value, which `npx cnlp check` then rejects in every document the corpus names

inputs:
- none: the skill reads the conversation, `GLOSSARY.md` when it exists, and the code the operator names

preconditions:
- `cnlp.config.json` sits at the project root: the check reads `GLOSSARY.md` beside it, and finds no glossary anywhere else

scope:
- act on `GLOSSARY.md` only; rewrite another document that uses an avoided word only when the operator agrees to it
- hold the glossary to the terms of this project: the §5 lexicon of the standard already governs the common words

forbidden_behaviors:
- do not record a term the operator has not agreed to: the check enforces every `avoid:` value, so a guess there becomes a rule
- do not write an implementation detail into `means:`: the glossary says what a thing is, and the code says how it works
- do not add a general programming term: a timeout or an error type means what it means in every project
- do not create `GLOSSARY.md` before the operator agrees to the first term: a glossary holding no term carries nothing to enforce
- do not resolve a contradiction between what the operator says and what the code does: report it, because the operator decides which 1 is right
- do not list a word under `avoid:` that names a different thing: it rejects a correct line in every document

outputs:
- `GLOSSARY.md` at the project root, holding 1 record per agreed term
- per session: the terms added or changed, and the document lines the check names for an avoided word

workflow:
1. read `GLOSSARY.md` when it exists, and read its shape with `npx cnlp print glossary`
2. compare each word the operator uses against `terms:`, and ask which thing is meant when it conflicts with a `means:` or appears in an `avoid:`
3. ask which thing a vague or overloaded word names, and present 1 term for it with the words it replaces
4. present a concrete case at the boundary between 2 terms, and ask which term owns it
5. compare what the operator states against the code, and report each place the code does otherwise
6. write the agreed term into `terms:` in the same turn: `term`, `means` in 1 or 2 sentences, and `avoid` with the words it replaces
7. write `GLOSSARY.md` with a `purpose:` block and the first record when the file does not exist yet
8. run `npx cnlp check` and fix what it reports in `GLOSSARY.md`
9. report every line of another document the check names for an avoided word, and rewrite those lines when the operator agrees
10. name a decision record to the operator only when the choice is hard to reverse, surprising without context, and the result of a real trade-off

invocation:
- Claude Code: `/cnlp-glossary`, once this folder sits in `.claude/skills/`
- Codex: `$cnlp-glossary`, once this folder sits in its skills directory
- any other agent: read `skills/cnlp-glossary/SKILL.md` and follow it; the body is the instruction
