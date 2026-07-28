# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log (verification spike, epics P0–P4, coverage check) is
finished and archived at [`archive/BACKLOG-mvp.md`](./archive/BACKLOG-mvp.md); it describes
the pre-1.6 body format in places and is history, not guidance.

**Current state:** 1.19.0 · 15 skills · 138 tests green · one CNL-P format with no profile
branching. The profiles are documents — `profiles/skill.md`, `profiles/adr.md`, and
`profiles/profile.md`, which describes the other two and conforms to itself — read by both
the agent and `src/artifacts/cnlp.js`. All 15 skill bodies and `templates/adr.md` are clean
against the current checks, with no skill exempt from its profile. An adopting project reaches
the standard and the profiles through `ai-factory adr format`, never by path. `npm run kit`
packs the format for another skill repository as `cnlp-kit.zip`, gitignored and rebuilt on
every version bump; `cnlp-kit/` is authoring material and never ships in the package.

---

## In flight — cross-ADR consistency

`ai-factory adr decisions` shipped in 1.19.0 and the 4 authoring skills read it. What remains
is the audit half: `aif-adr-check-consistency`, a read-only sweep that names contradicting,
redundant and area-sharing pairs. Plan, decisions and open ceilings:
[`plans/adr-cross-consistency.md`](./plans/adr-cross-consistency.md), steps 3–5 of §9.

---

## Next — the plan profile

Plan documents (`.ai-factory/plans/*.md`, written by `aif-adr-plan`) are the third kind of
technical document this extension owns and the only one still in prose.

- Adding it is one file, `profiles/plan.md`, plus whatever enforcement it earns. If it needs
  a change to `docs/cnlp-format.md` or to `src/artifacts/cnlp.js`, the generalization did not
  go far enough — that is the real test of it. `profiles/profile.md` was added in 1.14.0 with
  no code change, which is the first evidence that it holds.
- The block vocabulary starts from `aif-adr-plan`'s `plan_frontmatter:` and the steps the
  skill already dictates.
- A plan has no lifecycle status of its own to gate severity on, unlike an ADR, so the
  profile has to say what `enforcement:` means for it before any check is written.

---

## Watch on first real use

- whether the comparative list nags on legitimate prose in `rejected_because`
- whether the warning-at-draft, error-at-accepted gate lands where authors expect it
- whether the 250-character limit, now covering scalars and record sub-keys, hits a
  legitimate verbatim line that is not inside a fence

Each is one list or one line in `src/artifacts/cnlp.js`.

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
