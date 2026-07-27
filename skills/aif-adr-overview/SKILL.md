---
name: aif-adr-overview
description: Map of the ADR lifecycle — which aif-adr-* skill to use at each stage, the status directories, and the source-of-truth rules. Start here.
---

mode: adr_lifecycle_map

purpose:
- name each lifecycle stage, the skill that owns it, and the rules that hold throughout
- be read first, before invoking the stage-specific skill

inputs:
- none

lifecycle_flow:
```text
        aif-adr-propose        aif-adr-refine        aif-adr-accept
none ───────────────────▶ proposed ──────────▶ draft ──────────────▶ accepted
                                                                         │
                                       aif-adr-plan + aif-adr-implement  │
                                                                         ▼
                                                     accepted (with a linked plan)
                                                                         │
                                                        aif-adr-finalize │
                                                                         ▼
                                                                       active
                                                                         │
                                                    aif-adr-supersede    │
                                                                         ▼
                                                                    superseded
```

linear_flow_skills:
- `aif-adr-propose <topic>`: scan for duplicate and conflicting decisions, scaffold a `proposed` ADR in `proposals/`
- `aif-adr-refine`: first refine moves `proposed` to `draft`; applies ADR-specific quality criteria
- `aif-adr-accept`: check preconditions, run the audit, move `draft` to `accepted`
- `aif-adr-plan`: create the implementation plan in `paths.plans` with reciprocal `implements` and `plan:` links; skip for documentation-only ADRs
- `aif-adr-plan-improve <adr>`: improve that plan by naming the ADR, not the plan file; it resolves the plan and applies the standard `aif-improve`, whereas `aif-adr-refine` is for the decision
- `aif-adr-implement`: resolve the plan by metadata and implement; the ADR stays `accepted`
- `aif-adr-finalize`: strict verification, then `accepted` to `active`, and archive the plan; a documentation-only ADR goes straight to `active` with no plan
- `aif-adr-supersede <old> <new>`: replace an accepted or active decision with a newer one via reciprocal links and a move to `superseded`, preserving history

off_flow_skills:
- `aif-adr-status`: read-only overview and diagnostics, at any point
- `aif-adr-verify <adr>`: re-runnable, read-only check of an accepted or active ADR against the implemented code — do the `code:` anchors resolve, does the code honor the Decision
- `aif-adr-verify-all`: the same conformance check swept across every active ADR, as one table
- `aif-adr-reconcile <target>`: after a refine, critically adjudicate a second reviewer's proposed improvements to an ADR or its plan, adopting the sound ones and rejecting the rest with a reason, then applying the adopted ones; never advances status or implements
- `aif-adr-next`: reads the `depends_on` graph and recommends which ADR to implement next, where ready means `accepted` with all dependencies `active`, plus the topological order, blocked ADRs, and any cycles
- `aif-adr-migrate`: one-time, brings a project's pre-existing legacy ADRs into this lifecycle; run it before authoring new ADRs in a project that already had its own ADR approach

status_directories:
- each status maps to one directory under the ADR root, default `docs/adr/`: `proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/`
- the filename stem always equals the ADR `id`
- transitions are atomic file moves: never hand-edit the `status` field or move files manually, use the `adr` subcommands that the skills wrap

rules_that_always_hold:
- source of truth is the Markdown ADR files in Git; any external index is advisory, never authoritative
- retrieval order (PRD §23): read active ADRs first, treat accepted ones as pending decisions, use superseded ones only for historical reasoning, and never treat proposals or drafts as active rules
- always open the source Markdown after any semantic lookup, and resolve contradictions in favor of the authoritative file and its lifecycle status
- active decisions are protected (PRD §18.3): edit an active ADR in place only for non-material changes such as code links, evidence, paths, and formatting; a material change to the Decision, constraints, scope, or consequences requires a new ADR that supersedes, which is what `aif-adr-supersede` is for
- skills own judgment, the CLI owns file mechanics: `ai-factory adr …` performs deterministic moves, links, and audits, and the skills decide whether a transition is warranted

invocation:
- Claude Code: `/aif-adr-overview`
- Codex: `$aif-adr-overview`
