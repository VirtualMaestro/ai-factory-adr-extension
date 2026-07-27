---
name: aif-adr-verify-all
description: Verify every active ADR against the implemented code in one sweep — run aif-adr-verify's checks per ADR and report a conformance table. Read-only; reports verdicts, never rewrites.
---

mode: adr_conformance_sweep

purpose:
- answer, across the whole project, whether the implemented decisions still match the code
- run the `aif-adr-verify` conformance check over every active ADR in one sweep
- be the batch companion to `aif-adr-verify`: same per-ADR judgment, one aggregated report

inputs:
- none; the skill discovers the active ADRs itself

scope:
- active ADRs only
- read-only inspection and one aggregated conformance table

targeting_rationale:
- an `accepted` ADR is decided but not yet implemented, and a half-implemented one stays `accepted` until `aif-adr-finalize` activates it, so there is no finished code to judge
- those belong to `aif-adr-next` and `aif-adr-implement`, not to a conformance sweep
- to check a single `accepted` or `active` ADR, use `aif-adr-verify`

forbidden_behaviors:
- do not edit any ADR
- do not edit the code
- do not reshape a Decision to match the code
- do not call other skills as nested calls: apply their semantics inline in this run

outputs:
- one conformance table, a row per ADR
- per-ADR follow-up recommendations
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
- never resolve a deviation by reshaping the judgment to fit it
- never excuse a deviation because fixing it would be laborious
- follow the project's existing conventions and invariants for tactical choices
- never accept agent convenience — "faster", "easier" for this session — as an argument
- revise a verdict only on a new fact, a found reasoning error, or an explicit operator decision, and name what changed
- disagreement alone is not new information

workflow:
1. run `ai-factory adr status`: its `active` list is the target set
2. list `active/*.md` under the ADR root (`adr.root` in `.ai-factory/adr-extension.yaml`, default `docs/adr`) to get the files to check
3. report that there is nothing to verify and stop when no ADR is active
4. per active ADR, run `ai-factory adr verify-anchors <file>`: a deterministic check that every `code:` anchor and any `#symbol` resolves on disk
5. note missing anchors as drift or a stale anchor
6. run `ai-factory adr status <file>` for the ADR's `evidence:`, and skip verification when it is `documentation-only`
7. open the anchored code, starting from `code:` and tracing outward, and compare it against `## Decision` and, where testable, `## Consequences` and its risks
8. assign one verdict per ADR
9. aggregate one table, sorted worst-first: drift, then not-implemented, partial, doc-only, implemented
10. state each verdict with its evidence and gaps
11. report the status footer

report_format:
```text
| ADR | Verdict | Evidence / gap |
|---|---|---|
| `<adr-id>` | drift | `<one line: which anchor, what contradicts>` |
```

follow_up:
- drift or contradiction: recommend `aif-adr-refine` for that ADR, to return it to draft and re-decide
- missing anchors on an active ADR: recommend refreshing its `code:` array by re-running `aif-adr-finalize` or editing the anchors via refine
- partial: point back to `aif-adr-implement` for that ADR

status_footer:
format: "✔ aif-adr-verify-all · active: <n> · implemented <a> · partial <b> · drift <c> · not-implemented <d> · doc-only <e>"
source: the verdicts you assigned

invocation:
- Claude Code: `/aif-adr-verify-all`
- Codex: `$aif-adr-verify-all`
