---
name: cnlp-migrate
description: Convert this repository's skill bodies to the CNL-P format — author the skill profile from the existing vocabulary, then rewrite each SKILL.md into its blocks without changing what any skill does.
---

mode: cnlp_migration

purpose:
- rewrite skill bodies into CNL-P, so a reader stops inferring which sentence is intent, which is policy, and which is a step
- author `cnlp/profiles/skill.md` from this repository's own vocabulary before any body is touched
- carry every rule across unchanged: a format migration is not a redesign

inputs:
- skills_directory
- optional_single_skill

preconditions:
- the `cnlp/` folder is at the repository root, holding `cnlp-format.md` and `profiles/skill.md`
- the working tree is clean, so the rewrite is reviewable as its own diff

scope:
- act on skill bodies, on `cnlp/profiles/skill.md`, and on `cnlp/quality-rules.md`
- leave every skill's frontmatter untouched: the runtime parses `name` and `description` for discovery and routing
- leave behaviour alone: what a skill does is out of scope, only how it reads changes

forbidden_behaviors:
- do not invent a rule the source never stated
- do not drop a rule silently: every deliberate drop is stated with its reason
- do not add a block that `cnlp/profiles/skill.md` does not declare: the profile is edited first, or the content goes in a declared block
- do not change what a skill does while changing how it reads
- do not migrate the corpus before a single skill is carried through end to end
- do not resolve a contradiction found in the source prose: report it, because it is a decision the operator owns

outputs:
- an authored `cnlp/profiles/skill.md`, its `custom_sections` filled from the inventory
- the migrated skill bodies, one commit per skill or one per batch, as the operator prefers
- per skill: the rules carried in, the rules dropped with their reasons, the size delta and its cause

workflow:
1. read `cnlp/cnlp-format.md` in full, then `cnlp/profiles/skill.md`: the rules and the values are read together, neither is complete alone
2. list every skill file under the skills directory
3. list every top-level `key:` those files already use, and every recurring idea that is prose today
4. map each name onto a declared block, or onto a custom section name, applying the placement rule in the standard
5. fill `custom_sections:` in `cnlp/profiles/skill.md` with the names that survive, and delete its `- none` line
6. stop and ask when a name has no home: a new block changes the profile, which is the operator's decision
7. pick a single skill and carry it through steps 8..13 before touching the rest
8. list the source's rules, including the ones buried in a subordinate clause
9. rewrite the body into the profile's blocks, one idea per line, in the declared order
10. tick each listed rule against the result, and state every deliberate drop with its reason
11. name any rule in the result that has no origin in the source: that is an addition, not a migration
12. measure the size and state the cause of any growth, per the migration procedure in the standard
13. run the check named in the profile's `enforcement:` and fix what it reports
14. repeat steps 8..13 for each remaining skill
15. report per skill: rules in, rules dropped, size delta, and the judgment calls left open

invocation:
- Claude Code: `/cnlp-migrate <skills-directory>`, once this folder is moved into `.claude/skills/`
- Codex: `$cnlp-migrate <skills-directory>`, once this folder is moved into its skills directory
- any other agent: read `cnlp-migrate/SKILL.md` and follow it; the body is the instruction
