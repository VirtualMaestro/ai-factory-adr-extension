---
id: adr-cart-continuity
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [checkout]
supersedes: []
code: [src/checkout/basket.js]
evidence: implemented
---

# A basket survives between visits

## Context

problem:
- a shopper adds 6 items, closes the tab, returns and finds an empty basket

constraints:
- a basket is readable within 20 milliseconds on the product page

decision_drivers:
- the share of shoppers who abandon a rebuilt basket

## Decision

decision: the checkout module keeps each shopper's basket in the process that serves them

scope:
- the checkout module of the orders API
- excludes: the wish list, which is stored per account

rules:
1. the checkout module keeps every basket in process memory, keyed by the visitor identifier
2. a basket is discarded 30 days after its last change

## Alternatives considered

alternatives:
- id: Basket in the browser
  description: the basket lives in browser storage and is sent with each page view
  rejected_because: a shopper who switches from phone to laptop starts over

## Consequences

positive:
- a returning shopper finds the basket as it was

negative:
- basket memory grows with the count of visitors in the last 30 days

risks:
- a busy day exhausts basket memory -> a size cap of 200 lines per basket
