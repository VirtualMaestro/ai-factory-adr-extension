## LIVE.md delta — ADR extension

When the project has `LIVE.md` (default `.ai-factory/LIVE.md`, configured by `adr.live`):

- Read `ai-factory adr live`, `ai-factory adr decisions` and `ai-factory adr format` before planning. Reuse capability ids from LIVE.md.
- Name any active ADR whose capability the change removes or alters. Tell the operator which obligation it contradicts; the change may proceed and the apply records removal debt.
- Keep the first `adr-live` fence when rewriting a plan, and update its delta to match the planned behavior. Do not add a second fence.
- Write no fence when frontmatter `implements:` links the plan to an ADR: the ADR owns its delta.
- Otherwise write the fence right after the entrypoint's `#` title (full plan file, ultra `index.md`, or fast `PLAN.md`). Keep any required Handoff line first.
- Use `none:` with a reason for a bug fix or refactor that changes no capability. For a capability change, use `changes:` with `added`, `modified` or `removed`.
- Double-quote each summary. Write its 1–2 sentences with the lexicon of `ai-factory adr format`; the CLI checks the rendered LIVE.md.
- For a fast plan, give every change durable `refs:` (repository files or ADR ids), including modifications and removals: PLAN.md may disappear after completion.
- Run `ai-factory adr live apply <entrypoint> --dry-run` to check the delta before implementation; correct any reported issue.

Example carrier (replace the values with the actual change):

```adr-live
changes:
  - capability: export-report
    change: added
    summary: "Users export the report as a CSV file."
    refs: src/export.js
```

For no capability change:

```adr-live
none: "Refactor the parser without changing observable behavior."
```
