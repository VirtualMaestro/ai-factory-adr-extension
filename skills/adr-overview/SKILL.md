---
name: adr-overview
description: Map of the ADR lifecycle — which adr-* skill to use at each stage, the status directories, and the source-of-truth rules. Start here.
---

mode: adr_lifecycle_map

purpose:
- name each lifecycle stage, the skill that owns it, and the rules that hold throughout
- be read first, before invoking the stage-specific skill

inputs:
- none: the skill is reference material and reads the lifecycle it describes

lifecycle_flow:
```text
        adr-propose           adr-improve           adr-accept
none ───────────────────▶ proposed ──────────▶ draft ──────────────▶ accepted
                                                                         │
                                               adr-plan + adr-implement  │
                                                                         ▼
                                                     accepted (with a linked plan)
                                                                         │
                                                            adr-finalize │
                                                                         ▼
                                                                       active
                                                                         │
                                                        adr-supersede    │
                                                                         ▼
                                                                    superseded
```

linear_flow_skills:
| Skill | Does | Constraint |
|---|---|---|
| `adr-propose <topic>` | scaffolds a `proposed` ADR in `proposals/` | scans for duplicate and conflicting decisions first |
| `adr-improve` | applies ADR-specific quality criteria | first refine moves `proposed` to `draft` |
| `adr-accept` | moves `draft` to `accepted` | checks preconditions and runs the audit first |
| `adr-plan` | creates the plan in `paths.plans` with reciprocal `implements` and `plan:` links | skip for documentation-only ADRs |
| `adr-plan-improve <adr>` | improves that plan, named by the ADR | resolves the plan itself and applies the standard `aif-improve`; `adr-improve` is for the decision |
| `adr-implement` | resolves the plan by metadata and implements | the ADR stays `accepted` |
| `adr-finalize` | strict verification, then `accepted` to `active`, and archives the plan | a documentation-only ADR goes straight to `active` with no plan |
| `adr-supersede <old> <new>` | replaces an accepted or active decision with a newer one | reciprocal links and a move to `superseded`, preserving history |

off_flow_skills:
| Skill | Does | Constraint |
|---|---|---|
| `adr-status` | read-only overview and diagnostics, at any point | never mutates |
| `adr-verify <adr>` | checks one accepted or active ADR against the implemented code | read-only, re-runnable; do the `code:` anchors resolve, does the code honor the Decision |
| `adr-verify-all` | the same check swept across every active ADR, as one table | read-only |
| `adr-check-consistency` | checks the accepted and active ADRs against each other, reporting contradiction, redundancy and shared areas | read-only; reads `ai-factory adr decisions`, then both ADRs of every named pair in full |
| `adr-reconcile <target>` | adjudicates a second reviewer's proposed improvements, adopting and rejecting each with a reason | never advances status, never implements |
| `adr-next` | reads the `depends_on` graph and recommends what to implement next | ready means `accepted` with all dependencies `active`; also reports order, blocked ADRs, cycles |
| `adr-migrate` | brings a project's pre-existing legacy ADRs into this lifecycle | one-time; run it before authoring new ADRs there |
| `adr-live-seed` | seeds `LIVE.md` with the capabilities the product has today, and backfills `live:` on every active and accepted ADR | one-time; writes nothing before the operator approves the capability list |
| `adr-auto-plan <topic or adr> ...` | runs propose, improve, accept, plan, docs, commit and push for a batch of ADRs in 1 call | asks only principled questions, and the operator approves each acceptance; a rejection interrupts the run |
| `adr-auto-implement [adr ...]` | runs implement, tests, verify, review, fix, docs, finalize, commit and push in 1 call | asks nothing, stops on a blocker, and makes 1 commit per ADR on the current branch |

status_directories:
- each status maps to one directory under the ADR root, default `docs/adr/`: `proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/`
- the filename stem always equals the ADR `id`
- transitions are atomic file moves: do not hand-edit the `status` field or move files manually
- the CLI stages every move in Git, so a transition lands as a rename and the file keeps its history
- use the `adr` subcommands that the skills wrap

rules_that_always_hold:
- source of truth is the Markdown ADR files in Git; any external index is advisory, never authoritative
- retrieval order (PRD §23): read active ADRs first, treat accepted ones as pending decisions, use superseded ones only for historical reasoning, and never treat proposals or drafts as active rules
- always open the source Markdown after any semantic lookup, and resolve contradictions in favor of the authoritative file and its lifecycle status
- PRD §18.3 protects active decisions: edit an active ADR in place only for non-material changes such as code links, evidence, `live:`, paths, and formatting
- a material change to the Decision, constraints, scope, or consequences requires a new ADR that supersedes, which is what `adr-supersede` is for
- skills own judgment, the CLI owns file mechanics: `ai-factory adr …` performs deterministic moves, links, and audits, and the skills decide whether a transition is due
- read `ai-factory adr decisions` before writing, refining, planning or accepting a decision: it states what every accepted and active ADR obliges, which is the corpus a new decision cannot contradict
- an ADR records a decision that binds work beyond the change that prompts it: when a `git revert` undoes the change and binds nothing else, the fact belongs in the guide or the code, and `adr-propose` writes no ADR
- a change that alters what the product does goes through an ADR or a plan, never `aif-implement` without a plan: a change with no plan file has no carrier for its `LIVE.md` delta

document_roles:
| Document | Role | Who keeps it current |
|---|---|---|
| `LIVE.md` | what the product does now: 1 record per capability, 1–2 sentences, with refs | the CLI, when a change is done |
| `ai-factory adr decisions` | what every accepted and active ADR obliges | computed on read |
| active ADRs | why each obligation exists | nobody: a new ADR supersedes one |
| archived plans | how a change was made | history |
| `.ai-factory/DESCRIPTION.md` | purpose and stack, which rarely change | `aif-docs` |
| `AGENTS.md` | the code map only | `aif-docs` |
| `.ai-factory/ROADMAP.md` | the future only | `aif-roadmap` |

live_events:
| Event | Effect on `LIVE.md` |
|---|---|
| `ai-factory adr live init` | creates the file: the project opts in by having it, and every row below needs it |
| `adr-live-seed` | writes the approved capabilities once, and backfills `live:` with `applied:` on the active ADRs they name |
| `adr finalize`, documentation-only or not | applies the ADR's `live:` delta, with the ADR id as the ref |
| `adr supersede` with an `active` replacement | rewrites every ref to the old id into the new id |
| `adr supersede` with an `accepted` replacement | nothing: the old code runs until the replacement's finalize, which rewrites the refs |
| `adr import --status active`, from `adr-migrate` | nothing at import: `adr live check` reports `missing-delta`, and `adr live apply <adr>` applies the delta once it is written |
| a bug fix, or a delta of `none:` | nothing |
| an unlinked full or ultra plan completed | `aif-implement` applies its `adr-live` fence, with the plan stem as ref |
| a fast plan completed | `aif-implement` applies before deleting `PLAN.md`; every change carries durable `refs:` |
| a plan archived | nothing: its stem resolves in the archive too |
| a plan with `implements:` completed | nothing: the linked ADR carries the delta; apply exits with `skipped: linked to <adr-id>` |
| a plan removes an active ADR's capability | apply writes `contradicts:`; read `contradicts-active-adr` in the live check and `contradicted-by-plan` in decisions |

workflow:
- none: this skill is reference material, read before invoking a stage skill, and runs no steps of its own

invocation:
- Claude Code: `/adr-overview`
- Codex: `$adr-overview`
