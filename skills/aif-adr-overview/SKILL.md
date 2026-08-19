---
name: aif-adr-overview
description: Map of the ADR lifecycle — which aif-adr-* skill to use at each stage, the status directories, and the source-of-truth rules. Start here.
---

mode: adr_lifecycle_map

purpose:
- name each lifecycle stage, the skill that owns it, and the rules that hold throughout
- be read first, before invoking the stage-specific skill

inputs:
- none: the skill is reference material and reads the lifecycle it describes

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
| Skill | Does | Constraint |
|---|---|---|
| `aif-adr-propose <topic>` | scaffolds a `proposed` ADR in `proposals/` | scans for duplicate and conflicting decisions first |
| `aif-adr-refine` | applies ADR-specific quality criteria | first refine moves `proposed` to `draft` |
| `aif-adr-accept` | moves `draft` to `accepted` | checks preconditions and runs the audit first |
| `aif-adr-plan` | creates the plan in `paths.plans` with reciprocal `implements` and `plan:` links | skip for documentation-only ADRs |
| `aif-adr-plan-improve <adr>` | improves that plan, named by the ADR | resolves the plan itself and applies the standard `aif-improve`; `aif-adr-refine` is for the decision |
| `aif-adr-implement` | resolves the plan by metadata and implements | the ADR stays `accepted` |
| `aif-adr-finalize` | strict verification, then `accepted` to `active`, and archives the plan | a documentation-only ADR goes straight to `active` with no plan |
| `aif-adr-supersede <old> <new>` | replaces an accepted or active decision with a newer one | reciprocal links and a move to `superseded`, preserving history |

off_flow_skills:
| Skill | Does | Constraint |
|---|---|---|
| `aif-adr-status` | read-only overview and diagnostics, at any point | never mutates |
| `aif-adr-verify <adr>` | checks one accepted or active ADR against the implemented code | read-only, re-runnable; do the `code:` anchors resolve, does the code honor the Decision |
| `aif-adr-verify-all` | the same check swept across every active ADR, as one table | read-only |
| `aif-adr-check-consistency` | checks the accepted and active ADRs against each other, reporting contradiction, redundancy and shared areas | read-only; reads `ai-factory adr decisions`, then both ADRs of every named pair in full |
| `aif-adr-reconcile <target>` | adjudicates a second reviewer's proposed improvements, adopting and rejecting each with a reason | never advances status, never implements |
| `aif-adr-next` | reads the `depends_on` graph and recommends what to implement next | ready means `accepted` with all dependencies `active`; also reports order, blocked ADRs, cycles |
| `aif-adr-migrate` | brings a project's pre-existing legacy ADRs into this lifecycle | one-time; run it before authoring new ADRs there |

status_directories:
- each status maps to one directory under the ADR root, default `docs/adr/`: `proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/`
- the filename stem always equals the ADR `id`
- transitions are atomic file moves: do not hand-edit the `status` field or move files manually
- use the `adr` subcommands that the skills wrap

rules_that_always_hold:
- source of truth is the Markdown ADR files in Git; any external index is advisory, never authoritative
- retrieval order (PRD §23): read active ADRs first, treat accepted ones as pending decisions, use superseded ones only for historical reasoning, and never treat proposals or drafts as active rules
- always open the source Markdown after any semantic lookup, and resolve contradictions in favor of the authoritative file and its lifecycle status
- PRD §18.3 protects active decisions: edit an active ADR in place only for non-material changes such as code links, evidence, paths, and formatting
- a material change to the Decision, constraints, scope, or consequences requires a new ADR that supersedes, which is what `aif-adr-supersede` is for
- skills own judgment, the CLI owns file mechanics: `ai-factory adr …` performs deterministic moves, links, and audits, and the skills decide whether a transition is due
- read `ai-factory adr decisions` before writing, refining, planning or accepting a decision: it states what every accepted and active ADR obliges, which is the corpus a new decision cannot contradict
- an ADR records a decision that binds work beyond the change that prompts it: when a `git revert` undoes the change and binds nothing else, the fact belongs in the guide or the code, and `aif-adr-propose` writes no ADR

workflow:
- none: this skill is reference material, read before invoking a stage skill, and runs no steps of its own

invocation:
- Claude Code: `/aif-adr-overview`
- Codex: `$aif-adr-overview`
