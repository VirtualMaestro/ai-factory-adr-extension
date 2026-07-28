# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log (verification spike, epics P0–P4, coverage check) is
finished and archived at [`archive/BACKLOG-mvp.md`](./archive/BACKLOG-mvp.md); it describes
the pre-1.6 body format in places and is history, not guidance.

**Current state:** 1.12.0 · 15 skills · 109 tests green · skill and ADR bodies in CNL-P
form, both checked in code (`src/artifacts/cnlp.js`).

---

## Next — nothing open

The ADR profile landed in 1.12.0: `ai-factory adr validate` checks the body (inv 12), the
standard states what a conformant ADR contains, and `aif-adr-migrate` carries the
`pre_cnlp_overlay` for a prose corpus.

Watch on first real use: whether the §8 comparative list nags on legitimate prose in
`rejected_because`, and whether the warning-at-draft, error-at-accepted gate lands where
authors expect it. Both are one list and one line in `src/artifacts/cnlp.js`.

---

## Deferred

**Phase 6 — optional code-intelligence.** A provider interface plus a `codegraph` or
`codebase-memory-mcp` adapter (two alternatives for the same enrichment), for impact
analysis and verification enrichment. Must not own ADR data and must not change lifecycle
state. PRD §25.

---

## Decided, kept for the record

**Phase 5 — optional memory (Cognee): dropped 2026-07-14.** Cognee needs an LLM at
ingestion plus an embedding model — a service, its cost, and egress — while the agent
baseline of frontmatter, `adr status` and grep covers decision recall at this corpus size
for free. A companion spike found `codebase-memory-mcp` indexes code symbols only and does
not serve decision recall either. The `adr.memory.provider` config axis stays reserved at
`none`; revisit at hundreds of ADRs or a multi-repo setup. Full reasoning:
[`archive/ADR_Proposal_Cognee_CodebaseMemory.md`](./archive/ADR_Proposal_Cognee_CodebaseMemory.md).
