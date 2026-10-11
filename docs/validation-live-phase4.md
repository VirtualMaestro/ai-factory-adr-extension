# LIVE.md phase 4 validation — 2026-10-11

Phase 3 is committed as `e2f3230`. Phase 4 accompanies this validation in its own commit for 4.7.0:
20 skills, no new runtime dependency or CLI command.

## Automated checks

- `npm test -- --test-reporter=tap`: **179 passed, 0 failed, 0 skipped**.
- The skill conforms to the CNL-P skill profile, cites the format by command, declares no
  `allowed-tools` and belongs to the no-rubric group.
- Manifest, README and both runtime installation/removal counts agree on 20 skills.
  Existing packed-install integration verifies that the package loads without installation-time dependencies.
- Package, manifest and both root lockfile version fields agree on **4.7.0**.
- `git diff --check` passed.

## Full live runs

Both scratch consumers were initialized with `ai-factory init --agents "claude,codex" --config`,
installed this checkout, initialized Git and opted in with `adr live init`.
Their baseline code was a dependency-free ESM greeting library and one node:test case.
`npm test` and `adr.acceptance.command` used the same deterministic suite, with test isolation
disabled to avoid Windows nested-sandbox spawn restrictions. Push was disabled; no remote existed.

The topic added `greetMany(names)` with input order, duplicates and empty-input tests.
The agents received the same fixed preferences and completed the installed skill autonomously.

| Runtime | Result | Tests | Implementation commit |
|---|---|---|---|
| Claude Code | full plan, improve, implement, QA, fresh verify/review, apply, archive, commit | 5/5 | `0db5710` |
| Codex CLI | same workflow; stopped on sandbox staging failure, then resumed staging/commit | 4/4 | `ae6a18d` |

Each implementation commit contains exactly seven files: source, tests, three QA artifacts,
LIVE.md and the archived plan. Both archives retain `applied:` and include `archived:` metadata.
Both final `adr live check --json` results have no issues. Neither run created an ADR or pushed.
Both final footers report capability `greet-many`, untested 0, stopped at none and pushed no.
Tracked files have no remaining diff after the implementation commits.

Codex initially ran with `workspace-write`. Git refused `.git/index.lock`, and the skill
correctly stopped at step 43 without claiming a commit. The same session resumed in the
isolated scratch with Git writes enabled (`danger-full-access`), rechecked tests/refs and
committed the recorded files. It did not restart planning or apply the delta again.
The original transcript contains exactly one mutating live apply command.

## Live stop conditions

Claude exercised four additional fixtures:

| Input / state | Expected stop | Result |
|---|---|---|
| configured fast PLAN.md | step 7 | refused, no changes or commit |
| full plan with `implements:` | step 7 | refused, routed to `adr-auto-implement`, no changes or commit |
| dirty LIVE.md | step 2 | stopped before baseline or planning; existing edit preserved |
| acceptance baseline exits 23 | step 4 | stopped on unchanged code, no planning, implementation or commit |

The rejection fixtures and their setup commits remain in the Claude scratch for reproduction.
They are separate from its one implementation commit.

## Evidence and limits

- Logs: `C:/workspace/projects/AI/adr-phase4-probe-claude/probe-*.log` and
  `C:/workspace/projects/AI/adr-phase4-probe-codex/probe-*.log`.
- These initial positive runs used fresh read-only reviewers. The follow-up in
  [validation-backlog-2026-10-11.md](validation-backlog-2026-10-11.md) covers live ultra
  input, inline fallback, configured exploratory execution and a reproduced fix round.
- Codex needs a writable Git index to complete the commit; sandbox staging failure stops the skill.
- Phase 4 has its own repository commit after Phase 3; no push or publication.
