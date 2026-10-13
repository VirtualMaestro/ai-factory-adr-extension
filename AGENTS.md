# AGENTS.md — working on `ai-factory-adr-extension`

An AI Factory extension: the ADR lifecycle (`skills/adr-*`, 20 skills) and the `ai-factory adr`
command group (`commands/adr.js`, `src/`). Node >= 22.14, ESM, no build step, `npm test` runs
everything (`node --test`), including an integration suite against the global `ai-factory` CLI.

## Work in progress

All 4 phases of `docs/proposal-live-state.md` are complete. Since 5.0 `LIVE.md` is mandatory: its opt-in in §3.6 is history. `docs/BACKLOG.md` tracks open work;
`docs/validation-backlog-2026-10-11.md` records follow-up live runs, the plan profile and code context.

## Rules of this repository

- Do not commit, push or publish unless the operator asks for it in that turn. Leave the work in the
  tree; the operator reviews at the commit. One proposal phase per commit.
- Commit messages: Conventional Commits, `feat:` / `fix:` / `docs:`, on `master`, staged by name.
- Every release moves `package.json`, `extension.json` and both `version` fields at the top of
  `package-lock.json` together, and adds a `CHANGELOG.md` entry. The `prepack` hook fails the
  integration test on a mismatch.
- Our skills are `adr-*`. The `aif-` prefix belongs to AI Factory core: never mass-rewrite on `aif-`.
- CNL-P (the format of every skill body, ADR body and `LIVE.md`) comes from the `cnlp-kit` dependency.
  Read it by command before editing a skill: `ai-factory adr format` (the standard) and
  `ai-factory adr format skill` (the profile). Never cite it by path: `test/skill-format.test.js`
  fails. The local profiles are `profiles/skill.md`, `profiles/live.md` and `profiles/plan.md`.
- Skill bodies are imperative: the checker rejects the agentless passive (`is stated`), `ensure`,
  `faster`, `never` as a bullet opener, and lines over 250 characters. A new section name goes into
  `custom_sections` of `profiles/skill.md`.
- The 2 `quality_rules:` variants are copied byte for byte across their skill groups
  (`test/skill-rubric.test.js`): edit one, edit all in the group. A new skill joins a group there,
  `extension.json` `skills`, the README skill tables and the skill counts in the tests.
- Check every unknown in the code or in a live run before deciding, and name what could not be run.
  Live runs of a skill go in a scratch project: `ai-factory init --agents claude,codex --config`, then
  `ai-factory extension add <this repo>`, `git init`, and ignore `.ai-factory/extensions/` and `.codex/`.
  - Codex: `codex exec -s workspace-write '$<skill>' < /dev/null`; follow up with
    `codex exec resume --last "<reply>" < /dev/null`. Without `< /dev/null` it waits on stdin.
  - Claude Code: `claude -p "/<skill>" --permission-mode acceptEdits --allowedTools "Bash(ai-factory *)"
    "Bash(git *)"`; set `MSYS_NO_PATHCONV=1` in Git Bash, or `/<skill>` turns into a path.
- On Windows, a Python script that writes files needs `open(p, 'w', newline='')`; otherwise it writes
  CRLF into LF files.
