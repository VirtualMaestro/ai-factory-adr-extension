# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log (verification spike, epics P0–P4, coverage check) is
finished and archived at [`archive/BACKLOG-mvp.md`](./archive/BACKLOG-mvp.md); it describes
the pre-1.6 body format in places and is history, not guidance.

**Current state:** 1.11.3 · 15 skills · 102 tests green · skill bodies in CNL-P form.

---

## Next — migrate ADR documents to CNL-P

The 15 skill bodies were migrated in 1.11.0–1.11.3. The ADR documents themselves have not
been.

- The standard is [`cnlp-format.md`](./cnlp-format.md); §7 gives the ADR block layout and §10
  the migration procedure. Read it first rather than copying the shape out of an existing
  file.
- `templates/adr.md` already ships in CNL-P, so any ADR scaffolded by `ai-factory adr new`
  is born in the format. Only ADRs written before that need converting.
- `aif-adr-migrate` names the CNL-P blocks in its file-shape case, so the skill is ready to
  do the work on a legacy corpus.
- Watch the placeholder sentinels: `ai-factory adr validate` rejects `[decision]`,
  `[scope]`, `[main reason]`, `[Alternative]`, `not created` and `not implemented` on an
  `accepted` or `active` ADR (`src/lifecycle/validate.js`, inv 6).

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
