# Implementation Backlog — `ai-factory-adr-extension`

Derived from [`ai-factory-adr-extension-PRD.md`](./ai-factory-adr-extension-PRD.md). Section refs (`§`) point to the PRD; `Acc N` = PRD §31 acceptance criterion N; tests = PRD §30.

**Scope:** MVP = Phases 0–4. Phases 5–6 (Cognee, code-intelligence) are deferred and must not block release (§32, §35).

---

## Verified against real `ai-factory@2.17.0`

| PRD claim | Reality | Status |
|---|---|---|
| Extension system add/list/update/remove | `dist/cli/commands/extension.js` | ✅ |
| `extension.schema.json` (`skills`, `commands`, `mcpServers`, `injections`, `agents`) | present | ✅ |
| Command module exports `register(program)` | `dist/cli/index.js:74` | ✅ |
| `audit-artifacts [paths...]` `{strict, json}` | `auditArtifactsCommand(paths, opts)` | ✅ |
| Skill = dir + `SKILL.md` (`name`, `description`) | confirmed | ✅ |
| Artifact statuses / relations (`accepted`, type `adr`, `depends_on`/`affects`/`implements`/`supersedes`/`verifies`) | present in audit code | ✅ |
| **§6.2 `"commands": ["commands/adr.js"]`** | schema needs **objects** | ❌ see fix below |

### Correction to bake in (P0.1)
```json
"commands": [{ "name": "adr", "description": "ADR lifecycle", "module": "commands/adr.js" }]
```
`register(program)` interface itself is correct (§8/§20).

### Stack defaults
- ESM: `package.json → "type": "module"`
- `commander ^12` (match AIF), `ajv ^8` (match AIF — reuse for P0.2 schema validation), `yaml` for frontmatter
- Test runner: `node:test`
- `package.json → "aiFactoryCompatibility": ">=2.0.0 <3.0.0"` (§29)
- Reads `paths.plans`/`paths.archive` from `.ai-factory/config.yaml`; defaults `.ai-factory/plans/`, `.ai-factory/archive/plans/` when absent. **Never** duplicate these in extension config (§26).

---

## STEP 0 — Verification spike ✅ DONE (all assumptions passed against `ai-factory@2.17.0`)
Ran throwaway extension (`extension.json` corrected shape + 2 skills + `commands/adr.js`) into a fixture project (`ai-factory init --agents claude,codex --no-skills --config`). Confirmed:
- ✅ skills install into **both** runtimes (`.claude/skills/`, `.codex/skills/`);
- ✅ Codex conversion done by AIF — skill body `/aif-adr-propose` → `$aif-adr-propose` on disk;
- ✅ `commands` objects + `register(program)` → `ai-factory adr init` registered and runnable; `adr --help` lists subcommands;
- ✅ re-add → **no duplicates** (single ext entry, skills not doubled);
- ✅ `extension remove` deletes skills but **preserves** user ADR docs (`docs/adr/active/adr-test.md` survived);
- ✅ live `config.yaml`: `paths.plans: .ai-factory/plans/`, `paths.archive: .ai-factory/archive/`, `workflow.plan_id_format: slug` (sequential opt-in) — matches §26/§15;
- ✅ artifact statuses/relations (`accepted`, type `adr`, `implements`/`affects`/`supersedes`) present in installed audit code.

**No backlog revisions required.**

---

## Epic P0 — Packaging foundation  (Acc 1–10) ✅ DONE

Verified end-to-end against real `ai-factory@2.17.0`; 15/15 tests green (10 unit + 5 integration).

| ID | Task | Refs | Test | Status |
|---|---|---|---|---|
| P0.1 | `package.json` (`type:module`, `aiFactoryCompatibility`) + `extension.json` (8 skill paths, **corrected** `commands` objects) | §6.1–6.2 | Acc 1 | ✅ |
| P0.2 | Validate `extension.json` against `schemas/extension.schema.json` (ajv) | §6.2 | unit | ✅ |
| P0.3 | `commands/adr.js` → `register(program)` adds `adr` command with working `adr init` (idempotent, reports created/skipped) | §7, §8 | Acc 4,10 | ✅ |
| P0.4 | AIF project detection + version-compat gate: read `.ai-factory.json`, warn-unknown / stop-incompatible; actionable error when non-initialized | §7, §29 | Acc 5 | ✅ |
| P0.5 | Fixture projects + `extension add/update/remove` integration tests: skills per runtime, no dupes, update preserves ADRs/config, remove keeps ADRs | §30.2–30.3 | Acc 2,3,6,7,8,9 | ✅ |

Fixtures (§30.3): Claude-only, Codex-only, both, existing-install, relocated `paths.plans`+sequential, non-initialized, corrupted-metadata.

**Delivered:** `package.json`, `extension.json`, vendored `schemas/extension.schema.json`, `commands/adr.js`, `src/aif/detect.js`, `src/config/{paths,adrConfig}.js`, `src/init.js`, 8 placeholder `skills/aif-adr-*/SKILL.md` (bodies → P2–P4), unit suites (`test/{extension-manifest,init,detect}.test.js`) + integration suite (`test/integration/extension-lifecycle.test.js`, skips when `ai-factory` absent).

**Notes for later epics:** fixtures generated live via `ai-factory init` in the integration suite, not committed dirs. Edge fixtures (non-initialized, corrupted-metadata, relocated root) covered by unit tests (`detect`/`init`), not standalone projects — add committed fixtures if P1+ needs them. `commander` is a devDependency (runtime `program` comes from AIF). Version gate uses a minimal `>=X <Y` parser — swap for `semver` if ranges get richer.

---

## Epic P1 — Core ADR lifecycle  (Acc 10; invariants §21)

| ID | Task | Refs | Test |
|---|---|---|---|
| P1.1 | `templates/adr.md` | §16 | — |
| P1.2 | Config: create/read `.ai-factory/adr-extension.yaml` defaults + `version` migration; readback `config.yaml` `paths.plans`/`paths.archive` (+ defaults) | §26 | §30.1 |
| P1.3 | Frontmatter parse; stable ID gen; filename-stem == id | §15 | inv 1–3 |
| P1.4 | Directory ↔ status map + validation | §14 | inv 4 |
| P1.5 | Transition-legality table + atomic move w/ rollback + target-collision guard | §17, §20 | inv 15 |
| P1.6 | Plan resolution via `implements` frontmatter, incl. `NNNN_` sequential filenames (never filename-match) | §15 | inv 7,8 |
| P1.7 | All `adr` subcommands: `init validate transition resolve-plan link-plan finalize supersede status status --check` | §8 | Acc 30 |
| P1.8 | `audit-artifacts` invocation via arg array; pass ADR root explicitly when relocated | §22, §28 | inv 14 |
| P1.9 | Path safety: reject traversal/outside-project; atomic writes; no shell interpolation | §28 | unit |
| P1.10 | Lifecycle unit tests covering all §21 invariants (1–17) | §21, §30.1 | — |

---

## Epic P2 — ADR skills, wave 1  (Acc 11–14, 26, 27)

| ID | Task | Refs |
|---|---|---|
| P2.1 | `skills/aif-adr-propose/SKILL.md` — dup/conflict scan, gen ID, create `proposals/`, `status: proposed` | §19.1 |
| P2.2 | `skills/aif-adr-refine/SKILL.md` — proposed→draft on first refine; ADR-specific criteria (not `aif-improve`) | §19.2 |
| P2.3 | `skills/aif-adr-accept/SKILL.md` — preconditions, audit, draft→accepted atomic move | §19.3 |
| P2.4 | `skills/aif-adr-status/SKILL.md` — wraps `adr status` | §19.8 |
| P2.5 | Integration: installed + runnable for Claude and Codex (`$aif-*`) | §30.2 |

Skill body rule: show slash form, note Codex `$` form; no nested-skill-call assumptions (§6.5, §9).

---

## Epic P3 — Plan integration  (Acc 15–22)

| ID | Task | Refs |
|---|---|---|
| P3.1 | `aif-adr-plan` — create plan in `paths.plans`; reciprocal `implements`(plan)/`affects`(ADR) links + ADR Implementation section; audit | §19.4 |
| P3.2 | `aif-adr-implement` — resolve plan by metadata; validate reciprocal links; keep ADR `accepted` | §19.5 |
| P3.3 | `aif-adr-finalize` — strict `aif-verify`; pass → activate ADR + archive plan (`status: done`, `archived: DATE`, → `paths.archive/plans/`); fail → leave `accepted`; contradiction → recommend refine, never silent rewrite | §19.6 |
| P3.4 | Documentation-only ADR path → active without plan | §19.6 |

Acceptance: 15,16,17 (P3.1); 18 (P3.2); 19,20,21 (P3.3); 22 (P3.4).

---

## Epic P4 — Superseding  (Acc 23–25)

| ID | Task | Refs |
|---|---|---|
| P4.1 | `aif-adr-supersede` — reciprocal `supersedes` + `Replaced by` links w/ correct relative paths; old→`superseded` atomic move; audit | §19.7 |
| P4.2 | Orphaned non-archived-plan disposition: explicit user choice archive-with-note \| delete | §17, inv 17 |
| P4.3 | Active-decision protection + historical retrieval order | §18.3, §23 |

Precondition guard: old is `accepted`/`active`, new is `accepted`/`active`, IDs differ, replacement accepted first.

---

## Cross-cutting (thread through all epics)

- **Error contract (§27):** every failure states expected / detected / files-untouched / next action; no partial move/edit remains.
- **CI:** `ai-factory adr status --check` → non-zero on blocking errors (Acc 30).
- **Source of truth:** Markdown-in-Git only; external index never authoritative (inv 14).

---

## Deferred (post-MVP — do NOT block release)

- **Phase 5 — Optional memory (Cognee):** provider iface, no-op provider, `@cognee/cognee-ts` client + optional `cognee-mcp` manifest template, full dataset rebuild (`adr sync`), stale-index marker, source-readback rule. §24
- **Phase 6 — Optional code-intelligence:** provider iface, `codegraph` / `codebase-memory-mcp` adapter, impact + verification enrichment; must not own ADR data or change lifecycle state. §25

---

## Coverage check (run before calling backlog done)
- Every Acc 1–30 → ≥1 task above. ✔ mapped
- Every §19 skill (8) → a P2/P3/P4 task. ✔
- Every §21 invariant (1–17) → P1.10 / relevant task. ✔
