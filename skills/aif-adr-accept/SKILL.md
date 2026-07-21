---
name: aif-adr-accept
description: Accept a draft ADR — check preconditions, run the artifact audit, and atomically move draft to accepted.
---

# aif-adr-accept

Declare the decision complete enough to guide implementation (PRD §19.3): move a
`draft` ADR to `accepted`.

## Preconditions

Do not accept unless **all** hold:

- the file is in the configured ADR root's `drafts/` directory and its status is `draft`;
- exactly one primary decision is stated;
- Context describes the problem;
- relevant constraints are present;
- the Decision is concrete;
- meaningful alternatives are recorded;
- Consequences include disadvantages or risks;
- no blocking questions remain;
- conflicts with active ADRs are resolved or explicitly addressed;
- artifact metadata is valid.

If any precondition fails, stop and recommend `aif-adr-refine` — do not accept.

## Workflow

1. **Validate.** `ai-factory adr validate <file>`.
2. **Audit** the configured ADR root and `.ai-factory`:

   ```text
   ai-factory adr status --check
   ```

   The command resolves `adr.root` and passes it to the artifact audit. Resolve any failures
   before continuing.
3. **Accept** — single atomic move (status edit + `drafts/` → `accepted/`):

   ```text
   ai-factory adr transition <file> accepted
   ```

4. **Report** any warnings, then end with the status footer so the ADR this run touched is obvious
   at a glance:

   ```text
   ✔ aif-adr-accept · ADR: <adr-id> [accepted] · Plan: <plan-id or none>
   ```

   Fill it from `ai-factory adr status <adr-file>` (id, status, active plan).

Optional memory synchronization is post-MVP and is not provided by this skill.

## Invocation

Claude Code: `/aif-adr-accept @adr-file` · Codex: `$aif-adr-accept @adr-file`.
