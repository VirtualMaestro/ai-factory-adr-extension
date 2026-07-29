---
id: adr-structured-logging
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [observability]
supersedes: []
code: []
---

# Structured logging

## Context

problem:
- a query over free-text logs needs a new regular expression for every question

constraints:
- a log record is queryable by field

decision_drivers:
- the time it takes to answer a question from logs alone

## Decision

decision: log records are structured, written as one JSON object per line

scope:
- every service process
- excludes: the output of build scripts

rules:
1. a log record carries a timestamp, a level and a message under fixed key names
2. one record occupies one line

## Alternatives considered

alternatives:
- id: Free-text lines
  description: the message is written as prose and parsed on read
  rejected_because: every new question needs a new pattern, and old lines never match it

## Consequences

positive:
- a question over logs becomes a field query

negative:
- a record carries its key names on every line

risks:
- a field name drifts between services -> the shared logger owns the key names
