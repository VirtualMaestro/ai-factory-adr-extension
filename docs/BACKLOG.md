# Implementation Backlog — `ai-factory-adr-extension`

Derived from [`ai-factory-adr-extension-PRD.md`](./ai-factory-adr-extension-PRD.md). Section refs (`§`) point to the PRD; `Acc N` = PRD §31 acceptance criterion N; tests = PRD §30.

**Scope:** MVP = Phases 0–4. Phase 5 (Cognee) dropped — see Deferred section; Phase 6 (code-intelligence) deferred and must not block release (§32, §35).

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
| P0.1 | `package.json` (`type:module`, `aiFactoryCompatibility`) + `extension.json` (9 skill paths, **corrected** `commands` objects) | §6.1–6.2 | Acc 1 | ✅ |
| P0.2 | Validate `extension.json` against `schemas/extension.schema.json` (ajv) | §6.2 | unit | ✅ |
| P0.3 | `commands/adr.js` → `register(program)` adds `adr` command with working `adr init` (idempotent, reports created/skipped) | §7, §8 | Acc 4,10 | ✅ |
| P0.4 | AIF project detection + version-compat gate: read `.ai-factory.json`, warn-unknown / stop-incompatible; actionable error when non-initialized | §7, §29 | Acc 5 | ✅ |
| P0.5 | Fixture projects + `extension add/update/remove` integration tests: skills per runtime, no dupes, update preserves ADRs/config, remove keeps ADRs | §30.2–30.3 | Acc 2,3,6,7,8,9 | ✅ |

Fixtures (§30.3): Claude-only, Codex-only, both, existing-install, relocated `paths.plans`+sequential, non-initialized, corrupted-metadata.

**Delivered:** `package.json`, `extension.json`, vendored `schemas/extension.schema.json`, `commands/adr.js`, `src/aif/detect.js`, `src/config/{paths,adrConfig}.js`, `src/init.js`, 8 placeholder `skills/aif-adr-*/SKILL.md` (bodies → P2–P4), unit suites (`test/{extension-manifest,init,detect}.test.js`) + integration suite (`test/integration/extension-lifecycle.test.js`, skips when `ai-factory` absent).

**Notes for later epics:** fixtures generated live via `ai-factory init` in the integration suite, not committed dirs. Edge fixtures (non-initialized, corrupted-metadata, relocated root) covered by unit tests (`detect`/`init`), not standalone projects — add committed fixtures if P1+ needs them. `commander` is a devDependency (runtime `program` comes from AIF). Version gate uses a minimal `>=X <Y` parser — swap for `semver` if ranges get richer.

---

## Epic P1 — Core ADR lifecycle  (Acc 10; invariants §21) ✅ DONE — 50/50 unit + 5/5 integration green; verified live against `ai-factory@2.17.0`

| ID | Task | Refs | Test | Status |
|---|---|---|---|---|
| P1.1 | `templates/adr.md` | §16 | — | ✅ |
| P1.2 | Config: create/read `.ai-factory/adr-extension.yaml` defaults + `version` migration; readback `config.yaml` `paths.plans`/`paths.archive` (+ defaults) | §26 | §30.1 | ✅ (P0 `adrConfig.js`/`paths.js`; migration key present, no migrations yet) |
| P1.3 | Frontmatter parse; stable ID gen; filename-stem == id | §15 | inv 1–3 | ✅ `artifacts/{frontmatter,id}.js` |
| P1.4 | Directory ↔ status map + validation | §14 | inv 4 | ✅ `lifecycle/status.js` |
| P1.5 | Transition-legality table + atomic move w/ rollback + target-collision guard | §17, §20 | inv 15 | ✅ `lifecycle/{transitions,move}.js` |
| P1.6 | Plan resolution via `implements` frontmatter, incl. `NNNN_` sequential filenames (never filename-match) | §15 | inv 7,8 | ✅ `artifacts/plan.js` |
| P1.7 | All `adr` subcommands: `init validate transition resolve-plan link-plan finalize supersede status status --check` | §8 | Acc 30 | ✅ `commands/adr.js` |
| P1.8 | `audit-artifacts` invocation via arg array; pass ADR root explicitly when relocated | §22, §28 | inv 14 | ✅ `audit.js` (arg-array + relocated root unit-tested; live `ai-factory audit-artifacts` → `PASS 0 fail/warn` via `status --check`) |
| P1.9 | Path safety: reject traversal/outside-project; atomic writes; no shell interpolation | §28 | unit | ✅ `util/safe-path.js` |
| P1.10 | Lifecycle unit tests covering all §21 invariants (1–17) | §21, §30.1 | — | ✅ `test/{frontmatter,id,lifecycle,plan-resolve,validate,flow,audit}.test.js` |

**Delivered:** `templates/adr.md`; `src/artifacts/{frontmatter,id,plan,links,placeholders}.js`; `src/lifecycle/{status,transitions,move,validate,finalize,supersede,archive}.js`; `src/{audit,status}.js`; `src/util/safe-path.js`; all `adr` subcommands wired in `commands/adr.js`; 7 new test suites (50/50 green). CLI driven end-to-end (`validate` → `transition` real move → `status`), exit 0.

**Boundary held:** P1 `finalize`/`supersede` commands do the deterministic file mechanics only. Agent orchestration (strict `aif-verify`, dup/conflict scans, refinement) lands as skills in P2–P4.

**Live verification (against `ai-factory@2.17.0`):** `extension add` (local) installs 9 skills + registers `adr`; `adr init` → 6 created; `validate` → Valid; `transition proposed→draft` real move; live `adr status --check` → `PASS, 0 fail 0 warn`; `status --check` exit 0 on clean, **exit 1** on a blocking error (inv 6 placeholder in an accepted ADR) → Acc 30 confirmed.

Invariants 12,13,16,17 are enforced by later epics/audit, not P1 unit coverage: 12 (reciprocal `supersedes`) via `supersede.js`+audit; 13 (no material in-place rewrite) is a skill/editing-rule concern (§18); 16 (memory-sync safety) is Phase 5; 17 (no active plan on superseded) via supersede plan-disposition.

---

## Epic P2 — ADR skills, wave 1  (Acc 11–14, 26, 27) ✅ DONE — 53/53 unit + 6/6 integration green; verified live against `ai-factory@2.17.0`

| ID | Task | Refs | Status |
|---|---|---|---|
| P2.0 | `adr new <topic>` deterministic proposal scaffold — `slugToId` + dup-id guard + template → `proposals/adr-<slug>.md` `status: proposed` (fills the `none>proposed` gap; skills wrap it, don't hand-write files) | §19.1, §6.5 | ✅ `src/artifacts/create.js` + `commands/adr.js` |
| P2.1 | `skills/aif-adr-propose/SKILL.md` — dup/conflict scan, `adr new` scaffold, `status: proposed` | §19.1 | ✅ |
| P2.2 | `skills/aif-adr-refine/SKILL.md` — proposed→draft on first refine; ADR-specific criteria (not `aif-improve`) | §19.2 | ✅ |
| P2.3 | `skills/aif-adr-accept/SKILL.md` — preconditions, audit, draft→accepted atomic move | §19.3 | ✅ |
| P2.4 | `skills/aif-adr-status/SKILL.md` — wraps `adr status` | §19.8 | ✅ |
| P2.5 | Integration: installed + runnable for Claude and Codex (`$aif-*`); propose→draft→accept e2e | §30.2 | ✅ |

Skill body rule: show slash form, note Codex `$` form; no nested-skill-call assumptions (§6.5, §9).

**Delivered:** `src/artifacts/create.js` (`createProposal`, reuses `slugToId`/`atomicWrite`/`resolveInside`/template); `adr new` subcommand in `commands/adr.js`; 4 authored skill bodies (`aif-adr-{propose,refine,accept,status}`); `test/create.test.js` (3 unit); extended `test/integration/extension-lifecycle.test.js` with a wave-1 lifecycle e2e (propose→draft→accept via real CLI, per-runtime skill install, `status --check` exit 0).

**Live verification (against `ai-factory@2.17.0`):** `adr new "test decision"` → `proposals/adr-test-decision.md` `status: proposed`; re-run → §27 dup-id error, no file written; `transition draft`→drafts/, `transition accepted`→accepted/; `adr status --json` → `acceptedNoPlan: [adr-test-decision]`, 0 issues; `adr status --check` exit 0. Skill bodies install for both runtimes, no `Placeholder` text.

**Note for later:** `adr new` fills only the topic-specific id; the Context/Decision authoring is the agent's job in propose/refine. Accepted ADRs must clear inv-6 sentinels (`not created`/`not implemented`) — an accepted-no-plan ADR uses non-sentinel Implementation text (e.g. `Plan: none`, `Evidence: pending`).

---

## Epic P3 — Plan integration  (Acc 15–22) ✅ DONE — 56/56 tests green (2 new wave-2 integration cases); verified live against `ai-factory@2.17.0`

Deterministic core was already built+tested in P0/P1 (`link-plan`, `finalize` plan-backed **and** doc-only, `resolve-plan` — all green in `test/flow.test.js`). So P3 = author 3 skill bodies + wave-2 integration coverage. No new `src/` code, no new CLI.

| ID | Task | Refs | Status |
|---|---|---|---|
| P3.1 | `aif-adr-plan` — create plan in `paths.plans`; reciprocal `implements`(plan)/`affects`(ADR) links + ADR Implementation section; audit | §19.4 | ✅ skill wraps `aif-plan full` + `adr link-plan` |
| P3.2 | `aif-adr-implement` — resolve plan by metadata; validate reciprocal links; keep ADR `accepted` | §19.5 | ✅ skill wraps `adr resolve-plan` + `aif-implement` |
| P3.3 | `aif-adr-finalize` — strict `aif-verify`; pass → activate ADR + archive plan (`status: done`, `archived: DATE`, → `paths.archive/plans/`); fail → leave `accepted`; contradiction → recommend refine, never silent rewrite | §19.6 | ✅ skill wraps strict `aif-verify` + `adr finalize` |
| P3.4 | Documentation-only ADR path → active without plan | §19.6 | ✅ branch in `aif-adr-finalize` skill (`finalize.js` `DOC_ONLY_RE`) |

Acceptance: 15,16,17 (P3.1); 18 (P3.2); 19,20,21 (P3.3); 22 (P3.4).

**Delivered:** authored bodies for `skills/aif-adr-{plan,implement,finalize}/SKILL.md` (stripped `(Placeholder…)`); 2 wave-2 e2e in `test/integration/extension-lifecycle.test.js` (plan→link→resolve→finalize→archive; doc-only→active, per-runtime skill install with no `Placeholder` text).

**Resolved PRD conflict:** §19.4's literal `- **Evidence:** not implemented` is a blocking inv-6 sentinel (`src/artifacts/placeholders.js`); `validate.js` flags it on accepted ADRs. Skills follow the P2 rule — accepted ADRs use a non-sentinel value (`pending`); `finalize` flips it to `implemented`.

**Note for later:** no new `src/` mechanics needed — plan creation belongs to AIF's `aif-plan` (extension only links), and reciprocal-link validation is covered by `resolve-plan` (implements side) + `audit-artifacts` (relation reciprocity). Add a dedicated validator only if a gap surfaces. Memory sync (§19.6 step 11) stays deferred to Phase 5.

---

## Epic P4 — Superseding  (Acc 23–25) ✅ DONE — 57/57 tests green (1 unit + wave-3 integration); verified live against `ai-factory@2.17.0`

Deterministic core (`supersede.js`, CLI `adr supersede`, `supersedeLink`, plan disposition, `validate.js` inv 11) was already built+tested in P1 (Acc 23/24/25 green in `test/flow.test.js`). So P4 = author 1 skill body + one small `src` note + wave-3 integration. No new CLI, no new lifecycle module (mirrors P3).

| ID | Task | Refs | Status |
|---|---|---|---|
| P4.1 | `aif-adr-supersede` — reciprocal `supersedes` + `Replaced by` links w/ correct relative paths; old→`superseded` atomic move; audit | §19.7 | ✅ skill wraps `adr supersede` + `status --check` |
| P4.2 | Orphaned non-archived-plan disposition: explicit user choice archive-with-note \| delete | §17, inv 17 | ✅ CLI `--archive-plan`/`--delete-plan`; archive now writes `archived_reason: superseded by <newId>` (§19.7 step 5) |
| P4.3 | Active-decision protection + historical retrieval order | §18.3, §23 | ✅ skill-body guidance (material-change→new ADR; active→accepted→superseded retrieval order) |

Precondition guard: old is `accepted`/`active`, new is `accepted`/`active`, IDs differ, replacement accepted first.

**Delivered:** authored `skills/aif-adr-supersede/SKILL.md` (stripped `(Placeholder…)`); `note` param added to `archivePlan` (`src/lifecycle/archive.js`, backward-compatible — finalize path unaffected), threaded from `supersede.js` on archive disposition; `test/flow.test.js` unit asserts `archived_reason`; wave-3 e2e in `test/integration/extension-lifecycle.test.js` (supersede via real CLI → old in `superseded/`, reciprocal links, plan archived-with-note, per-runtime skill install no `Placeholder`, `status --check` exit 0).

**Note for later:** inv 12 (reciprocal `supersedes`) stays owned by `audit-artifacts` (relation reciprocity), not P4 unit coverage — validate.js covers only inv 11 (superseded ADR names its replacement). Memory sync (§19.7 step 8) deferred to Phase 5.

---

## Cross-cutting (thread through all epics)

- **Error contract (§27):** every failure states expected / detected / files-untouched / next action; no partial move/edit remains.
- **CI:** `ai-factory adr status --check` → non-zero on blocking errors (Acc 30).
- **Source of truth:** Markdown-in-Git only; external index never authoritative (inv 14).

---

## Deferred (post-MVP — do NOT block release)

- **Phase 5 — Optional memory (Cognee): DROPPED (2026-07-14).** Spike below resolved it: Cognee requires an LLM at ingestion (`cognify` builds its graph by LLM extraction) + embedding model — service, cost, egress — while the agent baseline (frontmatter + `adr status` + grep) covers decision recall at solo-dev corpus size for free. `adr.memory.provider` config axis stays reserved (`none`); revisit at hundreds of ADRs / multi-repo. Decision of record: `docs/ADR_Proposal_Cognee_CodebaseMemory.md`. §24 stands as historical plan only.
- **Phase 6 — Optional code-intelligence:** provider iface, `codegraph` / `codebase-memory-mcp` adapter (two alternatives for the same enrichment), impact + verification enrichment; must not own ADR data or change lifecycle state. §25
- **Spike — Cognee vs codebase-memory-mcp overlap: RESOLVED (2026-07-14, lite run on two indexed repos).** Verdict: neither tool serves decision recall. codebase-memory-mcp's BM25/vector indexes cover code symbols only — decision-recall queries scored ~0 cosine or returned nothing; markdown sections are structural nodes (heading names) with unsearchable content; `manage_adr` is one fixed-section architecture summary per project (no per-decision records, no search). Cognee dropped on cost/complexity (LLM required at ingestion) vs a sufficient agent baseline (frontmatter + `adr status` + grep) at this corpus size. Full recall/precision comparison unnecessary — the decision rests on baseline sufficiency, not Cognee quality. Recorded in `docs/ADR_Proposal_Cognee_CodebaseMemory.md`.

---

## Coverage check (run before calling backlog done)
- Every Acc 1–30 → ≥1 task above. ✔ mapped
- Every §19 skill (8) → a P2/P3/P4 task. ✔
- Every §21 invariant (1–17) → P1.10 / relevant task. ✔
