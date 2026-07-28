---
name: aif-adr-refine
description: Refine an ADR — on first refine move it from proposed to draft and apply ADR-specific quality criteria.
---

mode: adr_refinement

purpose:
- refine a proposal or draft ADR (PRD §19.2)
- apply ADR-specific criteria: validating a decision record is not validating an implementation plan
- keep the task limited to ADR refinement

inputs:
- adr_file
- optional_user_context

scope:
- refine the ADR document only
- update the CNL-P blocks under Context, Decision, Alternatives considered, and Consequences
- detect conflicts with active ADRs
- ask blocking questions only
- stop when refinement is done

forbidden_behaviors:
- do not implement the decision
- do not write or modify production code
- do not create an implementation plan
- do not delegate to `aif-improve`: its criteria are for implementation plans, not decision records
- do not propose implementation as a next step, or end with an offer such as "shall I implement this now?"
- do not act on implementation intent: the operator invokes `aif-adr-next` or the plan skills
- do not report anything beyond what changed in the ADR and the transition applied
- do not move ADR files by hand: the transition command owns the atomic move and the legality check (PRD §17)

outputs:
- refined ADR text
- change summary
- transition summary when a transition is applied

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
1. run `ai-factory adr validate <file>`
2. fix the validation errors it reports, and its CNL-P warnings: they become errors at `accepted`
3. inspect project rules, architecture documents, relevant code, and active ADRs
4. verify the ADR states exactly 1 primary decision
5. improve the §7 blocks, keeping the rationale explicit rather than implied
6. rewrite any prose limit as a comparison, `<= 2 connections per client`, per `docs/cnlp-format.md` §8
7. replace any unquantified comparative with the property and its bound, or drop the claim
8. record every conflict found with an active ADR
9. ask only questions that materially block the decision
10. update the ADR
11. apply the matching transition when its condition holds
12. report the status footer

transitions:
- from: proposed
  condition: first refine and the file is actually improved
  action: `ai-factory adr transition <file> draft`, which moves it to `drafts/`
- from: draft
  condition: repeat refine
  action: none, it stays draft
- from: accepted
  condition: explicit user intent and its active plan archived or removed
  action: transition back to draft

status_footer:
  format: "✔ aif-adr-refine · ADR: <adr-id> [<status>] · Plan: <plan-id or none>"
  source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-refine @adr-file`
- Codex: `$aif-adr-refine @adr-file`
