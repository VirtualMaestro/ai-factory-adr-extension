---
name: aif-adr-plan
description: Create an implementation plan for an accepted ADR with reciprocal implements/plan links.
---

mode: adr_planning

purpose:
- turn an accepted decision into an AI Factory implementation plan (PRD §19.4)
- create the plan as a separate artifact in the project's plans directory
- wire the reciprocal ADR↔plan links

inputs:
- adr_file

preconditions:
- the ADR status is `accepted` and it is not superseded
- no non-archived plan already implements it: check with `ai-factory adr resolve-plan <adr-file>`, which must report no active plan and exits non-zero on more than 1
- the ADR actually requires implementation; documentation-only decisions skip straight to `aif-adr-finalize`

scope:
- create the plan and link it to the ADR
- apply `aif-plan full` planning semantics inline

forbidden_behaviors:
- do not change the ADR's status: creating a plan never advances the decision
- do not hand-place the plan file or guess its path: AI Factory owns the plans directory (`paths.plans`) and the filename format, including sequential `NNNN_` numbering when configured
- do not invoke `aif-plan` as a nested skill: apply its semantics in this run
- do not fill `evidence:`; `plan:` filled with `evidence:` empty is the pending state, and `aif-adr-finalize` sets `evidence: implemented` later
- do not put the plan id into `affects`: that list is for genuinely affected artifacts only

plan_frontmatter:
```yaml
id: plan-<adr-short-stable-name>
type: plan
status: in_progress
depends_on: [<adr-short-stable-name>]
implements: [<adr-short-stable-name>]
```

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
- count effort already sunk into existing code as nothing by itself; the compatibility and migration cost of replacing it does count
- when the correct option costs more, present it alongside the cheap one, each with its cost, risk, and reversibility
- demand stronger grounds for hard-to-reverse choices such as data schemas and public APIs
- end with exactly 1 explicit recommendation; the operator decides, never silently downgrade to the cheap option
- revise a recommendation only on a new fact, a new constraint, a found reasoning error, a clarified goal, or an explicit operator decision, and name what changed
- disagreement alone is not new information: a flip with no new grounds means the original was ungrounded

workflow:
1. run `ai-factory adr status <adr-file>` and inspect the accepted ADR and any relevant active decisions
2. run `ai-factory adr decisions` and read every line: the plan implements 1 decision and breaks none of the others
3. stop when that command reports an `issues:` entry for this ADR, and recommend `aif-adr-refine`: a plan built on a decision that failed to parse rests on nothing
4. name any `issues:` entry for another ADR to the operator, then continue
5. open in full the ADRs whose `decision:`, `constraints:`, `scope:` or `rules:` touch the work this plan will do
6. state every dependency warning it reports to the operator and confirm they want to continue before creating the plan
7. create the plan by applying `aif-plan full` planning semantics in this run, with the frontmatter above
8. run `ai-factory adr link-plan <adr-file> <plan-file>`: it sets the ADR's `plan:` field to the plan id and adds `implements` and `depends_on` to the plan, leaving the ADR body untouched
9. leave `evidence:` empty
10. run `ai-factory adr status --check` and resolve any failures; it honors the configured ADR root
11. leave the ADR `accepted`
12. report the status footer

expected_warnings:
- the built-in `audit-artifacts` warning "Accepted ADR without `affects` links" is expected while `affects` is honestly empty, and is safe to accept

improving_the_plan:
- the plan is a standard AI Factory plan artifact, so its improvement logic stays the stock `aif-improve`
- do not reimplement improve logic for ADRs; `aif-adr-refine` avoids `aif-improve` only because it works on the decision, a different task
- the easy path is `aif-adr-plan-improve @adr-file`, which applies `aif-improve` to this plan while you name the ADR, so you never track the plan's path
- improving the plan directly instead: `aif-improve` targets by path or auto-resolution, never by id
- with no argument it takes the active plan on the current git branch (`paths.plans/<branch-slug>.md`) or the single plan in `paths.plans`
- otherwise pass `@<plan-path>`, found with `aif-improve --list` or `ai-factory adr resolve-plan <adr-file>`
- a bare ADR or plan id does not resolve here: that shortcut is `resolve-plan`, not `aif-improve`
- either way `aif-improve` edits the plan body, not its frontmatter, so the reciprocal links survive
- after improving, re-verify: `ai-factory adr resolve-plan <adr-file>` still resolves to exactly 1 plan, and `ai-factory adr status --check` is clean

status_footer:
  format: "✔ aif-adr-plan · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)"
  source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-plan @adr-file`
- Codex: `$aif-adr-plan @adr-file`
