# The shared rubric — a seed, not a standard

`quality_rules:` is the one block a repository copies **verbatim** into every skill that
carries it. There is no include mechanism in the skill runtime, so the duplication is
deliberate, and a test asserts byte-identity within each group — otherwise the copies drift
and 2 skills judge the same work by different rules.

This file is a starting point taken from an ADR-lifecycle repository. Prune it before use:
a rule that names an artifact your skills do not have teaches the agent to look for nothing.

**Lines marked `[adr]` name artifacts specific to that project.** Replace the artifact, or
delete the line. Everything unmarked is about judgment and travels as it is.

## The long variant

```
quality_rules:
- measure every option by what serves the project best over its lifetime
- state delivery cost, risk, and timeline explicitly for the operator
- do not let your own convenience in this session stand in for them
- name the project invariants the change touches: module boundaries, public APIs, data schemas, active ADRs, `.ai-factory/RULES.md`, `.ai-factory/ARCHITECTURE.md`   [adr]
- cite the concrete rule, ADR, architecture document, or code location each judgment rests on   [adr]
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
```

Carried by the skills that choose between options and recommend one.

## The short variant

```
quality_rules:
- the decision is already made: do not re-litigate it
- ground every verdict in a concrete rule, a decision record, a plan step, or a code location   [adr]
- no ground named, no verdict: research until you can name it, never guess
- report code diverging from the decision as a deviation, with evidence
- do not resolve a deviation by reshaping the judgment to fit it
- do not excuse a deviation because fixing it would be laborious
- follow the project's existing conventions and invariants for tactical choices
- do not accept agent convenience — "faster", "easier" for this session — as an argument
- revise a verdict only on a new fact, a found reasoning error, or an explicit operator decision, and name what changed
- disagreement alone is not new information
```

Carried by the skills that check work against a decision already taken.

## Keeping the copies identical

A test in the source repository lists which skills carry which variant and asserts the block
is byte-identical within each group. Port it with the group lists rewritten for your skills:
without it, the first hand-edit to one copy goes unnoticed and the rubric stops being shared.
