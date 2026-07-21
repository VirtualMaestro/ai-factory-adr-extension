---
name: aif-adr-refine
description: Refine an ADR — on first refine move it from proposed to draft and apply ADR-specific quality criteria.
---

# aif-adr-refine

Discuss and improve a proposal or draft (PRD §19.2). This skill uses **ADR-specific**
refinement criteria — it must **not** delegate to `aif-improve`. Validating a decision
record is a different task from validating an implementation plan.

## Scope — refinement only

This skill **only improves the ADR document**. It must **never** implement the decision,
write or modify production code, create an implementation plan, or propose doing any of
that as a next step. Do not end with offers like "shall I implement this now?".

When refinement is done, stop. Report what changed in the ADR and any transition applied —
nothing more. If the user wants implementation, they invoke the implementation skills
(`aif-adr-next`, plan skills) themselves.

## Workflow

1. **Validate first.** Run `ai-factory adr validate <file>` and address reported errors.
2. **Research.** Inspect project rules, architecture, relevant code, and existing ADRs.
3. **Sharpen the decision.** Ensure the document states exactly **one primary decision**.
   Improve Context, Decision, Alternatives, and Consequences. Keep the rationale explicit,
   not implied.
4. **Detect conflicts** with active ADRs; surface them.
5. **Ask only blocking questions** — questions that materially block the decision. Skip the rest.
6. **Update the ADR** after the analysis.
7. **Transition (only when the file is actually improved):**

   | From | Action |
   |------|--------|
   | `proposed` (first refine) | `ai-factory adr transition <file> draft` — moves it to `drafts/` |
   | `draft` (repeat refines) | no transition — it stays `draft` |
   | `accepted` → `draft` | only on **explicit user intent** and after its active plan is explicitly archived or removed |

   The transition command owns the atomic move and legality check (§17); do not move files
   by hand.
8. **Report the status footer** — after stating what changed, end with one line so the ADR this
   run touched is obvious at a glance:

   ```text
   ✔ aif-adr-refine · ADR: <adr-id> [<status>] · Plan: <plan-id or none>
   ```

   Fill it from `ai-factory adr status <adr-file>` (id, status, active plan).

## Invocation

Claude Code: `/aif-adr-refine @adr-file` · Codex: `$aif-adr-refine @adr-file`.
