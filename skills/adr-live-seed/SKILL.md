---
name: adr-live-seed
description: Seed LIVE.md once in a project that has ADRs, such as one updated from 4.x — propose the capabilities the product has today, write them after the operator approves, backfill `live:` on the ADRs, and commit.
---

mode: live_state_seeding

purpose:
- give an existing project its `LIVE.md` once: the capabilities the product has today, 1–2 sentences each, with refs
- backfill `live:` on every active and accepted ADR, so `adr live check` reports no `missing-delta` on an ADR and `adr status --check` passes
- run once per project: after it, finalize keeps `LIVE.md` current

inputs:
- none: the skill reads the ADR corpus, the project documents and the code

preconditions:
- the project carries `.ai-factory.json`, which the `adr` commands gate on
- the working tree is clean, apart from the changes of an `adr-migrate` run that applies this workflow: the seed edits many ADRs, and a clean tree keeps its commit to its own files

forbidden_behaviors:
- do not write a record into `LIVE.md`, or `live:` into an ADR, before the operator approves the list of capabilities: `adr live init` at step 3 writes only the sentinel
- do not change a decision: `live:` on an active ADR is a non-material edit (PRD §18.3), and every other line of the ADR stays as it is
- do not list a capability that only a proposed, draft or accepted ADR describes: the product does not have it yet, and its finalize adds it
- do not list a capability with no ground: each record cites an active ADR, a plan or a file that shows the behaviour
- do not delete or rewrite the state narrative in `AGENTS.md`: report it, and leave the cleanup to the operator
- do not create or switch branches: the operator picks the branch before the run
- do not stage files by pattern, such as `git add -A`: stage by name the paths this run changed
- do not push with `--force`

outputs:
- `LIVE.md` with the approved capabilities, clean in `ai-factory adr live check` apart from the plans step 22 lists
- `live:` on every active and accepted ADR
- the completed plans still in `paths.plans`
- the sections of `AGENTS.md` that narrate project state
- 1 commit that holds `LIVE.md` and every ADR this run edited

workflow:
1. run `git status` and stop when the tree is not clean
2. run `ai-factory adr live` and `ai-factory adr status --check`; stop when `LIVE.md` holds a record and no active ADR has a `live:` issue: the seed has nothing left to write
3. run `ai-factory adr live init` when step 2 reports `LIVE.md not found`: it creates the file at the configured path with the sentinel, and lists the accepted ADRs without `live:`; skip it when step 2 prints only the sentinel
4. run `ai-factory adr format --path` and `ai-factory adr format live --path`, and read both: the records follow the `live` profile and the lexicon of the standard
5. run `ai-factory adr decisions` and `ai-factory adr status --json`, then open every active ADR in full
6. read `.ai-factory/DESCRIPTION.md`, the state narrative in `AGENTS.md`, and the code the active ADRs name in `code:`
7. list the capabilities the product has today, 1 per behaviour a user or a caller observes, each with a kebab-case id; keep each record `LIVE.md` already holds
8. give each capability its refs: every active ADR that shapes it, then archived plans by stem, then a repository path for a capability no document describes; plan and path refs per capability <= 3
9. write each summary as 1–2 sentences of what the product does now, by the lexicon of `ai-factory adr format`
10. present the list to the operator in the reply, not in a file: id, summary and refs per capability, then each active ADR that no capability names, with the reason it gets `none:`
11. stop and wait for the operator's approval; apply each correction the operator gives, and present the list again
12. write the approved records under `capabilities:` in `LIVE.md`, sorted by id, in place of the sentinel line, and keep every line before `capabilities:` and every record already there
13. write each `LIVE.md` summary unquoted: the file is not YAML, and the lexicon skips quoted text
14. write `live:` on each active ADR without one that a record names: `changes:` with 1 record per capability whose refs name it, and `applied:` with the `since:` date of `LIVE.md`
15. use `change: added` for the ADR that introduced the capability, `change: modified` for each later one, and the summary of the `LIVE.md` record
16. write `live:` as `none:` with the reason on each active ADR without one that no record names, such as a decision that only constrains how code is written
17. write `live:` on each accepted ADR without one as its finalize applies it, without `applied:`: `added` for a capability `LIVE.md` lacks, `modified` or `removed` for one it holds
18. double-quote every `summary` in frontmatter: an unquoted `: ` breaks the YAML, and every `adr` command then fails on the file
19. run `ai-factory adr live apply <file> --dry-run` on each accepted ADR and correct its delta until it passes
20. run `ai-factory adr live check` and fix each issue it lists, until it lists none, except `missing-delta` on a plan: step 22 hands that plan to the operator
21. run `ai-factory adr status --check` and fix until it exits 0
22. list the plans in `paths.plans` with no open `- [ ]` task and no `implements:`, for the operator to archive or to give an `adr-live` fence
23. list the sections of `AGENTS.md` that narrate project state: `LIVE.md` holds that role now, and the operator decides their removal
24. stage by name `LIVE.md` and every ADR this run edited, with every file of an `adr-migrate` run that applies this workflow; inspect `git diff --cached --name-only`, and stop on an unrelated staged file
25. commit them in 1 commit by `aif-commit` semantics without its push step
26. push the current branch with `git push`, or `git push -u origin <branch>` without an upstream
27. skip step 26 when `git.skip_push_after_commit` is true in `.ai-factory/config.yaml`, and skip steps 24 to 26 when `git.enabled` is false
28. report the capabilities, the ADRs this run edited, the 2 lists, the commit and the push, then the status footer

status_footer:
  format: "✔ adr-live-seed · capabilities: <n> · active ADRs: <k> changes, <j> none · accepted ADRs: <m> · commit: <sha or skipped> · pushed: <branch or no>"
  source: `ai-factory adr live` for the capability count, the ADRs this run edited for the counts, and git for the commit

invocation:
- Claude Code: `/adr-live-seed`
- Codex: `$adr-live-seed`
