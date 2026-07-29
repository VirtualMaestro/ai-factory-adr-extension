---
id: adr-ci-required-checks
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [ci]
supersedes: []
code: [.github/workflows/ci.yml]
evidence: implemented
---

# A merge waits for the required checks

## Context

problem:
- a red branch reaches the default branch because the author merged before CI finished

constraints:
- the default branch stays deployable at every commit

decision_drivers:
- the count of commits on the default branch that fail their own test suite

## Decision

decision: the default branch accepts a merge only after the required checks report success

scope:
- merges into the default branch
- excludes: automated version bump commits

rules:
1. a merge into the default branch waits for the test job and the lint job
2. a red required check is fixed on the branch, and never merged past

## Alternatives considered

alternatives:
- id: Post-merge verification
  description: CI runs after the merge and alerts on failure
  rejected_because: the default branch is already broken by the time the alert arrives

## Consequences

positive:
- the default branch stays deployable

negative:
- a merge waits for the slowest required job

risks:
- a flaky check blocks every merge -> a flaky check is removed from the required set the day it is found
