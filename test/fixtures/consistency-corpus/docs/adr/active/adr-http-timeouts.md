---
id: adr-http-timeouts
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [http-client]
supersedes: []
code: [src/http/client.js]
evidence: implemented
---

# Every outbound call carries a deadline

## Context

problem:
- a hung upstream holds request threads until the process runs out of them

constraints:
- a call without a deadline is refused at construction

decision_drivers:
- the time a single slow dependency can hold the service

## Decision

decision: the shared HTTP client applies a connect deadline and a read deadline to every outbound call

scope:
- outbound calls made through the shared HTTP client
- excludes: the streaming export endpoint, which negotiates its own deadline

rules:
1. connect deadline <= 2 seconds
2. read deadline <= 10 seconds

## Alternatives considered

alternatives:
- id: One global deadline
  description: a single timeout covers connect and read together
  rejected_because: a slow connect and a slow body need different limits to be diagnosed apart

## Consequences

positive:
- a hung upstream costs 10 seconds, not a process

negative:
- a legitimate slow call is cut off

risks:
- an upstream near the limit fails intermittently -> the client reports the deadline it applied
