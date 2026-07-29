# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log (verification spike, epics P0–P4, coverage check) is
finished; it described the pre-1.6 body format in places and was history, not guidance, so it
lives in Git history now and nowhere else.

**Current state:** 2.0.2 · 16 skills · 146 tests green · one CNL-P format with no profile
branching. The profiles are documents — `profiles/skill.md`, `profiles/adr.md`, and
`profiles/profile.md`, which describes the other two and conforms to itself — read by both
the agent and `src/artifacts/cnlp.js`. All 16 skill bodies and `templates/adr.md` are clean
against the current checks, with no skill exempt from its profile. An adopting project reaches
the standard and the profiles through `ai-factory adr format`, never by path. `npm run kit`
packs the format for another skill repository as `cnlp-kit.zip`, gitignored and rebuilt on
every version bump; `cnlp-kit/` is authoring material and never ships in the package.

---

## Open — one smoke run, and the ceilings

Cross-ADR consistency is built and measured: `ai-factory adr decisions` prints what every
accepted and active ADR obliges, the four authoring skills read it before they write, and
`aif-adr-check-consistency` sweeps the corpus for contradictions. Three cold runs against the labelled corpus, by agents kept away from the labels,
scored 3/3 on the contradictions with no false positive on either same-area pair and no extra
pair; the tables and footers matched each other exactly, and only the evidence wording varied.
All 3 ran on 1 runtime, so that number measures how steady the skill's wording is, not how it
travels between executors.

`npm run corpus` builds a throwaway project pointed at the corpus and prints what to do next;
`npm run corpus -- --key` prints the answer sheet. Protocol:
[`test/fixtures/consistency-corpus/README.md`](../test/fixtures/consistency-corpus/README.md).

- 1 smoke run on Codex, the other supported runtime.
- The plan's §7 ceilings stay open until a real corpus exists: an obligation left in prose is
  invisible to the digest, and the 800-line threshold has never been approached.
- The corpus is 14 hand-written ADRs by one author. A second, held-out corpus would test
  whether the skill generalizes past this one's habits; worth building when the first real
  project corpus exists to draw from.

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
`none`; revisit at hundreds of ADRs or a multi-repo setup.
