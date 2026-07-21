---
name: aif-adr-propose
description: Create a new ADR proposal — scan for duplicate/conflicting decisions, generate a stable ID, and write it to proposals/ with status proposed.
---

# aif-adr-propose

Capture and investigate a potential architectural decision (PRD §19.1). Produce a
`status: proposed` ADR that records what is known and names what is still open — **not**
an accepted project rule.

## Workflow

1. **Inventory existing decisions.** Run `ai-factory adr status --json` to list accepted,
   active, and superseded ADRs. Read the candidates that look related.
2. **Detect duplicates and conflicts** *before* writing. If an accepted/active ADR already
   covers this decision, stop and recommend `aif-adr-refine` on it (or `aif-adr-supersede`)
   instead of creating a near-duplicate.
3. **Research the context.** Inspect `.ai-factory/ARCHITECTURE.md`, `.ai-factory/RULES.md`,
   any research artifacts, and the relevant source. Use the `aif-explore` research posture
   (broad read-only investigation) — describe that work here; do not assume this skill can
   invoke `aif-explore` as a nested call.
4. **Scaffold deterministically.** Run:

   ```text
   ai-factory adr new "<topic>"
   ```

   This generates the stable ID, creates `<configured-adr-root>/proposals/adr-<slug>.md` with
   `status: proposed` from the template, and refuses if that ID already exists. Do not
   hand-write the file or invent the ID — the command owns ID generation and the filename.
5. **Fill known Context** in the created file: Problem, Constraints, Decision drivers.
6. **Record unresolved assumptions explicitly** as placeholders in the body — do not resolve
   them by guessing.
7. **Keep it a proposal.** Leave `status: proposed`. Do not present the decision as settled;
   acceptance happens later via `aif-adr-refine` → `aif-adr-accept`.
8. **Report the status footer** — end with one line so the ADR this run created is obvious at a
   glance:

   ```text
   ✔ aif-adr-propose · ADR: <adr-id> [proposed] · Plan: none
   ```

   Fill it from `ai-factory adr status <adr-file>` (a fresh proposal has no plan).

## Invocation

Claude Code: `/aif-adr-propose <topic>` · Codex: `$aif-adr-propose <topic>`.
