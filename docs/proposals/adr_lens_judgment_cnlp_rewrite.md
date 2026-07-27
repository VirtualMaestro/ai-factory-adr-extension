---
id: adr-lens-judgment-is-calibrated-by-reference-game-anchors
type: adr
status: draft
owners: [maintainer]
depends_on: [adr-knowledge-layer-yaml-not-sqlite, adr-roles-to-lens-system]
code:
  - src/core/knowledge/lenses.yaml
  - src/core/knowledge/schema/lenses.schema.json
  - src/ai/prompts/lens-application-prompt.ts
  - src/core/critique/lens-outcome.ts
  - scripts/build-knowledge.mjs
---

# Lens judgment is calibrated by reference-game anchors

## Problem

problem:
- lens verdict (ok / warning / broken / insufficient_info) is produced as an absolute judgment
- prompt sends lens_id, display_name, concept_check, referenced_terms only
- calibration data in lenses.yaml (reference_games) is validated but never sent to the model
- absolute judgment drifts across runs on the same input
- broken on a critical lens triggers repair and can reach reject; drift there rewrites the user concept non-reproducibly

anchor_set_defects:
- 2 of 12 lenses have no broken anchor, though broken is repair-triggering for them
- all 12 negative anchors name their own verdict in the title (self-answering, not boundary-marking)
- insufficient_info is correctly excluded from the anchor model (it is refusal-to-judge, not a design position; owned by a separate ADR)

type_defect:
- reference_games is one shared interface across 5 knowledge files with 4 different shapes
- generated type keeps every field but name optional; a lens anchor asserts nothing today

constraints:
- knowledge stays declarative YAML plus JSON Schema, generated into committed TS, no runtime YAML parsing
- calibration change must stay a knowledge-layer edit, never an executor change
- no code-level prompt ceiling exists; MAX_TOKENS bounds completion only, not prompt size

decision_drivers:
- reproducible verdict across runs
- anchors mark the boundary between adjacent outcomes, not restate the rule
- calibration change reviewable in diff
- smallest knowledge-layer change that satisfies the above

## Decision

decision: calibrate lens judgment with inline reference-game anchors that mark boundaries between adjacent outcomes; deliver anchors to the model as a comparison task

scope:
- covers ok / warning / broken only
- touches lenses.yaml, its schema, the knowledge build, the lens-application prompt, one new optional field on LensOutcome
- excludes: shared reference-game catalog, anchor selection by game_context (see Out of scope)

rules:
1. anchor_type:
   - new required interface LensAnchor { name, expected_outcome, why }
   - stays inline per lens; ReferenceGame (other 4 files) is untouched
2. boundary_requirement (build-enforced):
   - every lens: at least one boundary pair (ok<->warning or warning<->broken)
   - every critical lens: additionally a broken anchor
   - no anchor may restate its own verdict
   - rule form: predicate over one lens, not a build-script step (future operator-managed lenses can reuse it)
3. anchor_content:
   - replace self-answering negatives with real shipped titles where one honestly fits
   - why must name the structural property judged, never taste, fashion, or sales performance
4. prompt_contract:
   - prompt sends anchors, asks for nearest anchor placement plus reason
   - new optional field: LensOutcome.nearest_anchor (string)
   - does not reuse confidence_reason or evidence (owned by a different ADR, different semantics)

increment_order:
1. send existing anchors in the prompt
2. add strict LensAnchor type
3. fix anchor set content and enforce boundary requirement
(each increment independently shippable, build stays green)

## Out of scope

deferred:
- shared reference-games.yaml catalog across 5 knowledge files
  trigger: second consumer needing shared game metadata, or measured duplicate drift
- anchor selection by game_context axes
  trigger: same as catalog (depends on it)

## Alternatives considered

alternatives:
- id: prompt-only-fix
  description: send existing reference_games as-is, no schema or type change
  rejected_because: leaves 2 critical lenses without a broken example; half the anchors are self-answering
  kept_as: increment 1 of the accepted decision

- id: shared-catalog
  description: extract reference-games.yaml, lenses reference by id
  rejected_because: only 2 of 10 titles repeat; the why (the actual judgment) stays per-lens either way; adds schema, id space, cross-reference check for unproven reuse
  reversibility: high, deferred with explicit trigger

- id: full-outcome-coverage
  description: require ok + warning + broken anchor on every lens
  rejected_because: triples anchor corpus to 36; forces contrived broken examples for advisory lenses where no honest one exists
  fallback: add second boundary pair later if drift persists on single-boundary lenses

- id: prose-only
  description: no game anchors, outcome_rules text only
  rejected_because: prose already exists as outcome_rules and already fails to hold the scale; anchors add the missing comparative dimension

- id: synthetic-few-shot
  description: use invented concept texts instead of real games
  rejected_because: 36+ synthetic concepts is a large opaque corpus versus a title plus one sentence; misremembering risk mitigated by why field instead

## Consequences

positive:
- verdict becomes comparative, not absolute
- uncalibrated boundaries caught by build, not by review
- generated type asserts real guarantees

unproven_hypothesis:
- claim: comparative judgment drifts less than absolute judgment
- acceptance_test: repeat run over fixed concept set, one pinned model/config, before/after
- metric: verdict-change rate across identical repeats; warning<->broken flips on critical lenses reported separately
- also_measure: input-token delta per call

negative:
- schema change, generator change, one new optional field, rewrite of 24 existing anchors
- authoring cost is real: boundary marking and negative replacement are per-lens judgment calls

blast_radius:
- no runtime TS reads lens.reference_games today
- touches: lenses.yaml, schema, build-knowledge.mjs, generated knowledge.ts, lens-application-prompt.ts, knowledge tests
- nearest_anchor is optional; no existing consumer changes

risks:
- model may read a title differently than intended -> mitigated by why, not eliminated
- prompt growth costs input tokens/latency, not completion headroom -> estimated ~640 tokens/call, must be measured
- forcing a broken anchor on every critical lens may produce a contrived example -> if this happens, question the lens's criticality instead of inventing an anchor

## Relationship to sibling ADRs

owns: nearest_anchor
does_not_own: confidence_reason, evidence (owned by adr-confidence-states-the-ground-of-a-verdict...)
recommended_order: this ADR -> severity -> confidence -> objection placement
note: siblings are independent decisions, not dependencies; order is a programme choice, not a depends_on relationship
