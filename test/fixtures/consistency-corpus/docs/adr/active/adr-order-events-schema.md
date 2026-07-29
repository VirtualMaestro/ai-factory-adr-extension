---
id: adr-order-events-schema
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [orders, events]
supersedes: []
code: [src/events/schema.js]
evidence: implemented
---

# Order events carry a versioned schema

## Context

problem:
- a producer adds a field and a consumer written last year stops parsing the payload

constraints:
- a consumer written against version 1 keeps working when version 2 is published

decision_drivers:
- what a producer may change without coordinating a release with every consumer

## Decision

decision: every order event payload declares a schema version, and a field is added only in a way older consumers ignore

scope:
- the payload of events emitted by the orders service
- excludes: the transport and its topic layout

rules:
1. an event payload carries `schema_version` as its first field
2. a field is added as optional, and a released field keeps its meaning

## Alternatives considered

alternatives:
- id: Shared library of types
  description: producers and consumers depend on one package that defines the payload
  rejected_because: a payload change becomes a coordinated deploy of every consumer

## Consequences

positive:
- a producer adds a field without a consumer release

negative:
- a removed field stays in the payload until every consumer moves

risks:
- a field is reused for a new meaning -> the review checklist rejects a change of meaning without a version step
