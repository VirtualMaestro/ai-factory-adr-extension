# Backlog — `ai-factory-adr-extension`

Open items only. The MVP build log and original PRD remain in Git history.

**Current state:** 4.8.2 · 20 skills · 194 tests pass, none skipped. The live runs behind
4.8.2 are in
[validation-audit-2026-10-12.md](validation-audit-2026-10-12.md).
CNL-P comes from `cnlp-kit`; this repository owns `skill`, `live` and `plan`.
Adopting projects read them through `ai-factory adr format`.

All four LIVE proposal phases are committed. Follow-up live probes cover ultra input,
inline fallback, configured exploratory acceptance and a reproduced fix round.
The other-runtime consistency smoke run, plan profile and optional code-intelligence
adapter are implemented and checked. See
[validation-backlog-2026-10-11.md](validation-backlog-2026-10-11.md) for evidence and limits.
The real 40-ADR corpus now has a complete 780-pair sweep and an independently checked
targeted regression. One revision-id persistence contradiction remains a source-project
decision to reconcile; this extension's tests do not authorize changing its active ADRs.

## Open — real-corpus scoring and semantic limits

- Independently label all pairs in the real corpus, including pairs the checker rejected
  as non-candidates, then score a fresh blind run. Reviewing only reported pairs cannot
  measure missed contradictions. This is a quality measurement task, not unfinished runtime code.
- Automate behavioral regressions for false contradiction judgments and unsupported
  fresh-reviewer claims when a repeatable agent-evaluation runner exists. Current evidence
  is fresh live runs; format and rubric tests do not test agent behavior.
- An obligation outside `decision`, `constraints`, `scope` or `rules` does not enter the
  decision digest. The real corpus has 40 conformant ADRs, so it does not establish how
  reliably a reader discovers an obligation hidden in prose elsewhere.
- The real digest has 2150 lines, above the former unexercised 800-line threshold.
  Repeat scale checks when a materially larger or multi-repository corpus exists.

`npm run corpus` still prepares the 14-ADR labelled fixture; its README specifies the
blind-run protocol. Both supported runtimes now have successful runs on that fixture.

## Watch on real use

- Whether lexicon comparatives reject legitimate quoted or explanatory evidence.
- Whether the draft-warning and accepted-error gate matches author expectations.
- Whether a legitimate verbatim line outside a fence needs more than 250 characters.

Checker changes belong in `cnlp-kit`; this repository maintains its profile vocabulary
and lifecycle severity gates. Do not copy the checker into the extension.

## Optional follow-up

`codegraph` is reserved. The shared code-intelligence contract already has a validated
read-only `codebase-memory-mcp` adapter; add the alternative only when its real tool
contract and an operator project require it. No graph owns ADRs or lifecycle status.

## Decided, kept for the record

**Phase 5 — optional memory (Cognee): dropped 2026-07-14.** Ingestion needs an LLM,
embedding model and service cost; the frontmatter and file baseline covers recall at
the current size. `codebase-memory-mcp` indexes code symbols, not decision recall.
`adr.memory.provider` stays reserved at `none`; revisit at hundreds of ADRs or a
multi-repository setup.
