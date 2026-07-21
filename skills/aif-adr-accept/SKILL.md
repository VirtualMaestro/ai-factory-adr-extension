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

## Evaluating solutions

The architectural decision is already made — do not re-litigate it. Judgments here are
about conformance and tactics:

- **Ground every verdict** in a concrete rule, ADR clause, plan step, or code location.
  No ground named — no verdict: research until you can name it, never guess.
- **Deviations surface, they don't decide.** Code or plan diverging from the Decision is
  reported as a deviation with evidence — never resolved by quietly reshaping the
  judgment to fit, and never excused because fixing it would be laborious.
- **Tactical choices** (how exactly to realize a step) follow the project's existing
  conventions and invariants; agent convenience — "faster", "easier" for this session —
  is not an argument.
- **Revise on reasons, not on pushback.** Change a verdict on a new fact, a found
  reasoning error, or an explicit operator decision — and name what changed.
  Disagreement alone is not new information.

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
