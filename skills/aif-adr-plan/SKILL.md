---
name: aif-adr-plan
description: Create an implementation plan for an accepted ADR with reciprocal implements/plan links.
---

# aif-adr-plan

Turn an accepted decision into an AI Factory implementation plan (PRD §19.4). The plan is a
**separate artifact** that lives in the project's plans directory — this skill creates it and
wires the reciprocal ADR↔plan links; it does not change the ADR's status.

## Preconditions

Do not plan unless **all** hold:

- the ADR status is `accepted` and it is not superseded;
- no non-archived plan already implements it — check with
  `ai-factory adr resolve-plan <adr-file>` (it must report no active plan; it exits non-zero
  on more than one — resolve that first);
- the ADR actually requires implementation (documentation-only decisions skip straight to
  `aif-adr-finalize`).

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

1. **Inspect** the accepted ADR and any relevant active decisions. Run
   `ai-factory adr status <adr-file>` first. If it reports dependency warnings, state each
   warning to the operator and confirm they want to continue before creating the plan.
2. **Create the plan** by applying `aif-plan full` planning semantics in this run; do not
   invoke `aif-plan` as a nested skill. AI Factory owns plan
   creation, the plans directory (`paths.plans`), and the filename format (including
   sequential `NNNN_` numbering when configured) — do **not** hand-place the file or guess
   its path. Give the plan frontmatter:

   ```yaml
   id: plan-<adr-short-stable-name>
   type: plan
   status: in_progress
   depends_on: [<adr-short-stable-name>]
   implements: [<adr-short-stable-name>]
   ```

3. **Link reciprocally** — one command wires both sides:

   ```text
   ai-factory adr link-plan <adr-file> <plan-file>
   ```

   It sets the ADR frontmatter `plan:` field to the plan id and adds `implements`/`depends_on`
   to the plan. The ADR body is never touched, and the plan id does **not** go into `affects`
   (that list is for genuinely affected artifacts only — the built-in `audit-artifacts` warning
   "Accepted ADR without `affects` links" is therefore expected while `affects` is honestly
   empty, and is safe to accept).
4. **Leave `evidence:` empty.** `plan:` filled + `evidence:` empty *is* the "pending" state;
   `aif-adr-finalize` sets `evidence: implemented` later.
5. **Audit** — `ai-factory adr status --check`. It honors the configured ADR root; resolve
   any failures.
6. **Leave the ADR `accepted`.** Creating a plan never advances the decision.
7. **Report the status footer** — end with one line so the ADR and its new plan are obvious at a
   glance:

   ```text
   ✔ aif-adr-plan · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)
   ```

   Fill it from `ai-factory adr status <adr-file>` (id, status, active plan).

## Improving the plan

The plan is a **standard AI Factory plan artifact**, so its improvement logic stays the stock
**`aif-improve`** — do not reimplement improve logic for ADRs (`aif-adr-refine` avoids `aif-improve`
only because it sharpens the **decision**, a different task).

The easy path is **`aif-adr-plan-improve @adr-file`** — it applies `aif-improve` to this plan but
you name the **ADR**, and it resolves the plan for you. Use that so you never have to track the
plan's path.

If you improve the plan directly instead, `aif-improve` targets it by **path or auto-resolution —
not by id**: an optional `@<plan-path>`, or with no argument the active plan on the current git
branch (`paths.plans/<branch-slug>.md`) or the single plan in `paths.plans`. So on the branch where
the plan was created just run `aif-improve`; otherwise pass `@<plan-path>` (find it with
`aif-improve --list`, or `ai-factory adr resolve-plan <adr-file>`). A bare ADR/plan **id** does not
resolve here — that shortcut is ours (`resolve-plan`), not `aif-improve`'s.

Either way, `aif-improve` edits the plan **body**, not its frontmatter, so the reciprocal
`implements`/`depends_on` links survive — but after improving, re-verify before implementing:
`ai-factory adr resolve-plan <adr-file>` (still resolves to exactly one plan) and
`ai-factory adr status --check` (links/audit clean).

## Invocation

Claude Code: `/aif-adr-plan @adr-file` · Codex: `$aif-adr-plan @adr-file`.
