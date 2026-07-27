---
name: aif-adr-finalize
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
- the ADR status is `accepted` and it is not superseded
- a linked plan exists, or the ADR explicitly states that no implementation is required

scope:
- verify the implementation against the Decision
- record evidence and code anchors
- activate the ADR and archive its plan on success

forbidden_behaviors:
- do not rewrite the Decision to match the code
- do not finalize when the implementation contradicts the accepted Decision: recommend returning the ADR to draft via `aif-adr-refine`
- do not finalize on a verification failure: stop, leave the ADR `accepted`, and report what failed
- do not invoke `aif-verify` as a nested skill: apply its strict semantics in this run
- do not put detailed implementation notes in `evidence:`; prose belongs in the ADR body and a tracker link in the frontmatter `issue:` field
- do not list every touched file in `code:`; it holds the primary entry-point anchors an agent starts tracing from

outputs:
- verification result
- `evidence:` and `code:` recorded in the ADR frontmatter
- activated ADR and archived plan
- status footer

quality_rules:
- the architectural decision is already made: do not re-litigate it
- ground every verdict in a concrete rule, ADR clause, plan step, or code location
- no ground named, no verdict: research until you can name it, never guess
- report code or a plan diverging from the Decision as a deviation, with evidence
- never resolve a deviation by reshaping the judgment to fit it
- never excuse a deviation because fixing it would be laborious
- follow the project's existing conventions and invariants for tactical choices
- never accept agent convenience — "faster", "easier" for this session — as an argument
- revise a verdict only on a new fact, a found reasoning error, or an explicit operator decision, and name what changed
- disagreement alone is not new information

workflow:
1. run `ai-factory adr resolve-plan <adr-file>`: verification must target one plan unambiguously
2. apply strict `aif-verify` semantics in this run and require a non-blocking pass
3. check that the implementation matches the ADR `## Decision` and, where testable, its known Consequences and risks
4. stop and leave the ADR `accepted` on a verification failure, reporting what failed
5. record `evidence:` in the ADR frontmatter as a short string, for example `evidence: implemented, commit abc1234, verified by tests+lint`
6. fill the frontmatter `code:` array with the primary entry-point anchors: paths relative to the repo root, POSIX `/` separators, optional `#symbol` suffix such as `src/status.js#validateDirStatus`
7. verify each anchor exists before writing it, so the ADR transitions with its anchors in place
8. run `ai-factory adr finalize <adr-file>`
9. run `ai-factory adr status --check` and resolve any failures
10. report the status footer

command_behaviour:
- `ai-factory adr finalize` sets `evidence: implemented` only when the frontmatter `evidence:` field is still empty, so an authored value with commit refs or verification notes is preserved
- it then atomically moves the ADR to `active/`
- it archives the plan following `aif-archive` semantics: to `paths.archive/plans/`, `status: done`, `archived: YYYY-MM-DD`, filename preserved

documentation_only_adrs:
- an ADR with `evidence: documentation-only` or `documentation-only decision` in its frontmatter skips verification and the plan steps entirely
- set that field, then run `ai-factory adr finalize <adr-file>` directly: with no plan and a documentation-only `evidence:` it activates the ADR without a plan
- `plan:` stays empty

status_footer:
format: "✔ aif-adr-finalize · ADR: <adr-id> [active] · Plan: <plan-id> (archived)"
source: `ai-factory adr status <adr-file>`; use `Plan: none` for a documentation-only ADR

invocation:
- Claude Code: `/aif-adr-finalize @adr-file`
- Codex: `$aif-adr-finalize @adr-file`
