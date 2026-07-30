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
- stop when refinement is done, which the workflow states as a condition on the pass and not as a judgement call

forbidden_behaviors:
- do not implement the decision
- do not write or modify production code
- do not create an implementation plan
- do not delegate to `aif-improve`: its criteria are for implementation plans, not decision records
- do not propose implementation as a next step, or end with an offer such as "shall I implement this now?"
- do not act on implementation intent: the operator invokes `aif-adr-next` or the plan skills
- do not report anything beyond what changed in the ADR and the transition applied
- do not move ADR files by hand: the transition command owns the atomic move and the legality check (PRD §17)
- do not add an obligation the decision does not require: a line of `rules:` names the failure it prevents, or it is not written
- do not rewrite a line whose meaning is unchanged: rewording is not refinement, and it hides the passes that carry a decision

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
- an obligation costs what it takes to satisfy: name the failure each one prevents, and drop the obligation whose cost is above that failure
- count effort already sunk into existing code as nothing by itself; the compatibility and migration cost of replacing it does count
- when the correct option costs more, present it alongside the cheap one, each with its cost, risk, and reversibility
- demand stronger grounds for hard-to-reverse choices such as data schemas and public APIs
- end with exactly 1 explicit recommendation; the operator decides, never silently downgrade to the cheap option
- revise a recommendation only on a new fact, a new constraint, a found reasoning error, a clarified goal, or an explicit operator decision, and name what changed
- disagreement alone is not new information: a flip with no new grounds means the original was ungrounded

workflow:
1. run `ai-factory adr validate <file>`
2. fix the validation errors it reports, and its CNL-P warnings: they become errors at `accepted`
3. run `ai-factory adr decisions` and read every line: it states what each accepted and active ADR obliges
4. name any `issues:` that command reports to the operator, then continue: the digest covers the corpus minus those files
5. inspect project rules, architecture documents, and the relevant code
6. open in full the ADRs whose `decision:`, `constraints:`, `scope:` or `rules:` touch this decision
7. verify the ADR states exactly 1 primary decision, and that its obligations live in this ADR as `rules:` rather than in sibling ADRs
8. judge the depth the decision carries: when a `git revert` of markdown is its whole rollback, the bar is `decision:`, `scope:`, `rules:`, `negative:`, and 1 alternative with its `rejected_because`, with no 6–12 month horizon
9. improve the blocks the ADR profile declares, which `ai-factory adr format adr` prints, keeping the rationale explicit rather than implied
10. state an obligation that another ADR could break in `rules:` or `constraints:`, never in the prose of `## Context`: a rule left in prose is invisible to every later reader
11. rewrite any prose limit in canonical form, `open connections per client <= 2`, per the lexicon in `ai-factory adr format`
12. replace any unquantified comparative with the property and its bound, or drop the claim
13. record every conflict with an accepted or active ADR, naming the block of the other ADR it contradicts
14. ask only questions that materially block the decision
15. update the ADR
16. when this pass changed no `decision:`, `scope:`, `constraints:` or `rules:` line, refinement is done: recommend `aif-adr-accept` and run no further pass
17. run `ai-factory adr validate <file>` again on the edited file and fix what it reports: the run at step 1 judged the file you replaced
18. apply the matching transition when its condition holds
19. report the pass number, the blocks this pass changed, and the status footer

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
