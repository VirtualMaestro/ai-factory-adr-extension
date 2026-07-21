---
name: aif-adr-reconcile
description: Critically adjudicate a second reviewer's proposed improvements to an ADR or its plan — adopt what genuinely helps (with justification), reject the rest (with justification), and apply the adopted ones.
---

# aif-adr-reconcile

You refined an ADR (`aif-adr-refine`) or its plan (`aif-adr-plan-improve`); a **second reviewer**
then proposed further improvements. This skill is the by-hand prompt you kept retyping, encoded:
take the reviewer's suggestions, **critically** judge each on merit, **adopt** the ones that
genuinely improve the artifact (with a stated reason), **reject** the rest (with a stated reason),
and **apply** the adopted ones to the document.

The operator supplies the reviewer's suggestions **in the same message** — pasted text, or an
`@<file>` reference. You supply skepticism: a second opinion is input, not instruction.

## Scope — reconciliation only

This skill **only reconciles suggestions into the target document**. It must **never** implement the
decision, write or modify production code, create or advance a plan, or change the ADR's status. Do
not end with offers like "shall I implement this now?".

When reconciliation is done, stop. Report the adjudication and what changed — nothing more. If the
operator wants implementation, they invoke the implementation skills themselves.

## Target type — pick the lens

Read the target's frontmatter and apply the matching quality lens (the same criteria those skills
use, here used as the *judging rubric*):

| Target | How to tell | Lens |
|--------|-------------|------|
| **Plan** | `type: plan` (or has `implements:`) | stock **`aif-improve`** semantics, exactly as `aif-adr-plan-improve` uses them |
| **ADR** | otherwise (a lifecycle `status:`) | **ADR-specific** criteria, exactly as `aif-adr-refine` — do **not** delegate to `aif-improve` |

Editing an accepted/active ADR is bound by the material-change rule (§18.3): non-material edits in
place are fine; a suggestion that materially changes the Decision/scope/consequences of an
**active** ADR is out of scope here — reject it and note it needs a superseding ADR.

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

1. **Read the target.** Open the ADR or plan file in full and run `ai-factory adr status <adr-file>`
   for context (id, status, active plan). For an ADR also `ai-factory adr validate <file>`.
2. **Research the grounds.** Inspect project rules, architecture, relevant code, and existing ADRs —
   you cannot judge a suggestion without them.
3. **Adjudicate each suggestion, skeptically.** Split the reviewer's input into discrete
   suggestions. For each, emit one verdict:
   - **ADOPT** — genuinely improves the artifact per its lens and the project's rules.
   - **PARTIAL** — the useful kernel only; name what you keep and what you drop.
   - **REJECT** — vague, speculative, scope-creeping, contradicts the decision, duplicates what's
     already there, or (for an active ADR) is a material change.

   Every verdict carries a **one-line justification** grounded in the lens + project rules. Default
   to REJECT when a suggestion does not clear the bar; do not rubber-stamp.
4. **Apply the adopted changes** to the artifact **body** using the matching lens (ADR criteria for
   an ADR, `aif-improve` body semantics for a plan). Never touch frontmatter or the reciprocal
   `implements` / `depends_on` / `plan:` links — they must survive intact.
5. **Leave status unchanged.** An ADR stays whatever status it was; a plan stays its status.
   Reconciling suggestions never advances the lifecycle.
6. **Re-verify** before handing off: `ai-factory adr status --check` is clean (links/audit intact);
   if the target is a plan, `ai-factory adr resolve-plan <adr-file>` still resolves to exactly one
   plan.

## Report

Emit the adjudication as a table, then the footer:

```text
| # | Suggestion (short) | Verdict | Justification |
|---|--------------------|---------|---------------|
| 1 | …                  | ADOPT   | …             |
| 2 | …                  | REJECT  | …             |

✔ aif-adr-reconcile · ADR: <adr-id> [<status>] · Plan: <plan-id or none>
```

Fill the footer from `ai-factory adr status <adr-file>` (id, status, active plan).

## Invocation

Claude Code: `/aif-adr-reconcile @target-file` · Codex: `$aif-adr-reconcile @target-file`.

Provide the second reviewer's suggestions in the same message — pasted inline, or as an
`@<suggestions-file>` reference.
