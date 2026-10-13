---
name: adr-finalize
description: Finalize an ADR — run strict verification, then activate the ADR and archive its plan on success.
---

mode: adr_finalization

purpose:
- verify the implementation and activate the decision (PRD §19.6), moving an `accepted` ADR to `active`
- own the judgment — strict verification and the contradiction check — that must pass first
- leave the deterministic file mechanics to `ai-factory adr finalize`: evidence, atomic move, plan archival

inputs:
- adr_file

preconditions:
- the ADR status is `accepted` and no other ADR supersedes it
- a linked plan exists, or the ADR explicitly states that no implementation is required

scope:
- verify the implementation against the Decision
- record evidence and code anchors
- activate the ADR and archive its plan on success

forbidden_behaviors:
- do not rewrite the Decision to match the code
- do not finalize when the implementation contradicts the accepted Decision: recommend returning the ADR to draft via `adr-improve`
- do not invoke `aif-verify` as a nested skill: apply its strict semantics in this run
- do not put detailed implementation notes in `evidence:`: it is a short string, and the detail belongs in the plan or in the tracker named by the frontmatter `issue:` field
- do not add implementation prose to the ADR body: the ADR profile declares every block an ADR has, and none of them holds a build log
- do not list every touched file in `code:`; it holds the primary entry-point anchors an agent starts tracing from

outputs:
- verification result
- `evidence:` and `code:` recorded in the ADR frontmatter
- activated ADR and archived plan
- `LIVE.md` with the ADR's `live:` delta applied

quality_rules:
- the architectural decision is already made: do not re-litigate it
- ground every verdict in a concrete rule, ADR clause, plan step, or code location
- no ground named, no verdict: research until you can name it, never guess
- report code or a plan diverging from the Decision as a deviation, with evidence
- do not resolve a deviation by reshaping the judgment to fit it
- do not excuse a deviation because fixing it would be laborious
- follow the project's existing conventions and invariants for tactical choices
- do not accept agent convenience — "faster", "easier" for this session — as an argument
- revise a verdict only on a new fact, a found reasoning error, or an explicit operator decision, and name what changed
- disagreement alone is not new information

workflow:
1. run `ai-factory adr resolve-plan <adr-file>`: verification must target one plan unambiguously
2. apply strict `aif-verify` semantics in this run and require a non-blocking pass
3. check that the implementation matches the ADR `## Decision` and, where testable, its known Consequences and risks
4. stop and leave the ADR `accepted` on a verification failure, reporting what failed
5. record `evidence:` in the ADR frontmatter as a short string, for example `evidence: implemented, commit abc1234, verified by tests+lint`
6. fill the frontmatter `code:` array with the primary entry-point anchors
7. write each anchor as a repo-root path with POSIX `/` separators and an optional `#symbol` suffix, such as `src/status.js#validateDirStatus`
8. verify each anchor exists before writing it, so the ADR transitions with its anchors in place
9. run `ai-factory adr validate <adr-file>` and fix what it reports: `finalize` moves the ADR to `active`, where a body issue becomes an error, so this checks the file while fixing it is still cheap
10. run `ai-factory adr live apply <adr-file> --dry-run`: output that opens with `skipped:` means there is nothing to apply
11. correct frontmatter `live:` when the implementation diverged from it, or when the dry run prints a warning: a capability the successor of a superseded ADR dropped needs `change: removed`
12. run `ai-factory adr finalize <adr-file>`
13. run `ai-factory adr status --check` and resolve any failures
14. run `ai-factory adr live check` and report the issues it lists
15. report the status footer

command_behaviour:
- `ai-factory adr finalize` sets `evidence: implemented` only when the frontmatter `evidence:` field is still empty, so it keeps an authored value with commit refs or verification notes
- it then atomically moves the ADR to `active/`
- it archives the plan following `aif-archive` semantics: to `paths.archive/plans/`, `status: done`, `archived: YYYY-MM-DD`, filename preserved
- it stages both the ADR move and the plan archival in Git, so each one lands as a rename
- it applies the `live:` delta to `LIVE.md` in the same rollback, writes `live.applied` into the ADR, and stages `LIVE.md`
- it refuses an ADR without a `live:` that holds `changes:` or `none:`, and changes nothing
- it refuses a project without `LIVE.md`, and changes nothing

documentation_only_adrs:
- an ADR with `evidence: documentation-only` or `documentation-only decision` in its frontmatter skips verification and the plan steps entirely
- set that field, run steps 10 and 11, then run `ai-factory adr finalize <adr-file>` and steps 13 to 15: with no plan and a documentation-only `evidence:` it activates the ADR without a plan
- `plan:` stays empty

status_footer:
  format: "✔ adr-finalize · ADR: <adr-id> [active] · Plan: <plan-id> (archived)"
  source: `ai-factory adr status <adr-file>`; use `Plan: none` for a documentation-only ADR

invocation:
- Claude Code: `/adr-finalize @adr-file`
- Codex: `$adr-finalize @adr-file`
