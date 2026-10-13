---
name: cnlp-migrate
description: Convert a repository's technical documents to the CNL-P format — group them by kind, author or copy the profile each kind is held to, then rewrite each body into its blocks without changing what any document says.
---

mode: cnlp_migration

purpose:
- rewrite existing documents into CNL-P, so a reader stops inferring which sentence is intent, which is policy, and which is a step
- author or copy the profile of every kind of document in the corpus, and rewrite no body until it exists
- carry every rule across unchanged: a format migration is not a redesign

inputs:
- documents_directory
- optional_single_document

preconditions:
- `cnlp-kit` is a dependency of this repository and `npx cnlp print format --path` resolves
- `cnlp.config.json` names the corpus; `npx cnlp init` writes the entries the repository's own layout already supports
- the working tree is clean, so the rewrite is reviewable as its own diff

scope:
- act on the document bodies 1 corpus entry maps to, and on the local copy of the profile that entry names
- leave frontmatter alone wherever a runtime parses it: a skill's `name` and `description` drive discovery and routing

forbidden_behaviors:
- do not invent a rule the source never stated
- do not drop a rule silently: state every deliberate drop with its reason
- do not add a block the profile does not declare: edit the profile first, or put the content in a declared block
- do not change what a document says while changing how it reads
- do not hold 2 kinds of document to 1 profile: a block 1 kind needs and another cannot use is 2 profiles wearing 1 name
- do not resolve a contradiction found in the source prose: report it, because it is a decision the operator owns

outputs:
- 1 profile per kind of document in the corpus, in the directory `cnlp.config.json` names, its `custom_sections` filled from the inventory
- `cnlp.config.json` carrying 1 corpus entry per kind
- the rewritten bodies, 1 commit per document or 1 per batch, as the operator prefers
- per document: the rules carried in, the rules dropped with their reasons, the size delta and its cause

workflow:
1. run `npx cnlp print format` and read it in full: the rules live there, and a profile declares values against them rather than rules of its own
2. list every document to convert, and group them by kind: 1 kind is 1 profile and 1 corpus entry
3. read the packaged profile nearest each kind through `npx cnlp print <name>`, and compare what it declares against the documents in hand
4. write a profile for any kind no packaged profile fits, against `profiles/profile.md`: a new kind of document is 1 new profile and no change to the checker
5. copy every packaged profile the corpus uses into the directory `profiles:` names, so the vocabulary filled below survives an upgrade of the package
6. list every top-level `key:` those documents already use, and every recurring idea that is prose today
7. map each name onto a declared block, or onto a custom section name, applying the placement rule in the standard
8. fill `custom_sections:` in each copied profile with the names that survive, and delete its `- none` line
9. stop and ask when a name has no home: a new block changes the profile, which is the operator's decision
10. update `cnlp.config.json` with 1 corpus entry per kind, and run `npx cnlp check` to verify every entry matches a file
11. pick a single document and carry it through steps 12 to 17 before touching the rest
12. list the source's rules, including the ones buried in a subordinate clause
13. rewrite the body into the profile's blocks, 1 idea per line, in the declared order
14. tick each listed rule against the result, and state every deliberate drop with its reason
15. name any rule in the result that has no origin in the source: that is an addition, not a migration
16. measure the size and state the cause of any growth, per the migration procedure in the standard
17. run `npx cnlp check` and fix what it reports
18. repeat steps 12 to 17 for each remaining document, kind by kind
19. report per document: rules in, rules dropped, size delta, and the judgment calls left open

invocation:
- Claude Code: `/cnlp-migrate <documents-directory>`, once this folder sits in `.claude/skills/`
- Codex: `$cnlp-migrate <documents-directory>`, once this folder sits in its skills directory
- any other agent: read `skills/cnlp-migrate/SKILL.md` and follow it; the body is the instruction
