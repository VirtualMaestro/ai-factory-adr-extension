---
name: aif-adr-plan-improve
description: Improve the implementation plan of an accepted ADR — resolve the plan from the ADR itself and apply aif-improve to it, so you work by ADR name and never touch the plan filename.
---

# aif-adr-plan-improve

Improve an ADR's implementation plan **by naming the ADR, not the plan**. The plan is a
throwaway technical map; the ADR is what you track. This skill resolves the plan from the
ADR's `implements` links and applies the stock **`aif-improve`** semantics to it — the same
improvement `aif-improve` does, without you having to remember or look up the plan's path.

It **only refines the plan**. It never implements the decision, edits production code, or
advances the ADR (that is `aif-adr-implement` / `aif-adr-finalize`). It is the by-ADR-name
shortcut for the manual "resolve the plan, then run `aif-improve`" flow documented in
`aif-adr-plan`.

## Preconditions

- the ADR status is `accepted` and it is not superseded;
- exactly one non-archived plan implements it (the workflow checks this).

## Workflow

1. **Resolve the plan from the ADR** — never guess the filename:

   ```text
   ai-factory adr resolve-plan <adr-file>
   ```

   It resolves via the plan's `implements` frontmatter (add `--json` for the plan's `file`).
   - **no active plan** → stop and recommend `aif-adr-plan` first (nothing to improve yet);
   - **more than one active plan** → the command exits non-zero; surface it and stop, resolve
     that before improving;
   - **exactly one** → that is the plan to improve.
2. **Improve the resolved plan** by applying `aif-improve` semantics in this run against that
   plan file; do not invoke `aif-improve` as a nested skill. `aif-improve` edits the plan
   **body**, not its frontmatter, so the reciprocal `implements`/`depends_on` links survive.
3. **Re-verify** before handing off: `ai-factory adr resolve-plan <adr-file>` still resolves to
   exactly one plan, and `ai-factory adr status --check` is clean (links/audit intact).
4. **Leave the ADR `accepted`.** Improving a plan never advances the decision.
5. **Report the status footer** — end with one line so the ADR/plan this run touched is obvious
   at a glance:

   ```text
   ✔ aif-adr-plan-improve · ADR: <adr-id> [<status>] · Plan: <plan-id> (<plan-status>)
   ```

   Fill it from `ai-factory adr status <adr-file>` (id, status, active plan).

## Invocation

Claude Code: `/aif-adr-plan-improve @adr-file` · Codex: `$aif-adr-plan-improve @adr-file`.
