---
name: aif-adr-propose
description: Create a new ADR proposal — scan for duplicate/conflicting decisions, generate a stable ID, and write it to proposals/ with status proposed.
---

# aif-adr-propose

Capture and investigate a potential architectural decision (PRD §19.1). Produce a
`status: proposed` ADR that records what is known and names what is still open — **not**
an accepted project rule.

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

1. **Inventory existing decisions.** Run `ai-factory adr status --json` to list accepted,
   active, and superseded ADRs. Read the candidates that look related.
2. **Detect duplicates and conflicts** *before* writing. If an accepted/active ADR already
   covers this decision, stop and recommend `aif-adr-refine` on it (or `aif-adr-supersede`)
   instead of creating a near-duplicate.
3. **Research the context.** Inspect `.ai-factory/ARCHITECTURE.md`, `.ai-factory/RULES.md`,
   any research artifacts, and the relevant source. Use the `aif-explore` research posture
   (broad read-only investigation) — describe that work here; do not assume this skill can
   invoke `aif-explore` as a nested call.
4. **Scaffold deterministically.** Run:

   ```text
   ai-factory adr new "<topic>"
   ```

   This generates the stable ID, creates `<configured-adr-root>/proposals/adr-<slug>.md` with
   `status: proposed` from the template, and refuses if that ID already exists. Do not
   hand-write the file or invent the ID — the command owns ID generation and the filename.
5. **Fill known Context** in the created file: Problem, Constraints, Decision drivers.
6. **Record unresolved assumptions explicitly** as placeholders in the body — do not resolve
   them by guessing.
7. **Keep it a proposal.** Leave `status: proposed`. Do not present the decision as settled;
   acceptance happens later via `aif-adr-refine` → `aif-adr-accept`.
8. **Report the status footer** — end with one line so the ADR this run created is obvious at a
   glance:

   ```text
   ✔ aif-adr-propose · ADR: <adr-id> [proposed] · Plan: none
   ```

   Fill it from `ai-factory adr status <adr-file>` (a fresh proposal has no plan).

## Invocation

Claude Code: `/aif-adr-propose <topic>` · Codex: `$aif-adr-propose <topic>`.
