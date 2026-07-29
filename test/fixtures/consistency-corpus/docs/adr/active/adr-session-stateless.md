---
id: adr-session-stateless
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [api]
supersedes: []
code: [src/api/auth.js]
evidence: implemented
---

# Requests carry their own credentials

## Context

problem:
- a deploy replaces every process, and callers are signed out mid-task

constraints:
- a process is replaceable at any moment without warning

decision_drivers:
- a caller notices no difference when a process is replaced

## Decision

decision: authenticate each incoming request from a signed token the caller presents

scope:
- the request path of the orders API
- excludes: the nightly export job

rules:
1. a process holds no caller data between 2 requests
2. any process answers any request with no warm-up

## Alternatives considered

alternatives:
- id: Sticky routing
  description: the load balancer pins a caller to the process that first answered it
  rejected_because: a replaced process still loses everything that caller had accumulated

## Consequences

positive:
- a deploy replaces processes with no visible effect on callers

negative:
- every request pays the signature check

risks:
- a leaked token stays valid until it expires -> the token lifetime is 15 minutes
