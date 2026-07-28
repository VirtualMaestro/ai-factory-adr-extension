---
name: aif-adr-propose
description: Create a new ADR proposal — scan for duplicate/conflicting decisions, generate a stable ID, and write it to proposals/ with status proposed.
---

mode: adr_proposal

purpose:
- capture and investigate a potential architectural decision (PRD §19.1)
- produce a `status: proposed` ADR that records what is known and names what is still open
- do not produce an accepted project rule

inputs:
- topic

forbidden_behaviors:
- do not hand-write the ADR file or invent its id: `ai-factory adr new` owns both
- do not create a near-duplicate of an ADR that is already accepted or active
- do not resolve an unresolved assumption by guessing
- do not present the decision as settled
- do not write the body as prose: the ADR body is CNL-P blocks, per `docs/cnlp-format.md` §7
- do not change `status: proposed`
- do not invoke `aif-explore` as a nested call: apply its read-only research posture inline

outputs:
- a `proposed` ADR at `<adr-root>/proposals/adr-<slug>.md`

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
1. run `ai-factory adr status --json` to inventory accepted, active, and superseded ADRs
2. read the candidates that look related
3. stop and recommend `aif-adr-refine` or `aif-adr-supersede` on the existing ADR when one already covers this decision
4. inspect `.ai-factory/ARCHITECTURE.md`, `.ai-factory/RULES.md`, any research artifacts, and the relevant source
5. run `ai-factory adr new "<topic>"`: it generates the stable id, creates `<adr-root>/proposals/adr-<slug>.md` with `status: proposed` from the template, and refuses if that id already exists
6. fill `problem:`, `constraints:` and `decision_drivers:` under `## Context` in the created file
7. state a numeric limit as a comparison, `<= 2 connections per client`, per `docs/cnlp-format.md` §8
8. record unresolved assumptions as placeholders in the body
9. leave `status: proposed`; acceptance happens later via `aif-adr-refine` then `aif-adr-accept`
10. report the status footer

status_footer:
  format: "✔ aif-adr-propose · ADR: <adr-id> [proposed] · Plan: none"
  source: `ai-factory adr status <adr-file>`, where a fresh proposal has no plan

invocation:
- Claude Code: `/aif-adr-propose <topic>`
- Codex: `$aif-adr-propose <topic>`
