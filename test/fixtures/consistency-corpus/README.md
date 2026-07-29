# Consistency corpus

> **Running the skill? Stop reading.** Run `npm run corpus` from the repository root and
> follow the steps it prints. The rest of this file, and `expected.json` beside it, name the
> conflicts the corpus contains — reading either makes your session useless for scoring.

14 ADRs whose conflicts are labelled in `expected.json`. It exists to score
`aif-adr-check-consistency`, which is a skill: no unit test can judge it, so a person runs it
against a corpus whose answers are known and compares.

The answer sheet is printed by `npm run corpus -- --key`, and lives nowhere else a runner
would stumble into it.

## The protocol

1. `npm run corpus` — builds a throwaway project pointed at this corpus, checks the corpus is
   clean, prints the path and the steps.
2. Open a **new** session in the printed directory. Not in this repository: the `adr`
   subcommand exists only in a project that installed the extension, and this repository has
   no ADRs of its own. A session that has read this file or `expected.json` cannot score.
3. `/aif-adr-check-consistency` there.
4. `npm run corpus -- --key` back in the repository, and compare.

Pass: every labelled contradiction named, and no same-area pair called a contradiction. Fail:
a contradiction missed — the metric that matters, since a missed conflict is the pain the whole
feature exists to remove — or a same-area pair reported as one. The follow-up is scored too:
it differs by the statuses of the pair.

Run it 3 times, in 3 separate sessions, and record the spread; a single run proves nothing
either way. Then 1 smoke run on the other supported runtime. Delete the temp directory after.

## Maintaining the corpus

`npm test` does not touch this directory. It is checked in because a manual run happens more
than once and the labels are reviewed by eye — a temp directory built by a test helper serves
neither purpose. Every other fixture here is built in code by `test/helpers.js`, which is the
right shape for anything a test can assert on its own.

Clean by construction: `ai-factory adr decisions` reports zero `issues` and
`ai-factory adr validate` passes on all 14 files. Keep it that way — the skill stops on
`issues`, so a defect planted here blocks the run it is meant to measure. `npm run corpus`
checks this before printing anything.

Paths printed by `adr decisions` in the temp project climb out of it with `../`, because the
ADR root sits outside the project. Only this fixture arrangement does that.

What the corpus is built to exercise, without naming which ADRs are which — that is in
`expected.json`, and reading it costs you a scoring session:

- one contradicting pair per follow-up branch, so all 3 branches are covered;
- one contradicting pair sharing no vocabulary at all, which a prefilter matching words would
  miss and which is why the skill reads the whole digest in 1 pass instead;
- one redundant pair, where an ADR obliges nothing another does not;
- two pairs ruling one area without conflicting: a `contradiction` verdict on either is a false
  positive, and catching those is half of what the run measures.
