---
name: aif-adr-plan-improve
description: Improve the implementation plan of an accepted ADR — resolve the plan from the ADR itself and apply aif-improve to it, so you work by ADR name and never touch the plan filename.
---

mode: adr_plan_improvement

purpose:
- improve an ADR's implementation plan by naming the ADR, not the plan
- resolve the plan from the ADR's `implements` links and apply stock `aif-improve` semantics to it
- be the by-ADR-name shortcut for the manual "resolve the plan, then run `aif-improve`" flow documented in `aif-adr-plan`

inputs:
- adr_file

preconditions:
- the ADR status is `accepted` and it is not superseded
- exactly 1 non-archived plan implements it, which the workflow checks

scope:
- refine the plan body only

forbidden_behaviors:
- do not implement the decision
- do not edit production code
- do not advance the ADR: that is `aif-adr-implement` and `aif-adr-finalize`
- do not change the ADR's status: improving a plan never advances the decision
- do not guess the plan filename: resolve it from the ADR
- do not invoke `aif-improve` as a nested skill: apply its semantics in this run
- do not touch the plan's frontmatter, so the reciprocal `implements` and `depends_on` links survive

outputs:
- improved plan body

quality_rules:
- measure every option by what serves the project best over its lifetime
- state delivery cost, risk, and timeline explicitly for the operator
- do not let your own convenience in this session stand in for them
- name the project invariants the change touches: module boundaries, public APIs, data schemas, active ADRs, `.ai-factory/RULES.md`, `.ai-factory/ARCHITECTURE.md`
- cite the concrete rule, ADR, architecture document, or code location each judgment rests on
- no ground named, no recommendation: research until you can name it, never fill the gap with a guess
- present at least 2 viable approaches when the change touches a module boundary, public API, data schema, or architectural invariant
- if only 1 approach is viable, say so and why the others are not
- give per approach: consequences over the next 6–12 months of project evolution, effect on coupling, hidden risks
- reject each alternative in its strongest version, and name the reason
- do not accept "faster to write", "easier", or "smaller diff for me now" as justification for violating an invariant or an established convention of the codebase
- justify any divergent local pattern explicitly: two ways of doing one thing is a real cost
- name a large blast radius — many call sites, data migrations, compatibility breaks — as the genuine risk and cost it is
- prefer the smaller change at equal architectural correctness, and add no abstractions for hypothetical needs
- an obligation costs what it takes to satisfy: name the failure each one prevents, and drop the obligation whose cost is above that failure
- count effort already sunk into existing code as nothing by itself; the compatibility and migration cost of replacing it does count
- when the correct option costs more, present it alongside the cheap one, each with its cost, risk, and reversibility
- demand stronger grounds for hard-to-reverse choices such as data schemas and public APIs
- end with exactly 1 explicit recommendation; the operator decides, never silently downgrade to the cheap option
- revise a recommendation only on a new fact, a new constraint, a found reasoning error, a clarified goal, or an explicit operator decision, and name what changed
- disagreement alone is not new information: a flip with no new grounds means the original was ungrounded

workflow:
1. run `ai-factory adr resolve-plan <adr-file>`, which resolves via the plan's `implements` frontmatter; add `--json` for the plan's `file`
2. stop and recommend `aif-adr-plan` first when there is no active plan: there is nothing to improve yet
3. report the error and stop when more than 1 active plan exists: the command exits non-zero and that must be resolved before improving
4. improve the resolved plan by applying `aif-improve` semantics in this run against that plan file
5. re-verify: `ai-factory adr resolve-plan <adr-file>` still resolves to exactly 1 plan, and `ai-factory adr status --check` is clean
6. leave the ADR `accepted`
7. report the status footer

status_footer:
  format: "✔ aif-adr-plan-improve · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)"
  source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-plan-improve @adr-file`
- Codex: `$aif-adr-plan-improve @adr-file`
