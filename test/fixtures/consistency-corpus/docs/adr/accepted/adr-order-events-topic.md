---
id: adr-order-events-topic
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [orders, events]
supersedes: []
code: []
---

# Order events go to one topic

## Context

problem:
- a consumer that needs every order state change subscribes to 4 topics and joins them by hand

constraints:
- the order of events for a single order is preserved

decision_drivers:
- what a consumer must know to receive a complete order history

## Decision

decision: every order event is published to the single topic `orders.events`, partitioned by order id

scope:
- events emitted by the orders service
- excludes: audit records, which stay in the database

rules:
1. an order event is published to `orders.events` and to no other topic
2. the partition key of an order event is its order id

## Alternatives considered

alternatives:
- id: A topic per event type
  description: `orders.created`, `orders.paid`, `orders.shipped`
  rejected_because: ordering across topics is not defined, so a consumer sees `paid` before `created`

## Consequences

positive:
- a consumer subscribes 1 time and receives the whole history in order

negative:
- a consumer interested in 1 event type reads all of them

risks:
- a hot order concentrates on 1 partition -> not eliminated
