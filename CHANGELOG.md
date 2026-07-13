# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/VirtualMaestro/ai-factory-adr-extension/releases/tag/v1.0.0
