---
name: aif-adr-plan-improve
description: Improve the implementation plan of an accepted ADR — resolve the plan from the ADR itself and apply aif-improve to it, so you work by ADR name and never touch the plan filename.
---

# aif-adr-plan-improve

Improve an ADR's implementation plan **by naming the ADR, not the plan**. The plan is a
throwaway technical map; the ADR is what you track. This skill resolves the plan from the
ADR's `implements` links and applies the stock **`aif-improve`** semantics to it — the same
improvement `aif-improve` does, without you having to remember or look up the plan's path.

It **only refines the plan**. It never implements the decision, edits production code, or
advances the ADR (that is `aif-adr-implement` / `aif-adr-finalize`). It is the by-ADR-name
shortcut for the manual "resolve the plan, then run `aif-improve`" flow documented in
`aif-adr-plan`.

## Preconditions

- the ADR status is `accepted` and it is not superseded;
- exactly one non-archived plan implements it (the workflow checks this).

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

1. **Resolve the plan from the ADR** — never guess the filename:

   ```text
   ai-factory adr resolve-plan <adr-file>
   ```

   It resolves via the plan's `implements` frontmatter (add `--json` for the plan's `file`).
   - **no active plan** → stop and recommend `aif-adr-plan` first (nothing to improve yet);
   - **more than one active plan** → the command exits non-zero; surface it and stop, resolve
     that before improving;
   - **exactly one** → that is the plan to improve.
2. **Improve the resolved plan** by applying `aif-improve` semantics in this run against that
   plan file; do not invoke `aif-improve` as a nested skill. `aif-improve` edits the plan
   **body**, not its frontmatter, so the reciprocal `implements`/`depends_on` links survive.
3. **Re-verify** before handing off: `ai-factory adr resolve-plan <adr-file>` still resolves to
   exactly one plan, and `ai-factory adr status --check` is clean (links/audit intact).
4. **Leave the ADR `accepted`.** Improving a plan never advances the decision.
5. **Report the status footer** — end with one line so the ADR/plan this run touched is obvious
   at a glance:

   ```text
   ✔ aif-adr-plan-improve · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)
   ```

   Fill it from `ai-factory adr status <adr-file>` (id, status, active plan).

## Invocation

Claude Code: `/aif-adr-plan-improve @adr-file` · Codex: `$aif-adr-plan-improve @adr-file`.
