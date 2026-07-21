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

## Evaluating solutions

When this skill weighs options or makes a recommendation, the measure is what serves the
project best over its lifetime. Delivery cost, risk, and timeline are real inputs —
surface them explicitly for the operator; never let your own convenience in this session
stand in for them.

1. **Invariants and grounds first.** Name the project invariants the change touches
   (module boundaries, public APIs, data schemas, active ADRs, `.ai-factory/RULES.md` /
   `.ai-factory/ARCHITECTURE.md`) and cite the concrete rule, ADR, or code location each
   judgment rests on. No ground named — no recommendation: research until you can name
   it, never fill the gap with a guess.
2. **Architectural changes need real alternatives.** If the change touches a module
   boundary, public API, data schema, or architectural invariant, present at least two
   *viable* approaches — if only one is viable, say so and why the others are not. For
   each: consequences over the next 6–12 months of project evolution, effect on
   coupling, hidden risks. Steelman rejected options, so you reject their strongest
   version, and state the reason.
3. **Agent convenience is not an argument; blast radius is.** "Faster to write",
   "easier", "smaller diff for me now" never justify an option that violates an
   invariant or the codebase's established conventions (a divergent local pattern
   creates two ways of doing one thing — that cost needs explicit justification). But a
   large blast radius — many call sites, data migrations, compatibility breaks — is a
   genuine risk and cost: name it as such. At equal architectural correctness, prefer
   the smaller change; no abstractions for hypothetical needs. Effort already sunk into
   existing code counts for nothing by itself — the compatibility and migration cost of
   replacing it does count.
4. **If the right option costs more — say so.** Present the correct option and the cheap
   option, each with its cost, risk, and reversibility (hard-to-reverse choices — data
   schemas, public APIs — demand stronger grounds), plus one explicit recommendation.
   The operator decides; never silently downgrade to the cheap one.
5. **Revise on reasons, not on pushback.** Change a recommendation when a new fact or
   constraint surfaces, a reasoning error is found, the goal is clarified, or the
   operator explicitly decides — and name what changed. Disagreement alone is not new
   information; flipping without new grounds means the original was ungrounded.

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
