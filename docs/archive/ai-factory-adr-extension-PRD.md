# Product Requirements Document

## AI Factory ADR Extension

**Package name:** `ai-factory-adr-extension`
**Document status:** Final draft (rev 2 — aligned with the real AI Factory 2.x extension system)
**Target users:** Solo developers and small technical teams using AI Factory with Claude Code, Codex, or other AI Factory-supported runtimes
**Primary distribution:** npm package installed through the native AI Factory extension mechanism

---

## 1. Product Summary

`ai-factory-adr-extension` is an npm-distributed **AI Factory extension** that adds a minimal Architecture Decision Record workflow on top of an existing AI Factory project installation.

Expected usage:

```bash
npm install -g ai-factory
ai-factory init
ai-factory extension add ai-factory-adr-extension
```

AI Factory 2.x ships a first-class extension system (`ai-factory extension add|list|update|remove`) driven by an `extension.json` manifest. The extension system already handles: copying extension files to `.ai-factory/extensions/<name>/`, recording the extension in `.ai-factory.json`, installing extension skills into every configured agent runtime, registering custom CLI commands, merging MCP server templates, surviving `ai-factory update`, and clean removal.

This product therefore does **not** implement its own installer, provider adapters, file-ownership manifest, or update/uninstall machinery. It delivers:

1. Nine ADR skills (one overview plus eight lifecycle skills) in the standard Agent Skills (`SKILL.md`) format, installed by AI Factory into each selected runtime.
2. A deterministic ADR lifecycle helper registered as custom CLI commands (`ai-factory adr …`).
3. An ADR template and directory conventions.

Optional memory (Cognee) and code-intelligence adapters are specified for post-MVP phases but are not delivered by the current package.

The extension must not fork, bundle, or modify AI Factory itself. It reuses AI Factory's artifact frontmatter schema, plan files, `audit-artifacts`, and runtime installation machinery.

Markdown ADR files committed to Git are the only source of truth. External memory and code-graph integrations are optional derived indexes.

### Verified facts this document relies on

- AI Factory is `lee-to/ai-factory` (npm `ai-factory`, 2.x). Skills `aif-explore`, `aif-plan`, `aif-implement`, `aif-verify`, `aif-archive`, `aif-improve` exist.
- The AI Factory artifact frontmatter schema already recommends `type: adr` and the statuses `draft`, `proposed`, `accepted`, `active`, `superseded`, plus relations `depends_on`, `affects`, `implements`, `verifies`, `supersedes` — audited by `ai-factory audit-artifacts` (which already warns on "Accepted ADR without `affects` links").
- Default plan location is `paths.plans` = `.ai-factory/plans/`; archive is `paths.archive/plans/` = `.ai-factory/archive/plans/`. With `workflow.plan_id_format: sequential`, plan filenames gain a `NNNN_` prefix.
- `audit-artifacts` default discovery scans `.ai-factory`, `docs`, `README.md`, and `AGENTS.md` — a bare top-level `adr/` directory would not be scanned by default.
- Codex CLI (`.codex/skills/`) and Codex app (`.agents/skills/`) receive Codex-style skill content and use `$aif-*` invocations; slash-command runtimes use `/aif-*`. This conversion is performed by AI Factory, not by extensions.
- Cognee is a Python-based memory platform; Node integration goes through the `@cognee/cognee-ts` client against a Cognee server/API or through the `cognee-mcp` MCP server. It is not an embeddable Node library.

---

## 2. Problem

AI Factory provides workflows for exploration, planning, implementation, verification, and archival, and its artifact schema already names `adr` as an artifact type — but it provides no lifecycle, storage convention, or skills for architectural decisions.

Without a dedicated ADR workflow:

- architectural decisions remain only in conversations;
- the reasons behind decisions are lost between agent sessions;
- implementation plans are not explicitly linked to architectural decisions;
- agents may repeatedly propose options that were already considered and rejected;
- it becomes unclear which decisions are active, pending implementation, or obsolete;
- obsolete decisions may be treated as current project rules;
- different AI runtimes may receive inconsistent architectural context;
- an external vector or graph database may accidentally become a second source of truth.

The product must solve these problems without introducing a heavyweight governance system.

---

## 3. Product Principles

1. **Git-managed Markdown is authoritative.**
2. **The workflow must remain small and understandable.**
3. **One ADR records one primary decision.**
4. **Skills perform analysis; deterministic code performs state transitions.**
5. **Folder location and frontmatter status must remain consistent.**
6. **AI Factory remains a separate product; installation, per-runtime packaging, updates, and removal are delegated to the AI Factory extension system.**
7. **All `aif-adr-*` skills belong to this extension and must be created by it.**
8. **The extension reuses AI Factory's artifact schema and `audit-artifacts` instead of inventing a parallel metadata model.**
9. **Cognee and code-intelligence tools are optional adapters.**
10. **The complete lifecycle must work without any external database.**
11. **Plans are archived after completion, not deleted.**
12. **Active decisions are changed through superseding ADRs, not silent rewrites.**

---

## 4. Goals

The product must:

1. Create a new ADR proposal from a user idea.
2. Support iterative ADR discussion and refinement.
3. Explicitly accept an architectural decision.
4. Create an AI Factory implementation plan linked to the ADR.
5. Start implementation from the ADR without requiring the user to locate the plan manually.
6. Verify implementation before activating the ADR.
7. Archive completed plans.
8. Supersede obsolete decisions while preserving their history.
9. Give agents an unambiguous way to find current architectural decisions.
10. Detect invalid ADR states and broken links.
11. Distribute as an npm package installable with `ai-factory extension add`.
12. Install ADR skills into every runtime the project has configured, via AI Factory's own installation machinery.
13. Register the lifecycle helper as `ai-factory adr …` CLI commands.
14. Support safe repeatable installation and updates through `ai-factory extension update`.
15. Keep lifecycle behavior identical across runtimes (behavior lives in shared skill content and the deterministic helper, not per-runtime code).
16. Post-MVP: allow optional semantic memory through Cognee.
17. Post-MVP: allow optional code-impact enrichment through one configured code-intelligence provider.

---

## 5. Non-Goals

The first version must not:

- replace Git;
- replace AI Factory;
- install AI Factory automatically;
- modify files inside the AI Factory npm package or `node_modules`;
- implement its own installer, update, repair, or uninstall machinery (the AI Factory extension system owns this);
- implement per-runtime provider adapters or skill-format converters (AI Factory owns runtime packaging);
- maintain its own file-ownership manifest or checksum database (`.ai-factory.json` extension tracking owns this);
- duplicate `paths.plans` / `paths.archive` configuration already defined in `.ai-factory/config.yaml`;
- become a task tracker;
- become a multi-user approval platform;
- implement roles, permissions, or organizational governance;
- automatically approve architectural decisions;
- automatically supersede an ADR without an explicit user action;
- require Cognee, a code-graph MCP server, or any other external service;
- maintain a second authoritative ADR database;
- infer all architecture directly from source code;
- create a complex ontology for decisions;
- duplicate AI Factory skills inside the extension;
- add a `rejected` lifecycle state in the MVP;
- add mandatory timestamps that duplicate Git history.

---

## 6. Distribution and Package Model

### 6.1 npm package as an AI Factory extension

The package is published to npm as `ai-factory-adr-extension` and contains both manifests required by the AI Factory extension system:

- `extension.json` — the AI Factory extension manifest (validated against the schema AI Factory publishes at `schemas/extension.schema.json`);
- `package.json` — required because `ai-factory extension add <npm-name>` uses `npm pack` during installation (`"type": "module"`).

Installation:

```bash
ai-factory extension add ai-factory-adr-extension
```

Alternative sources supported for free by the extension system: a local directory or a git repository URL.

An optional thin `npx ai-factory-adr-extension` bin may exist for discoverability; its only job is to detect AI Factory and run (or print) `ai-factory extension add ai-factory-adr-extension`. It must not contain installation logic of its own.

### 6.2 `extension.json` manifest shape

```json
{
  "$schema": "https://raw.githubusercontent.com/lee-to/ai-factory/2.x/schemas/extension.schema.json",
  "name": "ai-factory-adr-extension",
  "version": "1.0.1",
  "description": "Architecture Decision Record lifecycle for AI Factory",
  "skills": [
    "skills/aif-adr-overview",
    "skills/aif-adr-propose",
    "skills/aif-adr-refine",
    "skills/aif-adr-accept",
    "skills/aif-adr-plan",
    "skills/aif-adr-implement",
    "skills/aif-adr-finalize",
    "skills/aif-adr-supersede",
    "skills/aif-adr-status"
  ],
  "commands": [
    { "name": "adr", "description": "ADR lifecycle", "module": "commands/adr.js" }
  ]
}
```

Optional later additions: an `mcpServers` template for `cognee-mcp` (Phase 5) and `injections` that teach `aif-plan` / `aif-implement` to consult active ADRs (post-MVP, opt-in).

### 6.3 Package ownership

The package owns:

- all `aif-adr-*` skill sources (standard Agent Skills format: directory + `SKILL.md`, optional references/templates/scripts);
- the deterministic ADR lifecycle helper (Commander.js command modules);
- the ADR template;
- post-MVP optional memory adapters;
- post-MVP optional code-intelligence adapters;
- tests for lifecycle and command behavior.

The package does **not** own installation bookkeeping: file tracking lives in `.ai-factory.json` under `extensions`, maintained by AI Factory.

### 6.4 Skills that must be developed

New product deliverables:

```text
aif-adr-propose
aif-adr-refine
aif-adr-accept
aif-adr-plan
aif-adr-implement
aif-adr-finalize
aif-adr-supersede
aif-adr-status
```

They do not exist in AI Factory and must be designed, implemented, tested, and published by this product.

### 6.5 Relationship with AI Factory workflows

The extension reuses the semantics of the real AI Factory skills:

```text
aif-explore   → research posture inside aif-adr-propose / aif-adr-refine
aif-plan      → full-planning semantics inside aif-adr-plan
aif-implement → implementation semantics inside aif-adr-implement
aif-verify    → strict verification semantics inside aif-adr-finalize
aif-archive   → plan archival semantics inside aif-adr-finalize
```

It reuses AI Factory conventions for artifact IDs, YAML frontmatter, plan files, artifact relationships, `audit-artifacts`, and runtime installation layouts.

A skill description may instruct an agent to follow an AI Factory workflow, but the implementation must not assume that one skill can always invoke another skill as a nested function call — runtimes activate skills differently (`/aif-*` slash commands in Claude Code, `$aif-*` in Codex). Shared ADR skills therefore describe the required workflow and preconditions, while the deterministic helper resolves files, validates transitions, and maintains links.

---

## 7. Installation Behavior

Installation is performed entirely by AI Factory:

```bash
ai-factory extension add ai-factory-adr-extension
```

What AI Factory does (existing machinery, not built by this product):

1. Copies extension files to `.ai-factory/extensions/ai-factory-adr-extension/`.
2. Records the extension in `.ai-factory.json` under `extensions`.
3. Installs the nine ADR skills into every configured agent runtime's skills directory (e.g. `.claude/skills/`, `.codex/skills/`), converting content for Codex-style runtimes automatically.
4. Registers the `ai-factory adr` CLI commands.
5. Re-applies all of the above after `ai-factory update`.

What the extension itself must do (first-use initialization, performed lazily by the helper and by `aif-adr-propose`):

1. Create the ADR directory structure under the configured ADR root if it does not exist.
2. Create the extension configuration file with defaults if it does not exist, without overwriting an existing one.
3. Never touch AI Factory-owned files (`.ai-factory/config.yaml`, base skills, agent configs).

An explicit `ai-factory adr init` command performs the same initialization eagerly and prints what was created, skipped, or already present. It must be safe to run repeatedly.

Requirements on failure: if the project has not been initialized by AI Factory, `ai-factory extension add` itself fails; the extension's own commands must additionally require a valid `.ai-factory.json` and produce a clear actionable error when it is missing or malformed.

---

## 8. CLI Commands

All CLI surface is registered through the extension `commands` mechanism: an ESM module exporting `register(program)` for the Commander.js instance AI Factory provides.

Required MVP commands:

```bash
ai-factory adr init
ai-factory adr validate <file>
ai-factory adr transition <file> <status>
ai-factory adr resolve-plan <file>
ai-factory adr link-plan <adr-file> <plan-file>
ai-factory adr finalize <file>
ai-factory adr supersede <old-file> <new-file>
ai-factory adr status [file]
ai-factory adr status --check        # non-zero exit for CI
```

Recommended later:

```bash
ai-factory adr sync                  # rebuild optional memory index
```

Installation, update, repair, and uninstall commands are **not** part of this product; they are:

```bash
ai-factory extension add ai-factory-adr-extension
ai-factory extension update ai-factory-adr-extension
ai-factory extension update --force   # repair / forced refresh
ai-factory extension remove ai-factory-adr-extension
```

---

## 9. Runtime Architecture

Shared ADR workflow logic must be runtime-independent. AI Factory owns runtime detection, skill directory resolution, and format conversion; the extension ships one set of skill sources.

Suggested package structure:

```text
ai-factory-adr-extension/
├── extension.json
├── package.json
├── skills/
│   ├── aif-adr-propose/SKILL.md
│   ├── aif-adr-refine/SKILL.md
│   ├── aif-adr-accept/SKILL.md
│   ├── aif-adr-plan/SKILL.md
│   ├── aif-adr-implement/SKILL.md
│   ├── aif-adr-finalize/SKILL.md
│   ├── aif-adr-supersede/SKILL.md
│   └── aif-adr-status/SKILL.md
├── commands/
│   └── adr.js                # register(program) → all `adr` subcommands
├── src/
│   ├── lifecycle/            # transitions, validation, atomic moves
│   ├── artifacts/            # frontmatter parsing, links, plan resolution
│   ├── config/               # extension config + AI Factory config.yaml readback
│   └── adapters/
│       ├── memory/           # none | cognee
│       └── code-intelligence/# none | codegraph | codebase-memory-mcp
├── templates/
│   └── adr.md
└── tests/
```

Rules:

- skills follow the standard Agent Skills format (directory with `SKILL.md` frontmatter: `name`, `description`);
- skill bodies must not hardcode runtime-specific invocation syntax when referring to other skills; where an invocation must be shown, show the slash form and note the Codex `$` form;
- no per-runtime code paths in lifecycle logic;
- runtime-specific concerns, if any ever appear, go through the extension manifest (`agents`, `agentFiles`), never through custom install code.

---

## 10. Installed Project Structure

Extension-owned package files (managed by AI Factory, refreshed on update):

```text
.ai-factory/extensions/ai-factory-adr-extension/
```

Extension configuration (user-owned, created once with defaults, never overwritten by updates):

```text
.ai-factory/adr-extension.yaml
```

Authoritative ADR files (user-owned, default root chosen so that `ai-factory audit-artifacts` default discovery — which scans `.ai-factory`, `docs`, `README.md`, `AGENTS.md` — covers them):

```text
docs/adr/
├── proposals/
├── drafts/
├── accepted/
├── active/
└── superseded/
```

The ADR root is configurable (`adr.root`). If the user relocates it outside the default audit scan paths, `ai-factory adr status` must pass the root explicitly to `audit-artifacts`, and CI docs must show the explicit-path form.

Implementation plans live in the AI Factory plans location resolved from `.ai-factory/config.yaml` (`paths.plans`, default `.ai-factory/plans/`). Archived plans live in `paths.archive/plans/` (default `.ai-factory/archive/plans/`). The extension reads these values from AI Factory's config; it must not define its own copies.

---

## 11. File Ownership and Tracking

File tracking is delegated to AI Factory:

- extension files and installed skills are recorded in `.ai-factory.json` under `extensions` and the per-runtime installed-file fields;
- `ai-factory extension update` refreshes extension-owned files and reports per-agent status;
- `ai-factory extension remove` cleans up extension skills, commands, injections, and MCP entries.

Extension-specific ownership rules:

- ADR documents under the ADR root are user data and must never be listed, refreshed, or removed by any package mechanism;
- `.ai-factory/adr-extension.yaml` is user configuration: created with defaults, migrated on schema change, never blindly overwritten;
- optional derived state (e.g. stale-memory-index marker) lives in `.ai-factory/adr-extension-state.json` and is disposable.

---

## 12. Update Behavior

Updates are performed by:

```bash
ai-factory extension update ai-factory-adr-extension
```

AI Factory queries the npm registry, skips unchanged versions, refreshes extension files, and re-installs extension skills. `--force` forces a refresh (repair).

Extension obligations during update:

- preserve all ADR documents and archived plans (never touched by update);
- preserve `.ai-factory/adr-extension.yaml`, applying config migrations keyed by a `version` field inside the file;
- keep command behavior backward-compatible within a major version;
- never introduce duplicate skills (skill identity is the directory name; AI Factory replaces by name).

---

## 13. Uninstall Behavior

```bash
ai-factory extension remove ai-factory-adr-extension
```

AI Factory removes extension skills, commands, injections, MCP entries, and the extension directory.

Must never be deleted by removal:

- ADR documents;
- archived plans;
- AI Factory base skills;
- project code;
- unrelated runtime configuration;
- external memory datasets (unless the user explicitly runs a documented cleanup, e.g. `ai-factory adr sync --purge` before removal).

`.ai-factory/adr-extension.yaml` may be left in place; document how to delete it manually.

---

## 14. ADR Directory Semantics

| Directory | Status | Meaning |
|---|---|---|
| `docs/adr/proposals` | `proposed` | The idea has been captured but not yet refined |
| `docs/adr/drafts` | `draft` | The decision is under discussion |
| `docs/adr/accepted` | `accepted` | The decision has been accepted but implementation is not yet verified |
| `docs/adr/active` | `active` | The decision is current and implemented, or explicitly requires no implementation |
| `docs/adr/superseded` | `superseded` | The decision has been replaced by another ADR |

All five statuses are within the recommended status vocabulary of the AI Factory artifact schema, so `audit-artifacts` treats them natively.

The directory and frontmatter status are deliberately duplicated:

- the directory is convenient for humans and filesystem tools;
- frontmatter is convenient for agents, audits, and indexing;
- validation prevents them from diverging.

---

## 15. ADR Naming

ADR filename:

```text
adr-<stable-slug>.md
```

Example:

```text
adr-logic-view-boundary.md
```

ADR ID:

```yaml
id: adr-logic-view-boundary
```

Rules:

- the ID is created once;
- the ID is globally unique inside the project (across all artifacts, since `audit-artifacts` checks IDs project-wide);
- the ID does not depend on the current directory;
- the ID does not change when the file moves;
- the ID does not change when the human-readable title is corrected;
- the filename stem must match the ADR ID.

Plan naming:

- plan artifact ID (authoritative): `plan-<adr-id>`, e.g. `plan-adr-logic-view-boundary`;
- plan filename (advisory): `<adr-id>-plan.md` in `paths.plans`; when the project uses `workflow.plan_id_format: sequential`, AI Factory prefixes plan filenames with `NNNN_` — the extension must tolerate any filename and must always resolve plans through frontmatter (`implements` containing the ADR ID), never through filename matching.

---

## 16. Minimal ADR Format

```markdown
---
id: adr-short-stable-name
type: adr
status: proposed
owners: [maintainer]
depends_on: []
affects: []
supersedes: []
code: []
issue:
plan:
evidence:
replaced_by:
---

# Short decision title

## Context

- **Problem:** What problem must be solved?
- **Constraints:** What constraints cannot be violated?
- **Decision drivers:** What criteria determine the choice?

## Decision

We will use **[decision]** for **[scope]** because **[main reason]**.

## Alternatives considered

- **[Alternative]** — rejected because ...
- **[Alternative]** — rejected because ...

## Consequences

- **Positive:** ...
- **Negative:** ...
- **Risks:** ...
```

Rules:

- frontmatter follows the AI Factory artifact schema (`id`, `type`, `status`, `owners`/`owner`, `depends_on`, `affects`, `supersedes`) plus the extension's machine fields (`code`, `issue`, `plan`, `evidence`, `replaced_by`); `owners` (array) is preferred, `owner` (scalar) is accepted;
- the machine state of a decision lives in frontmatter, never in the body: `plan:` names the linked plan (empty = no plan yet), `evidence:` is a short implementation-evidence string (empty = not implemented; `documentation-only` marks a doc-only decision), `replaced_by:` names the superseding ADR id, `issue:` holds an external tracker link or ticket id;
- frontmatter keys and section headings remain in English for consistent parsing and agent behavior;
- section content may use the project artifact language (`language.artifacts` from AI Factory config);
- optional empty arrays may be omitted;
- accepted and active ADRs may not contain unresolved placeholders;
- the format must remain readable without special rendering;
- the format must remain suitable for Markdown chunking and semantic ingestion.

---

## 17. ADR Lifecycle

```text
proposed
    ↓
draft
    ↓
accepted
    ↓
active
    ↓
superseded
```

Allowed transitions:

| From | To | Trigger |
|---|---|---|
| none | proposed | `aif-adr-propose` |
| proposed | draft | First successful `aif-adr-refine` |
| draft | accepted | `aif-adr-accept` |
| accepted | draft | Explicit refinement when the decision must change |
| accepted | active | Successful `aif-adr-finalize` |
| active | superseded | `aif-adr-supersede` |
| accepted | superseded | Replacement accepted before implementation |

Additional rules:

- Proposal and draft files may be deleted with explicit user confirmation; Git preserves their history.
- Superseding an `accepted` ADR that has a non-archived plan requires explicit confirmation; the orphaned plan must then be archived (with a note) or deleted by user choice — it must never remain resolvable as the active plan of a superseded ADR.
- A separate `rejected` state is not part of the MVP. Rejected alternatives belong in `Alternatives considered`.

---

## 18. Editing and Immutability Rules

### 18.1 Proposed and draft ADRs

All sections may be edited.

### 18.2 Accepted ADRs

An accepted ADR may be refined only through `aif-adr-refine`.

A substantive change to Context, Decision, Alternatives, or Consequences moves it back to `draft`.

Corrections that do not change meaning may be applied without changing status.

### 18.3 Active ADRs

The following may be updated directly:

- code links;
- commit or pull request references;
- implementation evidence;
- file paths;
- spelling and formatting corrections.

A material change to the Decision, constraints, scope, or consequences requires a new ADR that supersedes the current ADR.

---

## 19. Skill Specifications

### 19.1 `aif-adr-propose <topic>`

Purpose: capture and investigate a potential architectural decision.

Responsibilities:

1. Search existing accepted, active, and superseded ADRs.
2. Detect likely duplicates and conflicts.
3. Inspect relevant architecture documentation (`.ai-factory/ARCHITECTURE.md`, `RULES.md`, research artifacts) and source code.
4. Follow `aif-explore` exploration conventions where useful.
5. Generate a stable ADR ID and filename.
6. Create (initializing the directory structure on first use):

```text
docs/adr/proposals/adr-<slug>.md
```

7. Set `status: proposed`.
8. Fill known Context information.
9. Record unresolved assumptions explicitly.
10. Avoid prematurely presenting the proposal as an accepted project rule.

The proposal may contain placeholders.

### 19.2 `aif-adr-refine @adr-file`

Purpose: discuss and improve a proposal or draft.

Responsibilities:

1. Validate the ADR file (`ai-factory adr validate`).
2. Inspect relevant project rules, architecture, code, and existing ADRs.
3. Identify missing facts and unresolved trade-offs.
4. Ensure the document contains one primary decision.
5. Improve Context, Decision, Alternatives, and Consequences.
6. Detect conflicts with active ADRs.
7. Ask only questions that materially block the decision.
8. Update the ADR after analysis.
9. Keep decision rationale explicit rather than implied.

Transitions:

```text
proposed → draft
accepted → draft
```

The first successful refinement of a proposal moves it to `docs/adr/drafts` (via `ai-factory adr transition`).

Repeated calls on a draft keep it in `draft`.

Returning an accepted ADR to draft requires explicit user intent because it invalidates the accepted state.

This skill must use ADR-specific refinement criteria. It must not delegate to `aif-improve`, because implementation-plan validation and decision-record validation are different tasks.

### 19.3 `aif-adr-accept @adr-file`

Purpose: declare the decision complete enough to guide implementation.

Preconditions:

- file is in `docs/adr/drafts`;
- status is `draft`;
- exactly one primary decision is stated;
- Context describes the problem;
- relevant constraints are present;
- Decision is concrete;
- meaningful alternatives are recorded;
- Consequences include disadvantages or risks;
- no blocking questions remain;
- conflicts with active ADRs are resolved or explicitly addressed;
- artifact metadata is valid.

Actions:

1. Run ADR validation.
2. Run `ai-factory audit-artifacts` over the ADR root and `.ai-factory`.
3. Change status to `accepted` and move the file atomically to `docs/adr/accepted` (single helper call).
4. Post-MVP only: trigger optional memory synchronization when Phase 5 is implemented.
5. Report warnings and resulting path.

### 19.4 `aif-adr-plan @adr-file`

Purpose: create an AI Factory implementation plan from an accepted decision.

Preconditions:

- ADR status is `accepted`;
- ADR is not superseded;
- no non-archived plan already implements the ADR;
- the ADR requires implementation.

Actions:

1. Inspect the accepted ADR and relevant active decisions.
2. Follow `aif-plan full` planning semantics.
3. Create the plan in `paths.plans` (resolved from `.ai-factory/config.yaml`), respecting the project's plan filename format (including sequential numbering when configured).
4. Add plan metadata:

```yaml
---
id: plan-adr-short-stable-name
type: plan
status: in_progress
owners: [maintainer]
depends_on:
  - adr-short-stable-name
implements:
  - adr-short-stable-name
---
```

5. Set the ADR frontmatter `plan:` field to the plan artifact ID:

```yaml
plan: plan-adr-short-stable-name
```

The plan id is **not** added to `affects` — that relation is reserved for genuinely affected artifacts, so the built-in `audit-artifacts` warning "Accepted ADR without `affects` links" is expected (and acceptable) while `affects` is honestly empty. `evidence:` stays empty until finalize — a filled `plan:` with empty `evidence:` *is* the pending state.

6. Run artifact auditing.
7. Leave the ADR in `accepted`.

The implementation plan is a separate artifact and remains in the AI Factory plans directory.

### 19.5 `aif-adr-implement @adr-file`

Purpose: start or continue implementation from the accepted ADR.

Preconditions:

- ADR status is `accepted`;
- ADR is not superseded;
- exactly one non-archived plan implements it (resolved via `implements` frontmatter);
- reciprocal ADR↔plan links are valid.

Actions:

1. Resolve the plan by artifact metadata (`ai-factory adr resolve-plan`), never by filename guessing.
2. Validate reciprocal ADR-plan links.
3. Follow `aif-implement` semantics against the resolved plan.
4. Keep the ADR in `accepted`.
5. Do not activate the ADR merely because implementation work completed.
6. Report the plan used.

### 19.6 `aif-adr-finalize @adr-file`

Purpose: verify implementation and activate the decision.

Preconditions:

- ADR status is `accepted`;
- the ADR is not superseded;
- a linked plan exists, or the ADR explicitly states that no implementation is required.

For a plan-backed ADR:

1. Resolve the linked plan.
2. Ensure verification targets the correct plan unambiguously.
3. Follow strict `aif-verify` semantics.
4. Require a non-blocking pass.
5. Verify that implementation matches the ADR Decision.
6. Check known Consequences and risks where testable.
7. Record implementation evidence in the ADR.
8. Change status to `active` and move the ADR atomically to `docs/adr/active`.
9. Archive the completed plan following `aif-archive` semantics: move it to `paths.archive/plans/`, preserve its filename, set plan `status: done`, add `archived: YYYY-MM-DD` to its frontmatter.
10. Run artifact auditing.
11. Post-MVP only: trigger optional memory synchronization when Phase 5 is implemented.

Example evidence (frontmatter; `evidence:` is a short string — detailed notes stay as prose in the body, entry points go in `code:`, the tracker link in `issue:`):

```yaml
plan: plan-adr-logic-view-boundary
evidence: implemented, commit abc1234, verified by build+tests+lint
code: [src/logic/index.js, src/view/index.js, src/bridge/index.js]
```

For a documentation-only ADR (`plan:` stays empty):

```yaml
evidence: documentation-only
```

Such an ADR may become active without a plan after validation.

If implementation contradicts the accepted Decision, finalization must fail. The skill must recommend returning the ADR to draft through `aif-adr-refine` rather than silently rewriting it.

### 19.7 `aif-adr-supersede @old-adr @new-adr`

Purpose: replace an accepted or active decision while preserving history.

Preconditions:

- old ADR status is `accepted` or `active`;
- new ADR exists;
- new ADR status is `accepted` or `active`;
- IDs are different;
- the new ADR clearly replaces the old decision.

Actions:

1. Add to the new ADR:

```yaml
supersedes:
  - adr-old-decision
```

2. Add to the old ADR's frontmatter:

```yaml
replaced_by: adr-new-decision
```

3. Set the old ADR status to `superseded`.
4. Move the old ADR atomically to `docs/adr/superseded`.
5. If the old ADR has a non-archived plan, require explicit user choice: archive it with a superseded note, or delete it.
6. Validate reciprocal relationships.
7. Run artifact auditing.
8. Post-MVP only: trigger optional memory synchronization when Phase 5 is implemented.

The old ADR must not be superseded before the replacement is accepted.

### 19.8 `aif-adr-status [@adr-file]`

Purpose: provide a read-only overview and diagnose invalid states. Wraps `ai-factory adr status`.

Without an argument, report:

- proposals;
- drafts;
- accepted ADRs without plans;
- accepted ADRs with active plans;
- active ADRs;
- superseded ADRs;
- status-directory mismatches;
- multiple non-archived plans for one ADR;

In `--check` mode, the strict artifact audit additionally reports duplicate IDs and broken artifact references. Optional-memory index diagnostics are post-MVP.

With one ADR file, report:

- ID;
- status;
- lifecycle location;
- linked active plan;
- archived plan references;
- implementation evidence;
- dependencies;
- affected artifacts;
- superseding and replacement relationships;
- validation errors and warnings.

---

## 20. Deterministic Lifecycle Helper

Skills must not independently perform raw status edits, file moves, and relationship changes. All state transitions go through the helper, exposed as `ai-factory adr …` commands (Section 8) registered via the extension `commands` manifest field.

Responsibilities:

- parse YAML frontmatter;
- validate IDs;
- validate statuses;
- enforce legal transitions;
- enforce directory-status correspondence;
- prevent duplicate IDs;
- resolve plans by `implements` metadata;
- create reciprocal artifact links;
- move files atomically (status edit + move as one operation with rollback on failure);
- prevent target-path collisions;
- update references after moves (frontmatter references are id-based, so moves do not invalidate them);
- invoke `ai-factory audit-artifacts` (passing the ADR root explicitly when it is outside default discovery);
- post-MVP only, call the configured optional memory adapter;
- produce machine-readable (`--json`) and human-readable results.

The helper must not make architectural choices. It enforces decisions already made by the user and agent workflow.

---

## 21. Validation Invariants

The system must enforce:

1. Every ADR has a unique stable `id` (unique across all project artifacts).
2. ADR `type` is `adr`.
3. ADR filename stem matches the ADR ID.
4. Directory matches frontmatter status.
5. Every ADR contains one primary decision.
6. Accepted and active ADRs contain no unresolved placeholders.
7. An accepted ADR has at most one non-archived implementation plan.
8. A plan implementing an ADR contains the ADR ID in `implements`.
9. The ADR links back to its plan (frontmatter `plan:` field).
10. An active ADR contains implementation evidence or explicitly states that implementation is not required.
11. A superseded ADR references its replacement.
12. The replacement ADR references the superseded ADR in `supersedes`.
13. Active ADRs are not materially rewritten in place.
14. An external index never becomes authoritative.
15. A failed filesystem transition leaves no partial state.
16. Post-MVP: a failed optional memory synchronization does not corrupt Markdown state.
17. A superseded ADR has no plan that still resolves as active.

---

## 22. Artifact Audit Integration

Auditing uses the real AI Factory command:

```bash
ai-factory audit-artifacts <adr-root> .ai-factory
ai-factory audit-artifacts --strict --json   # CI
```

Notes:

- default discovery scans `.ai-factory`, `docs`, `README.md`, `AGENTS.md`; with the default ADR root `docs/adr` no extra path is needed, but the helper must pass a relocated ADR root explicitly;
- `audit-artifacts` already fails on duplicate IDs, unknown relation targets, self-references, and `depends_on` cycles, and already warns on accepted ADRs without `affects` links — the extension must not reimplement these checks, only ADR-specific ones (directory-status correspondence, transition legality, placeholder detection, plan uniqueness).

Auditing must run:

- before accepting an ADR;
- after creating or linking a plan;
- before finalizing an ADR;
- after superseding an ADR;
- during `aif-adr-status`;
- optionally in CI (`ai-factory adr status --check`).

Blocking errors include:

- duplicate IDs;
- missing referenced artifacts;
- multiple non-archived plans implementing one ADR;
- invalid status transitions;
- directory-status mismatch;
- broken superseding relationships.

Non-blocking warnings may include:

- missing optional code links;
- missing issue links;
- unindexed accepted ADRs when Cognee is enabled;
- outdated implementation evidence.

---

## 23. Source of Truth and Retrieval Policy

The source of truth is always:

```text
Markdown ADR files in Git
```

AI runtimes must apply the following retrieval order:

1. read active ADRs;
2. consider accepted ADRs as pending decisions;
3. use superseded ADRs only for historical reasoning;
4. never treat proposals or drafts as active rules;
5. after semantic retrieval, open the original Markdown file;
6. resolve contradictions in favor of authoritative files and lifecycle status.

---

## 24. Optional Cognee Integration (Post-MVP)

Cognee integration is disabled by default.

Architecture note: Cognee is a Python-based memory platform. The Node adapter integrates through one of:

- the official `@cognee/cognee-ts` client against a running Cognee server / hosted API (adapter default);
- the `cognee-mcp` MCP server, which the extension may register for agents through the manifest `mcpServers` template (agent-side retrieval only; the lifecycle helper still uses the client for sync).

The adapter must treat Cognee as an external service that may be unavailable, never as an embedded library.

Configuration (`.ai-factory/adr-extension.yaml`):

```yaml
adr:
  memory:
    provider: none
```

Enabled:

```yaml
adr:
  memory:
    provider: cognee
    dataset: project-decisions
```

Connection credentials (API URL, keys) come from environment variables, never from the config file or generated skill files.

Indexed statuses: `accepted`, `active`, `superseded`. Not indexed: `proposed`, `draft`.

Retrieval priority: `active → accepted → superseded`.

### Planned synchronization strategy

For a small ADR corpus, the Cognee adapter performs a complete dataset rebuild:

1. clear or recreate the configured ADR dataset;
2. read authoritative ADR files;
3. ingest accepted, active, and superseded ADRs;
4. attach ADR ID, status, source path, and project metadata.

A per-document synchronization database is not required in the planned first memory release.

Cognee failures:

- do not roll back a valid Git transition;
- produce a warning;
- mark the derived index as stale (`.ai-factory/adr-extension-state.json`);
- can be repaired through `ai-factory adr sync`.

The agent must open the source Markdown ADR before making a final architectural claim based on retrieved memory.

---

## 25. Optional Code-Intelligence Integration (Post-MVP)

Code intelligence is not required for lifecycle operations.

Supported provider abstraction:

```text
none
codegraph
codebase-memory-mcp
```

Only one code-intelligence provider may be active at a time.

It may enrich:

- duplicate-decision analysis;
- proposal context;
- ADR refinement;
- impact estimation;
- implementation planning;
- final verification;
- superseding analysis.

It may provide:

- symbol relationships;
- dependency paths;
- call graphs;
- affected modules;
- implementation evidence;
- semantic code search.

It must not:

- own authoritative ADR data;
- change ADR lifecycle status;
- supersede an ADR;
- replace Markdown files;
- automatically approve a decision.

When `codebase-memory-mcp` is configured, its internal ADR CRUD capability (`manage_adr`) must not be used as the project's primary ADR store.

---

## 26. Configuration

Extension configuration file: `.ai-factory/adr-extension.yaml`

```yaml
version: 1

adr:
  root: docs/adr

  lifecycle:
    requireAlternatives: true
    requireNegativeConsequences: true
    allowDocumentationOnly: true

  memory:
    provider: none

  codeIntelligence:
    provider: none
```

Rules:

- plan and archive locations are **not** duplicated here; the helper reads `paths.plans` and `paths.archive` from `.ai-factory/config.yaml` (with the documented defaults `.ai-factory/plans/` and `.ai-factory/archive/plans/` when absent);
- the file is created with defaults on first use and never overwritten by updates; schema migrations are keyed by `version`;
- secrets never appear in this file;
- the extension never writes to `.ai-factory/config.yaml` (owned by `/aif`).

---

## 27. Error Handling

A lifecycle operation must fail safely when:

- the file does not exist;
- frontmatter cannot be parsed;
- the ID is missing or duplicated;
- filename and ID disagree;
- status and directory disagree;
- the requested transition is illegal;
- the target file already exists;
- a linked plan is missing;
- more than one non-archived plan implements the ADR;
- plan metadata does not reference the ADR;
- artifact audit fails;
- strict verification reports blockers;
- the replacement ADR is not accepted;
- implementation contradicts the Decision;
- the project is not initialized by AI Factory.

No partial move, status update, or relationship edit may remain after failure.

Memory synchronization errors are non-blocking because the memory index is derived data.

Errors must explain:

- what was expected;
- what was detected;
- which files were not changed;
- the next corrective action.

---

## 28. Security and Safety Requirements

The lifecycle helper must:

- operate only inside the project (reject paths resolving outside it);
- normalize and validate file paths;
- reject path traversal;
- never execute arbitrary content from ADR files;
- avoid shell interpolation with untrusted filenames (invoke `audit-artifacts` and adapters through APIs or argument arrays, never string-built shells);
- write files atomically;
- avoid deleting user ADR documents;
- avoid storing secrets in configuration or state files;
- keep external provider credentials in environment variables, outside generated skill files.

Installation-time safety (path validation, ownership conflicts, safe relative paths) is enforced by the AI Factory extension system and is not re-implemented here.

---

## 29. Compatibility Requirements

The `extension.json` schema has no compatibility-range field, so compatibility is enforced at runtime:

- the package declares the supported AI Factory range in its own metadata, e.g. `package.json → "aiFactoryCompatibility": ">=2.0.0 <3.0.0"`;
- every `ai-factory adr` command verifies the detected AI Factory version / project schema (`.ai-factory.json`) on startup: warn on unknown, stop with a clear error on known-incompatible;
- extension configuration changes ship with migrations keyed by the config `version` field;
- skill content avoids depending on undocumented AI Factory internals; it references only documented skills, paths, and the artifact schema.

---

## 30. Testing Requirements

### 30.1 Unit tests

Cover:

- frontmatter parsing;
- ID generation;
- filename validation;
- transition validation;
- directory mapping;
- reciprocal links;
- plan resolution via `implements` (including sequential-prefixed filenames);
- duplicate detection;
- atomic move rollback;
- configuration creation and migration;
- AI Factory `config.yaml` readback with and without `paths.*` overrides.

### 30.2 Integration tests

Cover:

- `ai-factory extension add` from a local directory into an initialized fixture project;
- skills installed for Claude Code, for Codex CLI, and for both;
- `ai-factory adr` commands registered and runnable;
- repeated installation (no duplicates);
- `ai-factory extension update` preserving ADRs, plans, and user config;
- `ai-factory extension remove` deleting extension files but not ADR documents;
- complete ADR lifecycle end to end;
- failed verification leaving the ADR `accepted`;
- plan archival on finalize;
- superseding an active ADR (including one with a non-archived plan);
- optional Cognee failure marked stale without corrupting Markdown;
- `ai-factory adr status --check` exit codes for CI.

### 30.3 Fixture projects

Maintain fixture projects representing:

- AI Factory with Claude Code only;
- AI Factory with Codex CLI only;
- AI Factory with both;
- an existing extension installation;
- a project with relocated `paths.plans` and sequential plan numbering;
- a non-initialized project (no `.ai-factory.json`);
- corrupted ADR metadata.

---

## 31. Acceptance Criteria

The MVP is complete when all of the following are true.

### Package and installation

1. `ai-factory-adr-extension` is publishable to npm with valid `extension.json` and `package.json`.
2. `ai-factory extension add ai-factory-adr-extension` installs it into an initialized project.
3. All nine ADR skills are installed for every configured runtime, beside existing AI Factory skills.
4. `ai-factory adr` commands are registered and runnable after installation.
5. Running `ai-factory adr` commands in a non-initialized project produces a clear actionable error.
6. Lifecycle behavior is identical across runtimes (single shared skill source; AI Factory performs runtime conversion).
7. Re-adding the extension does not create duplicates.
8. `ai-factory extension update` does not delete ADR documents or user configuration.
9. `ai-factory extension remove` removes extension files but never ADR documents or plans.
10. First use (or `ai-factory adr init`) creates the ADR directory structure and default configuration.

### ADR lifecycle

11. A proposal can be created through `aif-adr-propose`.
12. First refinement moves the proposal to drafts.
13. A valid draft can be accepted.
14. An invalid draft cannot be accepted.
15. A linked implementation plan can be generated into `paths.plans`.
16. Plan metadata references the ADR through `implements`.
17. ADR metadata references the plan through the frontmatter `plan:` field.
18. Implementation can be started from the ADR alone (plan resolved via metadata).
19. Finalization performs strict verification.
20. Successful finalization activates the ADR and archives the plan (`status: done`, `archived:` date, moved to `paths.archive/plans/`).
21. Failed verification leaves the ADR accepted.
22. A documentation-only ADR can become active without a plan.
23. An active ADR can be superseded by an accepted replacement.
24. Old and new ADRs contain reciprocal replacement relationships.
25. Superseding an ADR with a non-archived plan requires explicit plan disposition.
26. Status-directory mismatches are detected.
27. Duplicate IDs are rejected (via `audit-artifacts`).
28. Multiple non-archived plans for one ADR are rejected.
29. Failed transitions leave no partial filesystem state.
30. `ai-factory adr status --check` returns a non-zero exit code on blocking errors.

### Post-MVP optional integrations (not required for MVP completion)

31. The complete lifecycle works with no memory provider.
32. Cognee can be enabled without changing lifecycle semantics.
33. Cognee indexes only accepted, active, and superseded ADRs.
34. Cognee failure does not damage authoritative files and marks the index stale.
35. One optional code-intelligence provider can enrich analysis.
36. Code-intelligence tools cannot change lifecycle state.

---

## 32. Implementation Phases

### Phase 0 — Extension packaging foundation

- npm package with `extension.json` + `package.json` (`"type": "module"`);
- schema validation against `schemas/extension.schema.json`;
- `commands/adr.js` skeleton registering `ai-factory adr` with a working `init`;
- AI Factory project detection and version compatibility check;
- fixture projects and `extension add / update / remove` integration tests.

### Phase 1 — Core ADR lifecycle

- ADR template;
- directory initialization;
- YAML parsing;
- stable IDs;
- validation rules;
- atomic file transitions;
- deterministic lifecycle helper (all `ai-factory adr` subcommands);
- plan resolution via `implements`;
- `audit-artifacts` invocation;
- lifecycle tests.

### Phase 2 — ADR skills

- `aif-adr-propose`;
- `aif-adr-refine`;
- `aif-adr-accept`;
- `aif-adr-status`;
- verification that AI Factory installs them correctly for Claude Code and Codex CLI (including `$aif-*` invocation form).

### Phase 3 — AI Factory plan integration

- `aif-adr-plan`;
- `aif-adr-implement`;
- `aif-adr-finalize`;
- reciprocal links;
- strict verification integration;
- plan archival (`status: done`, `archived:` frontmatter).

### Phase 4 — Superseding workflow

- `aif-adr-supersede`;
- reciprocal replacement links;
- orphaned-plan disposition;
- active-decision protection;
- historical retrieval behavior.

### Phase 5 — Optional memory (deferred post-MVP)

- memory provider interface;
- no-op provider;
- Cognee provider (`@cognee/cognee-ts` client; optional `cognee-mcp` manifest template);
- full dataset rebuild (`ai-factory adr sync`);
- stale-index reporting;
- source-file readback rule.

### Phase 6 — Optional code intelligence (deferred post-MVP)

- provider interface;
- CodeGraph adapter or `codebase-memory-mcp` adapter;
- impact-analysis enrichment;
- verification enrichment.

The first usable release should target Phases 0–4. External memory and code-intelligence integrations must not block the release.

---

## 33. Quick Usage Guide

Invocations below use Claude Code slash syntax; Codex runtimes use `$aif-adr-*` instead of `/aif-adr-*`.

### 33.1 Initialize the project

```bash
npm install -g ai-factory
ai-factory init
ai-factory extension add ai-factory-adr-extension
```

### 33.2 Create a proposal

```text
/aif-adr-propose Separate game logic from BabylonJS presentation
```

Result:

```text
docs/adr/proposals/adr-logic-view-boundary.md
```

### 33.3 Refine the decision

```text
/aif-adr-refine @docs/adr/proposals/adr-logic-view-boundary.md
```

After the first successful refinement:

```text
docs/adr/proposals/adr-logic-view-boundary.md
→
docs/adr/drafts/adr-logic-view-boundary.md
```

The command may be repeated while the ADR remains a draft.

### 33.4 Accept the ADR

```text
/aif-adr-accept @docs/adr/drafts/adr-logic-view-boundary.md
```

Result:

```text
docs/adr/accepted/adr-logic-view-boundary.md
```

### 33.5 Create a plan

```text
/aif-adr-plan @docs/adr/accepted/adr-logic-view-boundary.md
```

Result (default layout; sequential numbering may prefix the filename):

```text
.ai-factory/plans/adr-logic-view-boundary-plan.md
```

### 33.6 Implement the plan

```text
/aif-adr-implement @docs/adr/accepted/adr-logic-view-boundary.md
```

The skill resolves the linked plan automatically through `implements` metadata.

### 33.7 Finalize and activate

```text
/aif-adr-finalize @docs/adr/accepted/adr-logic-view-boundary.md
```

On successful verification:

```text
docs/adr/accepted/adr-logic-view-boundary.md
→
docs/adr/active/adr-logic-view-boundary.md
```

The completed plan is archived to `.ai-factory/archive/plans/`.

### 33.8 Supersede an old decision

Create and accept the replacement ADR, then run:

```text
/aif-adr-supersede \
  @docs/adr/active/adr-old-decision.md \
  @docs/adr/accepted/adr-new-decision.md
```

The old ADR moves to `docs/adr/superseded`.

### 33.9 Inspect status

```text
/aif-adr-status
```

Or:

```text
/aif-adr-status @docs/adr/active/adr-logic-view-boundary.md
```

Or in CI:

```bash
ai-factory adr status --check
```

---

## 34. When to Create an ADR

Create an ADR when a decision:

- affects multiple project areas;
- establishes an architectural boundary;
- is expensive to reverse;
- introduces a framework, pattern, protocol, or dependency;
- prohibits a previously possible approach;
- has meaningful trade-offs;
- is likely to be questioned again later;
- changes how future agents should reason about the project.

Do not create an ADR for:

- a small local refactor;
- a rename;
- a straightforward function implementation;
- a temporary experiment;
- an ordinary bug fix;
- a task with no meaningful alternative;
- implementation details already fully determined by an active ADR.

---

## 35. Final Product Decision

The first release should consist of:

```text
AI Factory
+
ai-factory-adr-extension (installed via `ai-factory extension add`)
+
Markdown ADRs in Git
```

Required components:

- npm package with `extension.json` + `package.json`;
- nine ADR skills (overview plus eight lifecycle skills) in Agent Skills format;
- `ai-factory adr` lifecycle commands (Commander.js command module);
- ADR template;
- validation built on the AI Factory artifact schema and `audit-artifacts`;
- plan creation, implementation, verification, and archival integration.

Cognee and code-intelligence tools remain deferred post-MVP adapters and are not part of the current release.
