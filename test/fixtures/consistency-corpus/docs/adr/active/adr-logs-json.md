---
id: adr-logs-json
type: adr
status: active
owners: [fixture]
depends_on: []
affects: [observability]
supersedes: []
code: [src/log/emit.js]
evidence: implemented
---

# Logs are one JSON object per line

## Context

problem:
- the log shipper splits multi-line stack traces into unrelated events

constraints:
- a log line is parsed without knowledge of the line before it

decision_drivers:
- the count of events lost to a parse failure

## Decision

decision: every log line is a single-line JSON object

scope:
- every service process
- excludes: the output of build scripts

rules:
1. a log line carries the keys `ts`, `level` and `msg`
2. a newline inside a value is escaped, so 1 event occupies 1 line

## Alternatives considered

alternatives:
- id: Key-value text
  description: `ts=… level=… msg=…` on each line
  rejected_because: a message containing a space needs quoting rules the shipper does not share

## Consequences

positive:
- a stack trace arrives as 1 event

negative:
- a line is harder to read without a formatter

risks:
- a log line grows past the shipper limit -> values are truncated at 8 kilobytes
