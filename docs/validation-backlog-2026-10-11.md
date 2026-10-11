# Backlog validation — 2026-10-11

Operator request: finish the remaining items in order, autonomously. Main-repository
changes are committed separately by fix and feature; commit hashes below belong to
isolated scratch projects unless explicitly identified as main-repository commits.
No push, publication, paid service or source-corpus edit was performed.

## Phase 4 remaining live branches

| Scenario | Runtime / scratch | Result |
|---|---|---|
| Real ultra input | Codex / `adr-phase4-probe-codex` | Core `aif-plan ultra` produced an index and 2 phase files; `adr-auto-change` completed both tasks, 5 tests, independent checks and whole-bundle archive. Commit `4eee5b7`, 7 files. |
| Inline fallback | Codex / `adr-backlog-inline` | User configuration and multi-agent feature disabled. `greetUpper` completed with 13 tests and explicitly weaker inline verify/review, no agent invocations. Commit `cf6c3a0`, 7 files. |
| Configured exploratory | Claude / `adr-backlog-exploratory` | Local read-only exploratory agent exercised ordering, duplicates, empty input and separators. Initial latent ordering defect was reproduced and fixed during planning/implementation. Commit `2064918`, 9 tests. |
| Post-review fix loop | Claude / same scratch | Acceptance fixture injected `toLowerCase` after green tests. Verify, review and exploratory found the regression. Existing tests failed before the fix; round 2 passed 11 tests and independent checks. Commit `0e618cd`, 7 files. Exploratory ran once, matching its configured cap. |

The ultra plan deliberately verified an already implemented export and added missing
frozen-input coverage. Its delta was `none:` and apply was a no-op. An existing archived
full plan shares its stem; the run reported this ambiguity before and after archive.
The archive preserved all phase links. This does not prove an ambiguity-free corpus.

The first attempted inline probe still reported fresh reviewers; it is not the fallback
evidence. The confirmed rerun disabled user configuration and multi-agent support and
explicitly reported inline checks. The skill now requires an actual runtime invocation
and returned result before reporting a fresh subagent.

Two early prompt arguments containing quoted separators were truncated by Windows
argument handling. Their agents reported the interpretation; the confirmed inline and
fix-loop probes used quote-free requests. No claim depends on the truncated default.

## Live defect and regression

Early live apply accepted a summary of 3 sentences, after which `live check` rejected it.
The new regression test failed with “Missing expected rejection” on the unfixed code.
`summaryProblem` now supplies the same 2-sentence rule to delta validation and the checker.
Plan apply and ADR finalize reject the invalid delta before writing or staging.
The complete LIVE unit suite passes, including source preservation and no-staging checks.
A live CLI probe against the updated extension returned exit 1 and the 2-sentence error;
SHA-256 checks confirmed that the plan and LIVE file stayed unchanged, with nothing staged.

## Consistency on the other runtime

`npm run corpus` built `C:/Users/virtu/AppData/Local/Temp/adr-corpus-JJ2dZT` with
14 ADRs and no issues. After switching the consumer to Codex, a fresh session ran the
installed consistency skill without reading the fixture README or expected labels.
The answer sheet was opened by the scoring session only after the run finished.

Result: exactly the 3 labelled contradictions, 1 redundancy and 2 compatible shared-area
pairs, no extra pairs. The footer matched the table. Follow-ups protected active decisions
and named the accepted decision for refinement where applicable. Corpus files were not
changed. This is one cross-runtime smoke run, not a statistical precision estimate.

Evidence: `probe-consistency.log` and `adr-consistency-report.md` in that consumer.

## Plan profile

The packaged `task` profile describes an instructional docset page; its runnable example
and page relations do not describe a core implementation plan. The extension therefore
owns `plan`, without changing the CNL-P standard or checker.

The profile keeps core checkbox tasks and frontmatter, adds per-task files, change,
acceptance and verification, and uses `format: cnlp-plan` as its compatibility marker.
The explicit `adr format plan --check <file>` treats every issue as an error independent
of task progress. Existing unmarked plans retain their old format and lifecycle gates.

Claude ran `adr-plan`, `adr-plan-improve` and `adr-implement` against accepted
`adr-uppercase-greetings` in `adr-backlog-plan-profile`. Format checks passed after
creation, improvement, and implementation; reciprocal links and the ADR body survived.
The final plan has 2 completed tasks, 6 tests pass, and the ADR stays accepted with no
evidence or LIVE apply. No commit or finalization was requested in that probe.

The real CLI integration test checks a file path with spaces, JSON issues, invalid-body
exit 1, no writes, and invalid option combinations. The tarball includes the owned profile.

## Real corpus and code-intelligence

Read-only discovery found two existing independent project corpora:

- `game-design-expert-system`: 40 active ADRs, digest 2150 lines, no digest issues;
  all 40 bodies conform to the current ADR profile.
- `unity-dev-ai-ecs-workflow`: 2 accepted ADRs, digest 88 lines, no digest issues.

The large corpus exceeds the former unexercised 800-line ceiling. Source ADRs are clean at revision
`29da307a5f2554b6231bd4c826f846240b757bfb`; the smaller project already has staged ADR
edits and was used only for digest measurement, without editing or resetting them.

The cold Codex sweep completed: 780 unique unordered pairs, 292 candidates, 4 cleared
by scope, 488 non-candidates, and 288 reported pairs (2 contradictions, 286 shared areas).
Programmatic checks confirmed the table/footer counts, all 780 unique pair identities,
and all 40 source SHA-256 hashes against the coverage ledger. No source file changed.
The report and ledger are `adr-consistency-report.md` and `adr-consistency-coverage.json`
in the real-corpus scratch. These coverage counts are not independent correctness labels.

A fresh Claude reviewer assessed three topics without reading the first report. Its
initial outside-directory reads were refused, so that provisional report is excluded.
A local source snapshot allowed the rerun to read 8 ADRs in full: it confirmed the
revision-id persistence contradiction, cleared legacy-session retention by scope/timing,
and treated the commercial-performance pair as compatible rules with a rationale gap.
The snapshot has 40 active ADRs and 1 superseded ADR. The provisional review incorrectly
called all 41 active; direct JSON and source checks confirmed the original count of 40.

The disagreement exposed a judgment boundary: a contradictory explanation is not itself
an incompatible pair of binding obligations. The updated consistency workflow requires
a concrete same-scope case and records rationale/uncertain-scope gaps separately.
A fresh targeted Codex regression then read 8 ADRs in full and reported 7 pairs:
1 contradiction, 0 redundancies, 6 shared areas. It agrees with the independent reviewer
on the persisted revision-id conflict, records the commercial-boundary rationale gap
separately, and clears legacy retention by scope/timing. Its table and footer match.
The artifact is `targeted-consistency-regression-2026-10-11.md` in the scratch root.
This replaces the disputed verdict for the targeted topics; it does not independently
relabel the other 773 pairs or prove corpus-wide recall. Snapshot hashes remain unchanged.

An independent real corpus has no reviewed golden pair labels yet. A run can establish
coverage and grounded examples, but cannot establish recall or absence of false positives.
Obligations outside the declared digest blocks remain a semantic review limitation.

Optional code-intelligence is a shared agent contract with a `codebase-memory-mcp`
adapter, not an MCP transport in the CLI. It reads an explicit project id, bounds queries,
checks current source files and forbids graph ADR CRUD, indexing and lifecycle decisions.
The main harness prepared the scratch index separately, without persistent repo writes.
`none` makes no graph calls; unavailable tools or unsupported providers use source files.
`codegraph` remains reserved because no adapter/tool contract was validated for it.

Claude's first provider probe was denied MCP permission and correctly fell back. The
rerun explicitly allowed the five read-only tools: coverage, symbol search, file outline
and a call trace returned `greetUpper -> greet`. The fast index excluded the test file
and reported source metadata changes; the agent stated both and checked current files.
The verdict was implemented, 6 tests passed, and no graph ADR, indexing or lifecycle
write occurred. A Codex run with MCP configuration disabled reached the same verdict
using current files and explicitly reported the unavailable-provider fallback.

## Evidence locations

Scratch roots are under `C:/workspace/projects/AI/`. The runtime transcripts are
`probe-ultra.log`, `probe-inline-confirmed.log`, `probe-exploratory.log`,
`probe-fix-round.log`, `probe-plan-profile.log`, and `probe-intelligence*.log` in the
projects named above. The large corpus consumer is `adr-backlog-real-corpus`.

The runner is `C:/workspace/projects/AI/adr-backlog-probe-run.mjs`. It closes stdin,
captures transcripts to files and surfaces only completion metadata.

Final automated validation: `npm test` passed all 183 tests with none skipped, including
the real CLI and packed-install suite. Final skill clarifications passed all 6 format
and rubric checks. All 4 version fields are 4.8.0 and `git diff --check` passes.

## Regression coverage and completion boundary

The LIVE summary defect has automated regressions for plan apply and ADR finalize.
The malformed plan case failed before the fix; rejection preserves files and staging.
The fresh-reviewer reporting and false contradiction defects have fresh live regressions,
not automated agent-behavior tests. Format and rubric checks cover instruction structure only.

All requested implementation and available live branches are complete. Independent labels
for every real-corpus pair, including non-candidates, remain necessary to measure missed
contradictions. The targeted independent review validates its cases, not all 780 pairs.
No source-project ADR reconciliation, alternative graph provider, push or publication
forms part of this completion.
