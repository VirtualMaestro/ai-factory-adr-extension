# Add "Evaluating solutions" guidance block to analyzing skills — release 1.9.0

## Context

The analyzing/recommending skills (refine, reconcile, plan, plan-improve, verify, propose, implement) let the agent rank options by session-local cost — "faster", "easier", "fewer files touched" — instead of what is best for the project long-term. Recommendations also often arrive ungrounded: when the operator questions one, the agent flips instead of defending it from evidence. Fix: insert one shared prompting section, **"## Evaluating solutions"**, into each of the 7 skills. No shared-include mechanism exists (each SKILL.md is standalone and installed as its own dir), so the block is pasted verbatim into each file — matching the repo's existing convention of prose duplication across skills.

## The block (identical in all 7 skills)

Inserted as a `## Evaluating solutions` section **immediately before `## Workflow`** (after the intro / Scope section). Exact text:

```markdown
## Evaluating solutions

Whenever this skill weighs options or makes a recommendation (a fix, an alternative, a
plan step, a refactoring, an improvement), the only measure is **what serves the project
best over its lifetime** — never what is cheapest to produce in this session.

1. **Invariants first.** Before comparing options, name the project invariants the change
   touches: module boundaries, public APIs, data schemas, active ADRs, rules in
   `.ai-factory/RULES.md` / `.ai-factory/ARCHITECTURE.md`. An option checked against
   nothing is an opinion, not a recommendation.
2. **Ground every judgment.** Each recommendation and each verdict cites its concrete
   grounds: the specific rule, invariant, ADR, or code location it rests on. If you
   cannot name the ground, you have not researched enough — go read the code and docs;
   never fill the gap with a guess.
3. **Architectural changes require alternatives.** If a change touches module boundaries,
   public APIs, data schemas, or an architectural invariant, present at least two
   approaches. For each: consequences over the next 6–12 months of project evolution,
   effect on coupling, hidden risks. Name the rejected options and why — steelman them
   first, so you reject the strongest version, not a caricature.
4. **Effort is not an argument.** Implementation speed, diff size, file count, or "this
   touches many places" never justify an option that violates an invariant or
   consistency. Banned as sole justifications: "faster", "easier", "simpler", "cleaner",
   "less churn" — unless expanded into the concrete mechanism that makes it so.
5. **At equal correctness, smaller wins.** When options are architecturally equivalent,
   prefer the smaller change; do not add abstractions for hypothetical needs.
6. **Sunk cost is not an argument.** "The code already works this way" does not justify
   keeping an approach that contradicts an invariant.
7. **Consistency counts.** A locally "better" pattern that diverges from the codebase's
   existing convention creates two ways of doing one thing — that cost goes on the ledger
   and needs explicit justification.
8. **Weigh reversibility.** Hard-to-reverse choices (data schemas, public APIs, wire
   formats) demand stronger grounds than easily reversible ones.
9. **If the right option costs more — say so.** Present both the correct and the cheap
   option, with an explicit recommendation and the price of each. The human decides;
   never silently downgrade to the cheap one.
10. **Hold position under pushback; move on facts.** If the operator questions a
    recommendation, re-derive it from its stated grounds — change it only when a new fact
    or invariant surfaces, and name what changed. Disagreement alone is not new
    information; flipping without new grounds means the original was ungrounded.
```

Rules 2, 3 (steelman clause), and 10 are the anti-flip-flop reinforcement the user asked for: every verdict must carry named grounds, and position changes require new facts.

## Files to modify

Insert the block before `## Workflow` in each of:

1. `skills/aif-adr-refine/SKILL.md` (before line 22)
2. `skills/aif-adr-reconcile/SKILL.md` (before `## Workflow`, after "Target type — pick the lens")
3. `skills/aif-adr-plan/SKILL.md` (before `## Workflow`, after Preconditions)
4. `skills/aif-adr-plan-improve/SKILL.md` (before `## Workflow`, after Preconditions)
5. `skills/aif-adr-verify/SKILL.md` (before `## Workflow`)
6. `skills/aif-adr-propose/SKILL.md` (before `## Workflow`)
7. `skills/aif-adr-implement/SKILL.md` (before `## Workflow`, line 20, after Preconditions)

No per-skill tailoring: identical text, so future edits are a mechanical 7-file sync.

## Release 1.9.0

- `extension.json` — version `1.8.0` → `1.9.0`.
- `CHANGELOG.md` — add 1.9.0 entry: "Add Evaluating solutions decision-quality rubric to the seven analyzing skills (refine, reconcile, plan, plan-improve, verify, propose, implement)".
- `README.md` — read it; update only if it enumerates skill sections/behaviors (do not force a change).
- Commit style follows repo convention: `feat: release 1.9.0 — add Evaluating solutions rubric to analyzing skills` (commit only when user asks — per session rules).

## Verification

1. `npm test` — existing suites (extension-manifest, integration lifecycle) must stay green; they check skill installation, not SKILL.md wording, so no test changes expected.
2. Grep check: `## Evaluating solutions` appears exactly 7 times under `skills/`.
3. Spot-read one modified skill end-to-end to confirm the section doesn't contradict its Scope rules (e.g. reconcile's "default to REJECT" stays intact; the block governs *how* to judge, not *what* is in scope).
