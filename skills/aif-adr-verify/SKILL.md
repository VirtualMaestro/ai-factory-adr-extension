---
name: aif-adr-verify
description: Verify one ADR against the implemented code — confirm its code anchors resolve and judge whether the code honors the Decision. Read-only; reports a verdict, never rewrites.
---

# aif-adr-verify

Answer, on demand, *"was this ADR actually implemented, and does the code still match the
Decision?"* for a **single** accepted or active ADR. Unlike `aif-adr-finalize` — which verifies
**once**, at activation, against the linked plan — this skill is **re-runnable** and checks the
`code:` anchors against the current tree. It is **read-only**: it reports a verdict and never
edits the ADR or the code.

## Workflow

1. **Anchors resolve?** Run `ai-factory adr verify-anchors <file>` — deterministic check that
   every `code:` frontmatter anchor (and any `#symbol`) exists on disk. Missing anchors ⇒ the
   ADR points at moved/deleted code (drift or stale anchors); note them.
2. **Gather context.** `ai-factory adr resolve-plan <file>` (linked / archived plan) and
   `ai-factory adr status <file>` (status, Implementation evidence). A doc-only ADR
   (`Plan: not required` / documentation-only evidence) has nothing to verify — report N/A.
3. **Judge conformance.** Open the anchored code (start from `code:`, trace outward as needed).
   Compare it against the `## Decision` and, where testable, `## Consequences`/risks. Classify:

   | Verdict | Meaning |
   |---|---|
   | **implemented** | Code present at the anchors and consistent with the Decision. |
   | **partial** | Some of the Decision is implemented; parts are missing or stubbed. |
   | **drift** | Code **contradicts** the accepted Decision. |
   | **not-implemented** | Anchors missing or no code realizes the Decision. |
   | **doc-only / N/A** | Documentation-only ADR; nothing to verify. |

4. **Report only.** State the verdict, the evidence (which anchors, which code), and gaps.
   **Never** rewrite the ADR or the code, and **never** reshape the Decision to match the code.
   - **drift / contradiction** → recommend `aif-adr-refine` (return to draft and re-decide),
     mirroring `aif-adr-finalize`'s rule.
   - **missing anchors on an active ADR** → recommend refreshing the `code:` array (re-run
     `aif-adr-finalize` or edit the anchors via refine) so it points at the real code.
   - **partial / not-implemented on an accepted ADR** → the implementation work is unfinished;
     point back to `aif-adr-implement`.

Do not call other skills as nested skills — apply their semantics inline in this run.

## Invocation

Claude Code: `/aif-adr-verify @adr-file` · Codex: `$aif-adr-verify @adr-file`.
