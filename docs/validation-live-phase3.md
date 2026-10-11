# LIVE.md phase 3 validation — 2026-10-11

Implementation for 4.6.0 is complete in the working tree. No repository commit, push or publication.

## Automated checks

- `npm test -- --test-reporter=tap`: **179 passed, 0 failed, 0 skipped**.
- Real CLI integration covers checkout and packed installation, both runtime injections,
  packaged injection files, plan apply, pending partial success, exit 1 on failure and JSON output.
- The focused CLI regression passed again after adding explicit JSON assertions for live init
  and check. `git diff --check` passed.
- Package, manifest and both root lockfile version fields: **4.6.0**.
- Unit coverage includes full files, ultra directories/indexes, archived plans, arbitrary
  repository-local plans, fast durable refs, linked skips, no-op writes, refusals without
  mutations, CRLF carriers, existing contradiction lists, checker scopes, ADR debt clearing,
  commit-date/mtime ordering, same-date change ordering, duplicate additions and retries.

## Live acceptance

Scratch projects were initialized with `ai-factory init --agents "claude,codex" --config`,
then installed this checkout with `ai-factory extension add`, initialized Git and opted in
with `adr live init`. `.ai-factory/extensions/` and `.codex/` were ignored.
Each fixture contained a dependency-free ESM greeting library with node:test.
The agents received fixed planning preferences and instructions to keep fast plans for inspection,
make no commits/pushes and use no subagents or MCP services.

| Runtime | Full → improve → implement → archive | Fast → implement | Final standard tests |
|---|---|---|---|
| Claude Code | PASS: fence preserved, apply stamped, archive ref resolves | PASS: durable refs, applied stamp, plan retained | 4/4 |
| Codex CLI | PASS for planning, refinement, implementation and archive; staging limitation below | PASS for implementation, durable refs and applied stamp; staging limitation below | 5/5 |

Both final `adr live check --json` and `adr decisions --json` returned no issues;
`adr status --check` passed. Both LIVE files contain `greet-many` and `farewell`.
Both archived full plans retain their fence and `applied:`.

Claude staged LIVE.md, PLAN.md and the archived full plan. Its archive date edit remained
unstaged after the move; core archive staging is outside this phase.

Codex's `workspace-write` sandbox could not spawn the isolated node test runner
(`spawn EPERM`), so the agent used `node --test --test-isolation=none`. Standard `npm test`
passed outside that sandbox. Its Git index stayed empty: existing `stageMove` deliberately
ignores staging failures. An independent, freshly initialized scratch replay applied both
actual Codex-authored deltas outside the sandbox and asserted that LIVE.md, PLAN.md and the
archived plan were staged; live check and standard tests passed there too.

## Evidence and limits

- Scratch logs: `C:/workspace/projects/AI/adr-phase3-probe-claude/probe-*.log` and
  `C:/workspace/projects/AI/adr-phase3-probe-codex/probe-*.log`.
- Codex staging replay: `C:/Users/virtu/AppData/Local/Temp/adr-phase3-replay-oU0Wvr`.
- Live ultra execution was not run; automated tests cover ultra apply and archive refs.
- Pending batches intentionally retain successful writes and staging when another source fails.
- Phase 4 remains deferred until the operator commits phase 3.
