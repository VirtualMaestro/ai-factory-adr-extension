---
id: adr-schema-migrations-forward
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [database]
supersedes: []
code: []
---

# Migrations are forward-only

## Context

problem:
- a down script written months ago drops a column that later data depends on

constraints:
- a released migration is never edited in place

decision_drivers:
- recovery paths that are exercised, over paths that are written and never run

## Decision

decision: every schema migration ships as a forward step, and rollback happens by writing the next forward step

scope:
- the migration directory of the orders database
- excludes: seed data for local development

rules:
1. a migration file carries an up step and no down step
2. a mistake in a released migration is corrected by a new migration

## Alternatives considered

alternatives:
- id: Paired up and down scripts
  description: every migration ships a matching reverse script
  rejected_because: the reverse script runs once a year and is wrong when it does

## Consequences

positive:
- the recovery path is the same path used on every deploy

negative:
- an unwanted change stays in history as 2 migrations

risks:
- a destructive forward step has no undo -> the review checklist rejects column drops in the same release that stops writing them
