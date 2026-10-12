# Audit follow-up validation — 2026-10-12

Follow-up to the 4.8.1 audit of the 4 `LIVE.md` phases: the items 4.8.1 left unchecked.
Live runs used Claude Code (`claude -p`, `--permission-mode acceptEdits`) in throwaway
projects with the working-tree extension installed. Codex was not run for these items.
No push or publication.

## Code

| Item | Probe before the fix | Fix |
|---|---|---|
| Concurrent applies | 2 `applySource` calls at once both succeeded; `LIVE.md` kept 1 record while both plans read as applied | `LIVE.md.lock` held from the read of `LIVE.md` to its write in apply, finalize and supersede; a second writer fails and changes nothing |
| Git-ignored `.ai-factory/` | apply wrote `LIVE.md` and the plan, staged nothing, warned nothing | a warning per written file that git ignores |
| Unused code | `parseLive().sentinel` read only by a test; `liveError`'s `files` option never passed | removed |

A compare-and-swap was rejected: the failed writer's rollback restores its snapshot of
`LIVE.md` over the other writer's records. The 3 new tests fail on the unfixed code.

## Skills

| Skill | Fixture | Result |
|---|---|---|
| `adr-live-seed` | 14 copied corpus ADRs (8 active, 6 accepted), `LIVE.md` holding only the sentinel, 1 completed plan without a fence | Stopped at the approval step with a list of 8 capabilities. After approval: 7 active ADRs with `changes:`, 1 with `none:`, 6 accepted deltas dry-run clean, `status --check` exit 0. `live check` kept only the plan's `missing-delta`, and the plan went to the operator list without a loop |
| `adr-live-seed`, step 2 | same | The first run looked for `LIVE.md` at the repository root and ran `adr live init`, which refused. Step 2 now runs `ai-factory adr live`; the rerun called it first, skipped `init` and stopped at approval |
| `adr-finalize` | accepted documentation-only ADR with a `changes:` delta | dry run, validate, finalize, `status --check`, `live check`, footer `Plan: none` |
| `adr-migrate` | 2 legacy MADR files (1 implemented, 1 proposed), `LIVE.md` present | `live:` on both, apply on the active one, `validate --strict`, `status --check` and `live check` all clean |
| `aif-plan` injection | `LIVE.md` with 1 record, no `Bash(ai-factory *)` permission | `adr live`, `decisions`, `format` and the dry run were denied. The agent read `LIVE.md` directly, wrote a valid fence after the title and reported the skipped dry run |

## Limits

- 1 run per skill on 1 runtime; a different executor may read the same steps differently.
- The lock does not wait or detect a stale lock: a killed process leaves `LIVE.md.lock`,
  and the error names it for the operator to delete.
- The `aif-improve` injection fallback has the same wording as `aif-plan` and was not run.
