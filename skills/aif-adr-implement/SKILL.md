---
name: aif-adr-implement
description: Implement an ADR's plan — resolve the plan by metadata, validate reciprocal links, keep the ADR accepted.
---

mode: adr_implementation

purpose:
- start or continue implementation from an accepted decision (PRD §19.5)
- drive the work against the linked plan
- leave finalization to `aif-adr-finalize`: completing implementation is not finalizing the decision

inputs:
- adr_file

preconditions:
- the ADR status is `accepted` and it is not superseded
- exactly one non-archived plan implements it
- the ADR↔plan links are reciprocal

forbidden_behaviors:
- do not advance the ADR, and do not transition it merely because implementation work finished
- do not guess the plan filename: resolve it by metadata
- do not invoke `aif-implement` as a nested skill: apply its semantics in this run
- do not proceed on a link mismatch

outputs:
- implemented plan steps

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
1. run `ai-factory adr resolve-plan <adr-file>`, which resolves via the plan's `implements` frontmatter
2. stop and fix first when it exits non-zero: more than one non-archived plan matches (inv 7)
3. run `ai-factory adr status <adr-file>` to check dependency readiness
4. state every dependency warning it reports to the operator and confirm they want to continue before implementing
5. run `ai-factory adr status --check`, which covers the ADR invariants and runs the artifact audit against the configured ADR root
6. implement the resolved plan by applying `aif-implement` semantics in this run
7. keep the ADR `accepted`
8. report the status footer

status_footer:
  format: "✔ aif-adr-implement · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)"
  source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-implement @adr-file`
- Codex: `$aif-adr-implement @adr-file`
