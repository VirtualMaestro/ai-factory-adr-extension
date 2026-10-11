---
id: plan-example
type: plan
status: in_progress
depends_on: [adr-example]
implements: [adr-example]
format: cnlp-plan
---

# Implement the example decision

## Original Request

goal: add the example export and its regression test

## Tasks

tasks:
- [ ] T1: add the example export
- [ ] T2: test the example export

task_details:
- id: T1
  files: src/example.js
  change: add the example export using the existing module
  acceptance: return the value the linked decision requires
  verification: run `npm test`
- id: T2
  files: test/example.test.js
  change: add a test of the exported value
  acceptance: prevent a missing or incorrect exported value
  verification: run `npm test`
  depends_on: T1

## Verification

verification:
1. run `npm test`
2. run `ai-factory adr status --check`
