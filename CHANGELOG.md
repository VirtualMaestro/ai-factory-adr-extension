# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-07-14

### Added

- **ADR-vs-code verification.** New `aif-adr-verify` skill and `adr verify-anchors`
  subcommand answer, on demand, "was this ADR implemented, and does the code still
  match the Decision?" — a re-runnable, read-only check that complements
  `aif-adr-finalize`'s one-shot, plan-based gate. `verify-anchors` deterministically
  confirms every `code:` anchor (and any `#symbol`) resolves on disk, exiting non-zero
  when any is missing (CI-usable); the skill layers agent judgment over it, classifying
  the ADR as implemented / partial / drift / not-implemented / doc-only and reporting a
  verdict without ever mutating the ADR or the code. Symbol matching is a naive
  word-boundary grep for now; deep resolution is deferred to Phase 6 code-intelligence.

### Fixed

- **`adr finalize` no longer clobbers authored Evidence.** Finalize previously overwrote the
  `- **Evidence:**` field with the literal `implemented` on every activation, destroying any
  content the author had written (commit refs, artifact lists) — and, because `setField` only
  replaced the field's first line, a multiline Evidence was left with orphaned continuation lines
  and broken markdown. Finalize now overwrites Evidence (and, on the documentation-only path,
  Plan) **only** when the value is empty or a template sentinel; content-ful values are left
  intact. `setField` is now multiline-aware, so replacing a value consumes its continuation lines
  and never leaves an orphan.

## [1.2.0] — 2026-07-14

### Added

- **`code` source anchors.** New optional `code: []` frontmatter array on ADRs —
  primary entry-point anchors (repo-root paths, POSIX `/`, optional `#symbol`)
  linking a decision to where it lives in the source. `aif-adr-finalize`
  promotes the free-text `- **Code:**` line into it at activation;
  `aif-adr-migrate` backfills it on `active`/`superseded` imports;
  `adr validate` warns (never errors) when an `active` non-documentation-only
  ADR has no anchors. Decision of record:
  `docs/ADR_Proposal_Cognee_CodebaseMemory.md`.

### Removed

- **Phase 5 (optional Cognee memory) dropped.** Resolved by spike: decision
  recall at solo-dev corpus size is served by frontmatter + `adr status` + grep;
  Cognee's LLM-at-ingestion cost is not justified. The `adr.memory.provider`
  config axis stays reserved (`none`).

## [1.1.0] — 2026-07-13

### Added

- **Legacy migration.** New `aif-adr-migrate` skill to bring a project's
  pre-existing/homegrown ADRs into the lifecycle (map status, rewrite into the
  template on a branch, repoint `AGENTS.md`-type instruction files), backed by a
  new `ai-factory adr import <topic> --status <s> [--id <id>]` command that
  scaffolds a conformant skeleton at any status. `adr new` now delegates to it.

## [1.0.1] — 2026-07-13

### Fixed

- Bundle the runtime `yaml` dependency in the npm package.
- Reject missing or malformed AI Factory project markers.
- Roll back multi-file lifecycle operations on failure and protect managed transitions.
- Restrict documentation-only detection to structured Implementation fields.
- Align status output, skills, and MVP documentation with delivered behavior.

## [1.0.0] — 2026-07-13

First stable release. MVP (Phases 0–4) complete; all acceptance criteria
(Acc 1–30) met, verified end-to-end against `ai-factory@2.17.0`.

### Added

- **Packaging (Phase 0):** `extension.json` manifest (skills + `adr` command),
  vendored `extension.schema.json` validation, AI Factory project detection and
  version-compatibility gate, `extension add/update/remove` integration coverage.
- **Core lifecycle (Phase 1):** frontmatter parsing, stable IDs, status↔directory
  mapping, transition-legality table with atomic moves + rollback, plan
  resolution via `implements` metadata, path-safety guards, and the full
  `ai-factory adr` command surface (`init`, `new`, `validate`, `transition`,
  `link-plan`, `resolve-plan`, `finalize`, `supersede`, `status`).
- **Skills:** `aif-adr-overview` (lifecycle map) plus eight stage skills —
  `propose`, `refine`, `accept` (Phase 2); `plan`, `implement`, `finalize`
  (Phase 3); `supersede` (Phase 4); `status`. Installed for Claude and Codex
  runtimes.
- **Audit integration:** `ai-factory adr status --check` exits non-zero on
  blocking errors for CI; artifact auditing invoked with an explicit ADR root.
- Superseding archives the old ADR's plan with an `archived_reason` note.

### Deferred

- Phase 5 (optional Cognee memory) and Phase 6 (optional code-intelligence) are
  post-MVP and do not block this release.

[1.2.0]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.2.0
[1.0.1]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.0.1
[1.0.0]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.0.0
