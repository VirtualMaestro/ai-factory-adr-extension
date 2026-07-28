# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log (verification spike, epics P0–P4, coverage check) is
finished and archived at [`archive/BACKLOG-mvp.md`](./archive/BACKLOG-mvp.md); it describes
the pre-1.6 body format in places and is history, not guidance.

**Current state:** 1.13.0 · 15 skills · 107 tests green · one CNL-P format with no profile
branching; the profiles are documents (`profiles/skill.md`, `profiles/adr.md`) read by both
the agent and `src/artifacts/cnlp.js`.

---

## Next — the plan profile

Plan documents (`.ai-factory/plans/*.md`, written by `aif-adr-plan`) are the third kind of
technical document this extension owns and the only one still in prose.

- Adding it is one file, `profiles/plan.md`, plus whatever enforcement it earns. If it needs
  a change to `docs/cnlp-format.md` or to `src/artifacts/cnlp.js`, the 1.13.0 generalization
  did not go far enough — that is the real test of it.
- The block vocabulary starts from `aif-adr-plan`'s `plan_frontmatter:` and the steps the
  skill already dictates.

Watch on first real use of 1.13.0: whether the comparative list nags on legitimate prose in
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
