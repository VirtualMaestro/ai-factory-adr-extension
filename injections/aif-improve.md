## Preserve the LIVE.md delta — ADR extension

When refining a plan, keep its first `adr-live` fence and update the delta when the refinement changes what the product does. Keep it right after the entrypoint's title, without disturbing a Handoff line.
Do not add a second fence. For a plan with frontmatter `implements:`, remove any fence: the linked ADR owns the delta.
When LIVE.md exists, read `ai-factory adr live` and `ai-factory adr decisions`. Name any active ADR whose capability the refined change alters or removes; the change may proceed and the apply records removal debt.
Double-quote summaries and use the lexicon of `ai-factory adr format`. Fast plans need durable `refs:` on every change. Run `ai-factory adr live apply <entrypoint> --dry-run` and correct reported issues.
When the runtime denies an `ai-factory` command, read `LIVE.md` directly; the apply at the end of `aif-implement` checks the delta.
