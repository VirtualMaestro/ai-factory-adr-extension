---
id: adr-schema-migrations-reversible
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [database]
supersedes: []
code: []
---

# Every migration is reversible

## Context

problem:
- a bad release stays live for 40 minutes while a fix-forward migration is written

constraints:
- a release is undone by the deploy tool alone

decision_drivers:
- time to return the schema to its previous shape

## Decision

decision: every schema migration ships with a down script that returns the schema to its previous shape

scope:
- the migration directory of the orders database
- excludes: seed data for local development

rules:
1. a migration file carries an up step and a down step
2. the deploy tool refuses a migration whose down step is absent

## Alternatives considered

alternatives:
- id: Fix-forward only
  description: rollback is a new migration written at incident time
  rejected_because: the fix is authored under pressure, by whoever is awake

## Consequences

positive:
- a rollback takes 1 command

negative:
- every migration costs a second script and its test

risks:
- a down step is written and never run -> the migration test runs up, down and up again in CI
