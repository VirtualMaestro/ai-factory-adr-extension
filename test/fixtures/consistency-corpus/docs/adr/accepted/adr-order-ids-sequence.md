---
id: adr-order-ids-sequence
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [orders]
supersedes: []
code: []
---

# Order identifiers come from a database sequence

## Context

problem:
- support staff read order ids aloud on the phone and mistype the long ones

constraints:
- an order id stays readable over a voice channel

decision_drivers:
- the shortest id a human can dictate without a repeat

## Decision

decision: the database sequence `order_id_seq` issues every order id

scope:
- the order write path in both regions
- excludes: internal report identifiers

rules:
1. the database assigns the order id on insert, and application code sends none
2. the order id column is a 64-bit integer

## Alternatives considered

alternatives:
- id: Short random strings
  description: an 8-character random string checked for collisions on insert
  rejected_because: the collision check costs a read before every write

## Consequences

positive:
- an order id fits in 8 characters when spoken

negative:
- the sequence serializes inserts across regions

risks:
- a region outage stalls the sequence -> not eliminated
