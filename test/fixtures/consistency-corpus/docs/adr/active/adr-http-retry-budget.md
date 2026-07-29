---
id: adr-http-retry-budget
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [http-client]
supersedes: []
code: [src/http/retry.js]
evidence: implemented
---

# Retries draw on a budget

## Context

problem:
- a struggling upstream receives 3 times its normal load from retries alone

constraints:
- a retry is attempted only for an idempotent request

decision_drivers:
- the load a failing dependency receives from its callers

## Decision

decision: the shared HTTP client draws every retry from a per-upstream budget of 10 percent of that upstream's request count

scope:
- outbound calls made through the shared HTTP client
- excludes: the first attempt, which is never counted as a retry

rules:
1. retry budget per upstream <= 10 percent of its request count over the last 60 seconds
2. a non-idempotent request is attempted 1 time

## Alternatives considered

alternatives:
- id: Fixed retry count
  description: retries per call <= 3, whatever the upstream is doing
  rejected_because: a broad outage multiplies load at the moment the upstream can least take it

## Consequences

positive:
- a failing upstream receives at most a tenth extra load

negative:
- a retry is refused while the budget is spent

risks:
- the budget hides a real transient failure -> refused retries are counted and reported
