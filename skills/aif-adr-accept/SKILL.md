---
name: aif-adr-accept
description: Accept a draft ADR — check preconditions, run the artifact audit, and atomically move draft to accepted.
---

mode: adr_acceptance

purpose:
- declare the decision complete enough to guide implementation (PRD §19.3)
- move a `draft` ADR to `accepted`

inputs:
- adr_file

preconditions:
- the file is in the configured ADR root's `drafts/` directory and its status is `draft`
- exactly one primary decision is stated
- Context describes the problem
- relevant constraints are present
- the Decision is concrete
- meaningful alternatives are recorded
- Consequences include disadvantages or risks
- no blocking questions remain
- conflicts with active ADRs are resolved or explicitly addressed
- artifact metadata is valid

forbidden_behaviors:
- do not accept when any precondition fails: stop and recommend `aif-adr-refine`
- do not move the file by hand: `ai-factory adr transition` owns the atomic move
- do not continue past audit failures
- do not attempt optional memory synchronization: it is post-MVP and not provided by this skill

outputs:
- accepted ADR in `accepted/`
- any warnings raised along the way
- status footer

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
1. run `ai-factory adr validate <file>`
2. run `ai-factory adr status --check`, which resolves `adr.root` and passes it to the artifact audit
3. resolve any audit failures before continuing
4. run `ai-factory adr transition <file> accepted`: a single atomic move of the status edit plus `drafts/` to `accepted/`
5. report any warnings
6. report the status footer

status_footer:
format: "✔ aif-adr-accept · ADR: <adr-id> [accepted] · Plan: <plan-id or none>"
source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-accept @adr-file`
- Codex: `$aif-adr-accept @adr-file`
