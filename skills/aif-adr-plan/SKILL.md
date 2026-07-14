---
name: aif-adr-plan
description: Create an implementation plan for an accepted ADR with reciprocal implements/affects links.
---

# aif-adr-plan

Turn an accepted decision into an AI Factory implementation plan (PRD §19.4). The plan is a
**separate artifact** that lives in the project's plans directory — this skill creates it and
wires the reciprocal ADR↔plan links; it does not change the ADR's status.

## Preconditions

Do not plan unless **all** hold:

- the ADR status is `accepted` and it is not superseded;
- no non-archived plan already implements it — check with
  `ai-factory adr resolve-plan <adr-file>` (it must report no active plan; it exits non-zero
  on more than one — resolve that first);
- the ADR actually requires implementation (documentation-only decisions skip straight to
  `aif-adr-finalize`).

## Workflow

1. **Inspect** the accepted ADR and any relevant active decisions. Run
   `ai-factory adr status <adr-file>` first. If it reports dependency warnings, state each
   warning to the operator and confirm they want to continue before creating the plan.
2. **Create the plan** by applying `aif-plan full` planning semantics in this run; do not
   invoke `aif-plan` as a nested skill. AI Factory owns plan
   creation, the plans directory (`paths.plans`), and the filename format (including
   sequential `NNNN_` numbering when configured) — do **not** hand-place the file or guess
   its path. Give the plan frontmatter:

   ```yaml
   id: plan-<adr-short-stable-name>
   type: plan
   status: in_progress
   depends_on: [<adr-short-stable-name>]
   implements: [<adr-short-stable-name>]
   ```

3. **Link reciprocally** — one command wires both sides:

   ```text
   ai-factory adr link-plan <adr-file> <plan-file>
   ```

   It adds the plan id to the ADR `affects` relationship (which also clears the built-in
   `audit-artifacts` warning "Accepted ADR without `affects` links"), sets the ADR
   Implementation **Plan:** field, and adds `implements`/`depends_on` to the plan.
4. **Evidence stays non-sentinel.** The ADR Implementation section must **not** contain the
   literal `not implemented` — that is a blocking placeholder sentinel (inv 6) and will fail
   `adr validate` / `status --check` on an accepted ADR. Use a neutral value such as
   `- **Evidence:** pending`; `aif-adr-finalize` flips it to `implemented` later.
5. **Audit** — `ai-factory adr status --check`. It honors the configured ADR root; resolve
   any failures.
6. **Leave the ADR `accepted`.** Creating a plan never advances the decision.

## Invocation

Claude Code: `/aif-adr-plan @adr-file` · Codex: `$aif-adr-plan @adr-file`.
