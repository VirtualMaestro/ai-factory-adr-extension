---
name: adr-live-seed
description: Seed LIVE.md once in a project that already has ADRs — propose the capabilities the product has today, write them after the operator approves, and backfill `live:` on every active and accepted ADR.
---

mode: live_state_seeding

purpose:
- give an existing project its `LIVE.md` once: the capabilities the product has today, 1–2 sentences each, with refs
- backfill `live:` on every active and accepted ADR, so `adr live check` reports no `missing-delta` and `adr status --check` passes
- run once per project: after it, finalize keeps `LIVE.md` current

inputs:
- none: the skill reads the ADR corpus, the project documents and the code

preconditions:
- the project carries `.ai-factory.json`, which the `adr` commands gate on
- the working tree is clean: the seed edits many ADRs, and a clean tree makes `git checkout .` a complete undo

forbidden_behaviors:
- do not write a record into `LIVE.md`, or `live:` into an ADR, before the operator approves the list of capabilities: `adr live init` at step 2 writes only the sentinel
- do not change a decision: `live:` on an active ADR is a non-material edit (PRD §18.3), and every other line of the ADR stays as it is
- do not list a capability that only a proposed, draft or accepted ADR describes: the product does not have it yet, and its finalize adds it
- do not list a capability with no ground: each record cites an active ADR, a plan or a file that shows the behaviour
- do not delete or rewrite the state narrative in `AGENTS.md`: report it, and leave the cleanup to the operator
- do not create a branch and do not commit: leave the seed in the working tree for the operator
- do not run this skill as a step of `adr-migrate`: a project migrated before `LIVE.md` existed needs the seed too

outputs:
- `LIVE.md` with the approved capabilities, clean in `ai-factory adr live check`
- `live:` on every active and accepted ADR
- the completed plans still in `paths.plans`
- the sections of `AGENTS.md` that narrate project state

workflow:
1. run `git status` and stop when the tree is not clean
2. run `ai-factory adr live init`: it creates `LIVE.md` with the sentinel and lists the accepted ADRs without `live:`
3. stop when `LIVE.md` already exists and holds a record: the project is already seeded, and `adr live check` is the next step
4. run `ai-factory adr format --path` and `ai-factory adr format live --path`, and read both: the records follow the `live` profile and the lexicon of the standard
5. run `ai-factory adr decisions` and `ai-factory adr status --json`, then open every active ADR in full
6. read `.ai-factory/DESCRIPTION.md`, the state narrative in `AGENTS.md`, and the code the active ADRs name in `code:`
7. list the capabilities the product has today, 1 per behaviour a user or a caller observes, each with a kebab-case id
8. give each capability its refs: the active ADRs first, then archived plans by stem, then a repository path for a capability no document describes, with refs per capability <= 3
9. write each summary as 1–2 sentences of what the product does now, by the lexicon of `ai-factory adr format`
10. present the list to the operator in the reply, not in a file: id, summary and refs per capability, then each active ADR that no capability names, with the reason it gets `none:`
11. stop and wait for the operator's approval; apply each correction the operator gives, and present the list again
12. write the approved records under `capabilities:` in `LIVE.md`, sorted by id, in place of the sentinel line, and keep every line before `capabilities:` unchanged
13. write each `LIVE.md` summary unquoted: the file is not YAML, and the lexicon skips quoted text
14. write `live:` on each active ADR that a record names: `changes:` with 1 record per capability whose refs name it, and `applied:` with the `since:` date of `LIVE.md`
15. use `change: added` for the ADR that introduced the capability, `change: modified` for each later one, and the summary of the `LIVE.md` record
16. write `live:` as `none:` with the reason on each active ADR that no record names, such as a decision that only constrains how code is written
17. write `live:` on each accepted ADR as its finalize applies it, without `applied:`: `added` for a capability `LIVE.md` lacks, `modified` or `removed` for one it holds
18. double-quote every `summary` in frontmatter: an unquoted `: ` breaks the YAML, and every `adr` command then fails on the file
19. run `ai-factory adr live apply <file> --dry-run` on each accepted ADR and correct its delta until it passes
20. run `ai-factory adr live check` and fix each issue it lists, until it lists none
21. run `ai-factory adr status --check` and fix until it exits 0
22. list the plans in `paths.plans` with no open `- [ ]` task and no `implements:`, for the operator to archive or to give an `adr-live` fence
23. list the sections of `AGENTS.md` that narrate project state: `LIVE.md` holds that role now, and the operator decides their removal
24. report the capabilities, the ADRs this run edited, the 2 lists, then the status footer

status_footer:
  format: "✔ adr-live-seed · capabilities: <n> · active ADRs: <k> changes, <j> none · accepted ADRs: <m> · uncommitted"
  source: `ai-factory adr live` for the capability count, and the ADRs this run edited for the rest

invocation:
- Claude Code: `/adr-live-seed`
- Codex: `$adr-live-seed`
