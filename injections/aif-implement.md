## Apply the LIVE.md delta — ADR extension

After every plan task is done, before "Handle plan artifact after completion" and before offering to delete or overwrite a fast PLAN.md:

1. Check that the entrypoint's `adr-live` fence matches the behavior actually built. A plan with frontmatter `implements:` needs no fence because its ADR owns the delta.
2. For a fast plan, check that every change has durable `refs:` (repository files or ADR ids), including modified and removed changes.
3. Run `ai-factory adr live apply <entrypoint>` (full plan file, ultra `index.md`, or fast PLAN.md). Run it even for a linked plan or a project without LIVE.md: `skipped:` means nothing needs doing.
4. On failure, correct the delta as the error says (including rewriting the summary), then run again. Stop completion and artifact deletion if it still fails. Do not erase `applied:` to retry an already applied delta.
5. Report the effect and every warning, including removal debt against an active ADR and its `adr-auto-plan` next step. The CLI stages the entrypoint and LIVE.md; include both with the implementation's next commit.

Inline implementation without a plan has no carrier and does not run this step.
