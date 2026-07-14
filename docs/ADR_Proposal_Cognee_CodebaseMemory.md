---
id: adr-optional-memory-and-code-intelligence
type: adr
status: proposed
owners: [maintainer]
depends_on: []
affects: []
supersedes: []
code: []
---

# `code` source anchors + optional codebase-memory-mcp code-intelligence; no memory provider (Cognee rejected)

> Meta note: this is a decision record for a feature of this extension. The repo does
> not yet run its own ADR lifecycle (`docs/adr` is absent), so this file lives under
> `docs/` in the extension's own template shape rather than inside a status directory.
> It resolves the deferred Phase 5 (§24) item — dropped, see the spike results below —
> and refines Phase 6 (§25) from "provider iface, TBD" into a concrete decision.

## Context

- **Problem:** the current ADR process captures decisions but has two gaps.
  1. **No semantic retrieval of rationale.** An agent cannot ask "how was feature X
     decided, and what alternatives were weighed?" without grepping Markdown.
  2. **No structured link from decision to code.** After an ADR reaches `active`, the
     `- **Code:**` line the `aif-adr-finalize` skill writes is free-text prose — an
     agent must re-discover the decision↔code mapping every session.
- **Constraints:**
  - Markdown ADRs in Git stay the only source of truth (inv 14); external indexes are
    advisory, never authoritative.
  - No dual-write / sync logic between tools — the Markdown file is the single mutation
    point, indexed independently by each tool.
  - Any integration is optional and default-off (`provider: none`); a clean install
    pulls no external service (only `yaml` at runtime).
  - Solo-dev / small-team ergonomics: additive metadata, no new lifecycle machinery.
- **Decision drivers:** close both gaps with the least surface area; reuse the config
  axes already present in `.ai-factory/adr-extension.yaml` (`adr.memory.provider`,
  `adr.codeIntelligence.provider`, `src/config/adrConfig.js`); keep human prose sections
  untouched.

## Decision

Adopt a machine-readable `code` frontmatter field of **source anchors** on the ADR, and
**codebase-memory-mcp** as the optional code-intelligence provider (deferred Phase 6).
**Drop Phase 5 (Cognee): no memory provider ships** — `adr.memory.provider` stays `none`
(the config axis remains, costs nothing, keeps the door open). Decision recall is served
by the agent itself over the Markdown corpus.

| Concern | How it's answered |
|---|---|
| "Why was X decided? What alternatives?" | Agent baseline: `adr status` overview + frontmatter ids/titles + grep over the ADR root → open 1–2 candidate files. No service, no index. |
| "How is X implemented? What calls this?" | **codebase-memory-mcp** (`adr.codeIntelligence.provider`, §25): structural code graph — symbols, calls, data flow. |

- **Spike resolved (2026-07-14, lite, two indexed repos).** The BACKLOG spike "Cognee vs
  codebase-memory-mcp overlap" question is settled, in a direction neither option
  anticipated:
  1. codebase-memory-mcp **cannot** serve decision recall: its BM25/vector indexes cover
     code symbols only. Natural-language decision queries returned functions with ~0
     cosine scores; markdown sections exist in the graph but only structurally (heading
     names), their content is not searchable; on a real ADR-bearing repo a decision
     query returned zero results.
  2. Cognee is **not worth its cost** here: its `cognify` pipeline requires an LLM at
     ingestion (it builds the knowledge graph by LLM entity/relation extraction) plus an
     embedding model — an external service, API spend, and data egress, all to answer
     queries over a corpus of tens of files.
  3. The correct baseline is neither tool: at solo-dev corpus size (tens of ADRs), agent
     + structured frontmatter + grep covers "have we decided X" at zero cost.
  **Revisit trigger:** corpus grows to hundreds of ADRs or spans multiple repos.
- **The `code` frontmatter field** carries a small list of primary entry-point
  modules/symbols an agent starts tracing from — not every touched file:

  ```yaml
  code:
    - src/lifecycle/finalize.js
    - src/status.js
  ```

  It is distinct from `affects` (which holds AI Factory artifact ids, e.g. plan ids):
  `code` holds raw source anchors that codebase-memory-mcp resolves into qualified
  names, call chains, and snippets on demand.

  **Anchor convention:** paths relative to the repo root, POSIX `/` separators,
  case-exact; each entry is one file or one file plus an optional `#symbol` suffix
  narrowing to a single symbol (`src/status.js#validateDirStatus`). No directories, no
  globs, no other syntax — free-form anchors would defeat the deterministic parsing
  this field exists for.
- **Populated once, at the `accepted → active` transition** (via `aif-adr-finalize`) —
  the same moment `status` and `Evidence` are set. Absent/empty before then. Updated
  opportunistically when a later refactor renames an anchor (same discipline as fixing
  an import path). This is a status-transition action, not a retroactive edit of the
  Decision — Context/Decision/Consequences stay historically accurate.

  Edge cases: ADRs already `active`/`superseded` when this ships never pass through the
  transition again — they are backfilled once via `aif-adr-migrate` (the existing legacy
  import skill). On supersede the field is no longer maintained — the anchors are what
  they were at supersede time, resolvable against git history at the supersede commit if
  historical reproduction is needed; the replacement ADR carries its own anchors.
  Ordering at finalize: write `code`, then transition status.
- **Skip `codebase-memory-mcp`'s `manage_adr`** — measured: it is a single
  architecture-summary document per project with fixed sections (PURPOSE, STACK,
  ARCHITECTURE, PATTERNS, TRADEOFFS, PHILOSOPHY), not per-decision records — no ids, no
  statuses, and no search of any kind (modes are only `get`/`update`/`sections`).
  Storing lifecycle ADRs there means concatenating them into one blob plus dual-write,
  for retrieval identical to reading the Markdown files directly (consistent with §25:
  `manage_adr` must never be the primary store).

### End-to-end agent flow

1. Rationale → list ADRs (`adr status` overview / frontmatter ids+titles), grep the ADR
   root for the topic, open 1–2 candidates → context, decision, alternatives,
   consequences.
2. Where it lives → read the ADR `code` field (e.g. `[finalize.js, status.js]`).
   For an `accepted`-but-not-yet-`active` ADR the field is legitimately empty — the
   rationale exists, the implementation doesn't; steps 2–4 apply only once `active`.
3. Implementation detail → codebase-memory-mcp `search_graph` → `trace_path` →
   `get_code_snippet`.
4. Implement/modify → standard codebase-memory-mcp workflow.
5. On `accepted → active` (`aif-adr-finalize`) → agent fills the `code` field with
   primary entry-point symbols (verifying each anchor exists), then transitions status.
   No other ADR content changes.

The flow also works in reverse — "I'm editing `src/status.js`; which decisions govern
it?" — as a plain grep for the path over `code:` frontmatter in the ADR root. No index
or tooling required. This yields **direct-anchor candidates only**: code reached through
an anchor's call chain but not itself listed will not surface — transitive coverage is
not promised (the code graph, when enabled, can widen the search).

## Alternatives considered

- **`## Code` body section instead of frontmatter** — rejected: a body section needs an
  LLM or fragile string-matching to extract; frontmatter is machine-readable by
  convention (MADR principle) and keeps prose sections purely human-facing.
- **Keep the free-text `- **Code:**` body line only** — rejected: not structured; the
  point is deterministic parsing. This ADR **promotes** that line into the `code`
  frontmatter array.
- **Cognee as memory provider (PRD §24, Phase 5)** — rejected: `cognify` requires an LLM
  at ingestion (the knowledge graph is LLM-built) plus an embedding model — external
  service, API cost, data egress of ADR content — while the agent baseline already
  answers "have we decided X" at this corpus size for free. Revisit at hundreds of ADRs
  / multi-repo.
- **codebase-memory-mcp as decision memory** — rejected, measured: its BM25 and vector
  indexes cover code symbols only; ADR markdown sections are structural graph nodes
  (heading names) with unsearchable content; decision-recall queries scored ~0 or
  returned nothing on two real repos.
- **`codebase-memory-mcp`'s `manage_adr` as the ADR store** — rejected, measured: one
  fixed-section architecture summary per project, no per-decision records, no search;
  violates single-source-of-truth as a store (§25) and adds nothing as an index.
- **agentmemory (rohitg00/agentmemory) as memory provider** — rejected: it is agent
  session-memory (hook-captured observations, 4-tier consolidation), not a document
  index; its lifecycle semantics (Ebbinghaus decay, TTL auto-forget, importance
  eviction, contradiction auto-resolution) are actively wrong for authoritative
  decisions — an advisory index that silently forgets is worse than none; and it adds an
  always-on server + native iii-engine runtime (manual setup on Windows) for queries
  grep already answers. Its LLM-free/local-embeddings mode does remove Cognee's cost
  objection — if semantic ADR search is ever needed at scale, the right shape is a small
  local embedding index behind the reserved `adr.memory.provider` axis, not a memory
  platform.
- **In-code annotations (`@ADR(5)` comments)** — rejected: manual code↔ADR sync burden
  on every refactor; a named-pointer list + the code graph gives equivalent
  traceability with far less overhead.

## Consequences

- **Positive:** decision recall with zero external services, keys, or egress;
  deterministic decision↔code anchors that also answer the reverse question (code file
  → governing ADRs) with a grep; the one remaining integration is optional and
  default-off; no dual-write; reuses existing config axes.
- **Negative:** one more optional field to keep current on anchor-renaming refactors;
  decision recall is linear (grep + read) — deliberately unindexed at this corpus size.
- **Risks:** stale `code` anchors if refactor discipline slips (mitigated:
  codebase-memory-mcp resolves current symbols on demand, so a stale anchor degrades to
  a lookup, not a hard break); the agent-baseline recall stops scaling somewhere in the
  hundreds of ADRs — the reserved `adr.memory.provider` axis is the escape hatch, and
  the revisit trigger is recorded in the Decision.

## Implementation

- **Plan:** not created
- **Evidence:** not implemented

Concrete change points when Phase 6 is built (out of scope for this doc-only pass):
add `code: []` to `templates/adr.md` frontmatter; have `aif-adr-finalize` populate it at
activation (promoting today's body `- **Code:**` line); optionally teach `adr validate`
to accept it as anchor strings (no target resolution — audit does not own `code`) and
warn when an `active` non-documentation-only ADR has an empty `code`; backfill existing
`active`/`superseded` ADRs via `aif-adr-migrate`;
wire the codebase-memory-mcp adapter behind the existing provider knob; update the
BACKLOG deferred items to reference the `code` anchors. PRD §24 is not rewritten — it
stands as the historical Phase 5 plan; this ADR supersedes it as the decision of record.

## References

- **Code:** —
- **Issue:** —
- **Replaced by:** —
- **PRD:** §24 (Optional Cognee — dropped by this ADR), §25 (Optional Code-Intelligence)
- **Backlog:** Phase 5 dropped / Phase 6 deferred; spike "Cognee vs codebase-memory-mcp
  overlap" — resolved 2026-07-14, results recorded in the Decision above
