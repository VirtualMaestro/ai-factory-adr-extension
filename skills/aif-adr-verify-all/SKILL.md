---
name: aif-adr-verify-all
description: Verify every active ADR against the implemented code in one sweep — run aif-adr-verify's checks per ADR and report a conformance table. Read-only; reports verdicts, never rewrites.
---

# aif-adr-verify-all

Answer, across the whole project, *"do our implemented decisions still match the code?"* by
running the `aif-adr-verify` conformance check over **every active ADR** in one sweep. This is
the batch companion to `aif-adr-verify` (which checks one ADR): same per-ADR judgment, one
aggregated report. It is **read-only** — it reports verdicts and never edits an ADR or the code.

It targets **active** ADRs only. An `accepted` ADR is decided but not yet implemented (a
half-implemented one still sits at `accepted` until `aif-adr-finalize` activates it), so there
is no finished code to judge — those belong to `aif-adr-next` / `aif-adr-implement`, not a
conformance sweep. To check a single `accepted`-or-`active` ADR, use `aif-adr-verify`.

## Evaluating solutions

The architectural decision is already made — do not re-litigate it. Judgments here are
about conformance and tactics:

- **Ground every verdict** in a concrete rule, ADR clause, plan step, or code location.
  No ground named — no verdict: research until you can name it, never guess.
- **Deviations surface, they don't decide.** Code or plan diverging from the Decision is
  reported as a deviation with evidence — never resolved by quietly reshaping the
  judgment to fit, and never excused because fixing it would be laborious.
- **Tactical choices** (how exactly to realize a step) follow the project's existing
  conventions and invariants; agent convenience — "faster", "easier" for this session —
  is not an argument.
- **Revise on reasons, not on pushback.** Change a verdict on a new fact, a found
  reasoning error, or an explicit operator decision — and name what changed.
  Disagreement alone is not new information.

## Workflow

1. **Enumerate the active ADRs.** Run `ai-factory adr status` — its `active` list is the target
   set. The ADR files live in the `active/` directory under the ADR root (`adr.root` in
   `.ai-factory/adr-extension.yaml`, default `docs/adr`); list `active/*.md` there to get the
   files to check. No active ADRs ⇒ nothing to verify — report that and stop.

2. **Verify each ADR, applying `aif-adr-verify` semantics inline** (do not call it as a nested
   skill). For every active ADR file:
   - `ai-factory adr verify-anchors <file>` — deterministic check that every `code:` anchor
     (and any `#symbol`) resolves on disk. Missing ⇒ drift or stale anchors; note it.
   - Open the anchored code (start from `code:`, trace outward) and compare it against the
     `## Decision` and, where testable, `## Consequences`/risks. Use `ai-factory adr status
     <file>` for the ADR's `evidence:` — `evidence: documentation-only` has nothing to verify.
   - Classify with the same verdict table:

     | Verdict | Meaning |
     |---|---|
     | **implemented** | Code present at the anchors and consistent with the Decision. |
     | **partial** | Some of the Decision is implemented; parts are missing or stubbed. |
     | **drift** | Code **contradicts** the accepted Decision. |
     | **not-implemented** | Anchors missing or no code realizes the Decision. |
     | **doc-only / N/A** | Documentation-only ADR; nothing to verify. |

3. **Aggregate one table** — a row per ADR, sorted worst-first so problems surface at the top
   (drift → not-implemented → partial → doc-only → implemented):

   | ADR | Verdict | Evidence / gap |
   |---|---|---|
   | `<adr-id>` | drift | `<one line: which anchor, what contradicts>` |

4. **Report only.** State each verdict with its evidence and gaps. **Never** rewrite an ADR or
   the code, and **never** reshape a Decision to match the code. Per-ADR handoffs mirror
   `aif-adr-verify`:
   - **drift / contradiction** → recommend `aif-adr-refine` for that ADR (return to draft and
     re-decide);
   - **missing anchors on an active ADR** → recommend refreshing its `code:` array (re-run
     `aif-adr-finalize` or edit the anchors via refine);
   - **partial** → point back to `aif-adr-implement` for that ADR.

5. **Report the status footer** — end with one summary line so the sweep's outcome is obvious
   at a glance:

   ```text
   ✔ aif-adr-verify-all · active: <n> · implemented <a> · partial <b> · drift <c> · not-implemented <d> · doc-only <e>
   ```

Do not call other skills as nested skills — apply their semantics inline in this run.

## Invocation

Claude Code: `/aif-adr-verify-all` · Codex: `$aif-adr-verify-all`. No argument — it discovers
the active ADRs itself.
