---
id: adr-config-env-vars
type: adr
status: accepted
owners: [fixture]
depends_on: []
affects: [config]
supersedes: []
code: []
---

# Configuration arrives as environment variables

## Context

problem:
- a config file baked into the image forces a rebuild to change 1 value per environment

constraints:
- a secret never reaches the image or the repository

decision_drivers:
- what has to be rebuilt when a setting changes

## Decision

decision: every runtime setting is read from an environment variable at process start

scope:
- runtime settings of every service process
- excludes: build-time settings, which stay in the build files

rules:
1. a setting is read at process start and never re-read afterwards
2. a process refuses to start when a setting without a default is absent

## Alternatives considered

alternatives:
- id: Config file per environment
  description: a checked-in file per environment, selected at start
  rejected_because: a secret in the repository is a secret leaked to everyone with read access

## Consequences

positive:
- a setting changes with a restart and no rebuild

negative:
- a setting change costs a restart

risks:
- a typo in a name is found at start -> the process names the absent setting and exits
