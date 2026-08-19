---
name: aif-adr-reconcile
description: Critically adjudicate a second reviewer's proposed improvements to an ADR or its plan — adopt what genuinely helps (with justification), reject the rest (with justification), and apply the adopted ones.
---

mode: adr_reconciliation

purpose:
- adjudicate a second reviewer's suggestions on an ADR or its plan, one verdict each
- apply the adopted suggestions to the target document
- treat a second opinion as input, not as instruction

inputs:
- target_file, an ADR or a plan
- reviewer_suggestions, pasted inline or as an `@<file>` reference in the same message

scope:
- reconcile suggestions into the target document only
- judge each suggestion on merit against the matching lens
- leave the target's status unchanged

forbidden_behaviors:
- do not implement the decision
- do not write or modify production code
- do not create or advance a plan
- do not change the ADR's or the plan's status: reconciling never advances the lifecycle
- do not touch frontmatter or the reciprocal `implements` / `depends_on` / `plan:` links
- do not adopt a suggestion that materially changes the Decision, scope, or consequences of an active ADR: reject it and note that it needs a superseding ADR (PRD §18.3)
- do not rubber-stamp: default to REJECT when a suggestion does not clear the bar
- do not end with an offer such as "shall I implement this now?"
- do not report anything beyond the adjudication and what changed
- do not open a further review round when the adjudication adopted no change to `decision:`, `scope:`, `constraints:` or `rules:`: say the document is done and hand it to `aif-adr-accept`

outputs:
- adjudication table
- revised target document body

lenses:
- target has `type: plan` or an `implements:` field: judge by stock `aif-improve` semantics, exactly as `aif-adr-plan-improve` uses them
- target has a lifecycle `status:`: judge by ADR-specific criteria, exactly as `aif-adr-refine`, and do not delegate to `aif-improve`

verdicts:
- ADOPT: genuinely improves the artifact per its lens and the project's rules
- PARTIAL: the useful kernel only; name what you keep and what you drop
- REJECT: vague, speculative, scope-creeping, contradicts the decision, duplicates what is already there, or is a material change to an active ADR
- REJECT: adds an obligation without naming the failure it prevents, or one whose cost to satisfy is above that failure

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
1. open the target file in full
2. run `ai-factory adr status <adr-file>` for id, status, and active plan
3. run `ai-factory adr validate <file>` when the target is an ADR
4. read the target's frontmatter and pick the matching lens
5. inspect project rules, architecture documents, relevant code, and existing ADRs: no one can judge a suggestion without them
6. split the reviewer's input into discrete suggestions
7. give each suggestion one verdict with a one-line justification grounded in the lens and the project's rules
8. apply the adopted changes to the artifact body using the matching lens
9. re-run `ai-factory adr validate <file>` on an edited ADR: `status --check` reports errors only, so a warning on a `proposed` or `draft` file appears nowhere else
10. re-verify: `ai-factory adr status --check` is clean, and for a plan target `ai-factory adr resolve-plan <adr-file>` still resolves to exactly 1 plan
11. emit the adjudication table, then the status footer

report_format:
```text
| # | Suggestion (short) | Verdict | Justification |
|---|--------------------|---------|---------------|
| 1 | …                  | ADOPT   | …             |
| 2 | …                  | REJECT  | …             |
```

status_footer:
  format: "✔ aif-adr-reconcile · ADR: <adr-id> [<status>] · Plan: <plan-id or none>"
  source: `ai-factory adr status <adr-file>`

invocation:
- Claude Code: `/aif-adr-reconcile @target-file`
- Codex: `$aif-adr-reconcile @target-file`
- supply the reviewer's suggestions in the same message
