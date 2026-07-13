---
name: aif-adr-accept
description: Accept a draft ADR — check preconditions, run the artifact audit, and atomically move draft to accepted.
---

# aif-adr-accept

Declare the decision complete enough to guide implementation (PRD §19.3): move a
`draft` ADR to `accepted`.

## Preconditions

Do not accept unless **all** hold:

- the file is in `docs/adr/drafts` and its status is `draft`;
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
2. **Audit** the ADR root and `.ai-factory`:

   ```text
   ai-factory audit-artifacts docs/adr .ai-factory
   ```

   Pass the relocated ADR root instead of `docs/adr` if the project moved it. Resolve any
   failures before continuing.
3. **Accept** — single atomic move (status edit + `drafts/` → `accepted/`):

   ```text
   ai-factory adr transition <file> accepted
   ```

4. **Report** warnings and the resulting `accepted/` path.

Optional memory synchronization is a later-phase concern (not part of wave 1).

## Invocation

Claude Code: `/aif-adr-accept @adr-file` · Codex: `$aif-adr-accept @adr-file`.
