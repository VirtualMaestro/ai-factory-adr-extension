---
name: cnlp-docset
description: Write the documentation of a library as a CNL-P document set — the index carrying one whole working program, the concept, API and task pages, and the closed catalog of everything the library offers.
---

mode: cnlp_docset_authoring

purpose:
- write the documentation of 1 library as a CNL-P document set, so an agent loads 1 page at a time instead of loading everything to answer anything
- aim at accuracy: fewer wrong calls written against the library, and cost is what falls out of that rather than what drives it
- keep the catalog complete, so a reader tells a capability the library lacks from one the set left out
- work from whatever the operator found, in any mix, and state on every page what that page rests on

inputs:
- sources: every repository, specification, document and example the operator supplies for 1 library, in any mix
- source_weight: what a source proves, from 1 the strongest to 5 the weakest, which decides where a contract comes from
- weight 1: the declarations read from the library source
- weight 2: a specification the library publishes for a machine to read
- weight 3: the prose documentation the library publishes for a person to read
- weight 4: the examples and the tests the library ships
- weight 5: a file derived from a source nobody here read, such as a vendor dump of the documentation
- output_directory: where the set is written; its name is the name of the set, and it holds the set and nothing else

preconditions:
- `npx cnlp print format --path` resolves, whether the operator installed the kit globally or as a dependency of some project
- `npx cnlp check <output_directory>` reaches the set by path: a produced set carries no config file, and it needs no project around it
- every source sits at a fixed revision or a fixed version, so every page states what 1 release says

scope:
- act on the output directory the operator named, and write the index, the concept pages, the API pages and the task pages under it
- write nothing else into that directory: a set is documentation handed to whoever asked for it, and a config, a dependency or a skill copy there belongs to a project rather than to a set
- leave every other set alone: a package that corrects another package states the correction in its own index, and edits no page of the set it corrects
- stop at authoring: a repository that will hold this set among its own documents runs `npx cnlp init` and names it in `docsets:`, which is adoption and not this skill's work

forbidden_behaviors:
- do not invent a signature, a parameter or a default: read each one from the source that states it
- do not state a contract at a weight its source does not carry: a claim read in prose stays a claim read in prose, and writing it as a declaration tells the reader it came from one
- do not drop a capability from the catalog: a capability with no record gets invented again, or found in the source and called anyway
- do not mark a record `covered` before its page exists: the value is held to its vocabulary and not to the truth, so `covered` with no page sends the reader nowhere
- do not mark a capability `avoid` on judgment alone: that is a claim about the library, and a wrong one steers a reader away from the call the task needed
- do not write a second example on an API page: a compositional example is a task page
- do not write 1 page per member: a group of overloads is 1 page, because a reader picks between them once
- do not name the library inside a packaged profile: a vocabulary of your own goes in `custom_sections:` of a local copy of that profile

outputs:
- 1 document set: the index, the concept pages, the API pages and the task pages
- the catalog as the closed list of the library's capabilities, every record at `covered`, `source` or `avoid`
- a report: the capabilities carrying a page, the ones left at `source`, the weight the set rests on, and the regions `excluded:` names with their reasons

workflow:
1. run `npx cnlp print format` and read it in full, §9 included: it states what a page reference is, and which of its rules a review holds rather than the checker
2. read the `docset`, `concept`, `api` and `task` profiles through `npx cnlp print <name>`: their `note:` keys carry the reason behind each block, and the rules and the values are read together
3. list every source the operator supplied and name the weight each one carries: the strongest weight in that list bounds what every page below claims, so report it before writing anything
4. run the clone or the install command each source needs, at a fixed revision, and record the library in `identity:`, and in `version:` the version alone, then a comma and the revision
5. fill `derived_from:` in `identity:` with those sources and their weights, so a reader tells a set written from declarations from a set written from prose
6. list every capability of the library, taking each one from the strongest source that states it: a source at weight 3 or below covers what its author chose to cover, so a capability it omits is a capability still to find
7. fill `catalog:` with 1 record per capability, every one at `status: source`, `read:` naming where to read it — the file, or the document and the anchor inside it
8. pick the type names of the set's running example once, before any page: every example on every page uses them, so a reader assembling several pages gets 1 program instead of fragments
9. write `canonical_use:` as 1 complete working use of the library, carrying every load-bearing element, because a reader holding only the index writes the common case from it
10. map each part of `canonical_use:` onto the page owning its detail, in `walkthrough:`
11. write the concept pages next: an API page points back to an invariant instead of restating it, so the model exists before the pages resting on it
12. write 1 API page per capability, and state the pick between its symbols in `choose:`
13. write 1 task page per goal a reader arrives with, and put the multi-call composition there
14. update each catalog record to `covered` as its page lands, and fill `excluded:` with every whole region the set leaves out, each with its reason
15. fill `companions:` when another package extends this library, and `overrides:` when this package corrects a page of the set it extends
16. name every set `companions:` or `overrides:` names that does not sit beside `<output_directory>`, and the directory holding it: the check resolves a crossing only against a set it can read
17. run `npx cnlp check <output_directory>`, with `--companion <set>=<dir>` for each set step 16 named, and fix what it reports: it resolves every reference in the set, and reports a page no other page reaches
18. read the finished set for the rules no check reaches: 1 fact stated on 1 page, 1 running example across the set, 1 page per routed name, and the keys a status implies
19. read each task page against the API pages it sends a reader to: a member the task steers away from carries that in its own `pitfalls:`, because a full API page otherwise outvotes a task page's preference
20. report the capabilities covered, the ones left at `source`, the weight the set rests on, and any defect the reading turned up in the library itself

invocation:
- Claude Code: `/cnlp-docset <sources> <output-directory>`, once this folder sits in `.claude/skills/`
- Codex: `$cnlp-docset <sources> <output-directory>`, once this folder sits in its skills directory
- any other agent: read `skills/cnlp-docset/SKILL.md` and follow it; the body is the instruction
