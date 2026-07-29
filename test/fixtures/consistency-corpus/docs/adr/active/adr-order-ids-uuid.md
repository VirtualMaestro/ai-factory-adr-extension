---
id: adr-order-ids-uuid
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [orders]
supersedes: []
code: [src/orders/id.js]
evidence: implemented
---

# Order identifiers are UUIDv7

## Context

problem:
- two regions write orders at once and a shared counter serializes them

constraints:
- an order id is assigned before the row reaches the database

decision_drivers:
- writes stay independent per region

## Decision

decision: the service generates every order id as a UUIDv7 in application code

scope:
- the order write path in both regions
- excludes: internal report identifiers

rules:
1. the service assigns the order id in application code before the insert
2. the database column for the order id accepts a 128-bit value only

## Alternatives considered

alternatives:
- id: Region-prefixed counters
  description: each region owns a counter and prefixes its ids
  rejected_because: merging the two ranges after a region move needs a rewrite of every foreign key

## Consequences

positive:
- a region writes orders while the other region is unreachable

negative:
- an order id costs 16 bytes instead of 8

risks:
- index locality drops with random ids -> UUIDv7 keeps the time prefix ordered
