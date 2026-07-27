---
name: aif-adr-verify
description: Verify one ADR against the implemented code — confirm its code anchors resolve and judge whether the code honors the Decision. Read-only; reports a verdict, never rewrites.
---

mode: adr_verification

purpose:
- answer, on demand, whether a single accepted or active ADR was implemented and whether the code still matches its Decision
- re-runnable, unlike `aif-adr-finalize`, which verifies once at activation against the linked plan
- check the `code:` anchors against the current tree

inputs:
- adr_file

scope:
- read-only inspection of the ADR, its anchors, and the anchored code
- assign one verdict and report the evidence behind it

forbidden_behaviors:
- do not edit the ADR
- do not edit the code
- do not reshape the Decision to match the code
- do not call other skills as nested calls: apply their semantics inline in this run

outputs:
- verdict with its evidence and gaps
- follow-up recommendation
- status footer

verdicts:
- implemented: code present at the anchors and consistent with the Decision
- partial: some of the Decision is implemented; parts are missing or stubbed
- drift: code contradicts the accepted Decision
- not-implemented: anchors missing, or no code realizes the Decision
- doc-only: documentation-only ADR, nothing to verify

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
1. run `ai-factory adr verify-anchors <file>`: a deterministic check that every `code:` anchor and any `#symbol` exists on disk
2. note missing anchors: the ADR points at moved or deleted code, which is drift or a stale anchor
3. run `ai-factory adr resolve-plan <file>` for the linked and archived plan
4. run `ai-factory adr status <file>` for status and frontmatter `evidence:`
5. report doc-only and stop when `evidence: documentation-only`
6. open the anchored code, starting from `code:` and tracing outward as needed
7. compare it against `## Decision` and, where testable, `## Consequences` and its risks
8. assign one verdict
9. state the verdict, which anchors and which code are the evidence, and the gaps
10. report the status footer

follow_up:
- drift or contradiction: recommend `aif-adr-refine` to return the ADR to draft and re-decide, mirroring `aif-adr-finalize`
- missing anchors on an active ADR: recommend refreshing the `code:` array by re-running `aif-adr-finalize` or editing the anchors via refine
- partial or not-implemented on an accepted ADR: the implementation work is unfinished, point back to `aif-adr-implement`

status_footer:
format: "✔ aif-adr-verify · ADR: <adr-id> [<status>] · Plan: <plan-id or none> · verdict: <verdict>"
source: `ai-factory adr status <adr-file>` plus the verdict you assigned

invocation:
- Claude Code: `/aif-adr-verify @adr-file`
- Codex: `$aif-adr-verify @adr-file`
