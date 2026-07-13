---
name: aif-adr-overview
description: Map of the ADR lifecycle — which aif-adr-* skill to use at each stage, the status directories, and the source-of-truth rules. Start here.
---

# aif-adr-overview

This extension manages Architecture Decision Records (ADRs) through an explicit,
audited lifecycle. This skill is the map: it names each stage, the skill that
owns it, and the rules that hold throughout. Read it first, then invoke the
stage-specific skill.

## Lifecycle flow

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

- **`aif-adr-propose <topic>`** — scan for duplicate/conflicting decisions,
  scaffold a `proposed` ADR in `proposals/`.
- **`aif-adr-refine`** — first refine moves `proposed → draft`; apply
  ADR-specific quality criteria.
- **`aif-adr-accept`** — check preconditions, run the audit, move
  `draft → accepted`.
- **`aif-adr-plan`** — create the implementation plan (in `paths.plans`) with
  reciprocal `implements`/`affects` links. *Skip for documentation-only ADRs.*
- **`aif-adr-implement`** — resolve the plan by metadata and implement; the ADR
  stays `accepted`.
- **`aif-adr-finalize`** — strict verification, then `accepted → active` and
  archive the plan. A documentation-only ADR goes straight to `active` with no
  plan.
- **`aif-adr-supersede <old> <new>`** — replace an accepted/active decision with
  a newer one (reciprocal links, `→ superseded`), preserving history.
- **`aif-adr-status`** — read-only overview / diagnostics, at any point.

## Status directories

Each status maps to one directory under the ADR root (default `docs/adr/`):
`proposals/`, `drafts/`, `accepted/`, `active/`, `superseded/`. The filename stem
always equals the ADR `id`. Transitions are atomic file moves — never hand-edit
the `status` field or move files manually; use the `adr` subcommands (the skills
wrap them).

## Rules that always hold

- **Source of truth = Markdown ADR files in Git.** Any external index is
  advisory, never authoritative.
- **Retrieval order (§23):** read **active** ADRs first; treat **accepted** as
  pending decisions; use **superseded** only for historical reasoning; never
  treat proposals/drafts as active rules. Always open the source Markdown after
  any semantic lookup, and resolve contradictions in favor of the authoritative
  file and its lifecycle status.
- **Active decisions are protected (§18.3):** edit an active ADR in place only
  for non-material changes (code links, evidence, paths, formatting). A material
  change to the Decision/constraints/scope/consequences requires a **new** ADR
  that supersedes — that is what `aif-adr-supersede` is for.
- **Skills own judgment; the CLI owns file mechanics.** `ai-factory adr …`
  performs deterministic moves/links/audits; the skills decide *whether* a
  transition is warranted.

## Invocation

Claude Code: `/aif-adr-overview` · Codex: `$aif-adr-overview`.
