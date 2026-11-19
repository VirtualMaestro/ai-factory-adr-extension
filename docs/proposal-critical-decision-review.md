# Proposal — can the ADR review reject a decision, not only polish it?

Written 2026-11-17, rewritten 2026-11-18 after the reviews of §6. A request from the operator, the analysis that answers it, and the plan to measure and fix it.
This is a proposal, not a governed artifact. It is prose and deliberately not CNL-P.

**Status: request and plan; nothing implemented.** §6 records the reviews of the first version; §3–§5 follow them.

---

## 1. The request

The operator's words, verbatim:

> такой вопрос - вот агент предлагает adr proposal. Потом запускается ревью другими моделями моделями. Меня
> интересует насколько они критически делают ревью? Я имею ввиду, они отшлифовывают детали предложенного proposal
> или же они могут увидеть, что этот proposal в корне, концептуально неверный и нужно решать заданную задачу совсем
> другим образом либо эта задача не имеет решения в данном контексте?
> Можешь проанализировать промпт ревью для proposal?

In English: an Author proposes an ADR, then reviewers of other models check it. Do they only polish the details of
the proposal, or can they see that it is wrong at the root — that the task needs a different approach, or has no
solution in this context? Analyse the review prompt for a proposal.

The follow-ups asked how to start and how to check it, and then to rewrite this document by its reviews; the answer is §4.

## 2. What the reviewer receives today

`adr-auto-plan` reviews each ADR in rounds (steps 9–17). The prompt of 1 review is assembled by `begin()` in
`src/review.js` from 4 parts, in this order:

1. **The brief**, written by the orchestrating session (step 9): the ADR id, what this round changed, and the
   Author's contested picks, each as a claim to verify.
2. **Files under review**: the ADR file only.
3. **The rubric** (`--rubric adr`): the `quality_rules:` block of `skills/adr-improve/SKILL.md`, prefixed with
   "Judge the ADR by these rules of adr-improve".
4. **The contract** (`CONTRACT` in `src/review.js`): read-only; every claim of the writer is to be verified against
   the code; a severity scale; JSON only.

The answer follows `RESULT_SCHEMA`: `findings[]` with `severity`, `file`, `line`, `claim`, `evidence`, `verified`;
`checked[]`; and a free-text `verdict`.

The session then triages each finding (step 13): confirmed, rejected, disputed, or principled by
`principled_questions:`. Confirmed and disputed findings go back to the same Author (step 15). A confirmed finding at
or above `escalate_at` starts a fresh Reviewer_2 (step 16). The ADR converges when the checks pass and no confirmed
finding at or above `medium` remains (step 17). Once every ADR converged or parked, a Reviewer_2 reads the whole batch
for contradictions between ADRs (step 18).

Both reviewer roles default to `runtime: subagent`; "another model" holds only when the project configures a
CLI role (§3.3, item 7).

## 3. Analysis

### 3.1 Answer

The setup makes polish the likely outcome. That the models cannot do more is not shown. A reviewer can find a flaw
inside the frame the Author chose — "the rejected alternative B is the better one" — but the review neither shows it
the task nor asks it to question the frame. A root finding that does come in passes through triage by the session
alone, and the operator does not see a rejected one before accepting the ADR (§3.3, item 2).

One counter-example: asked to judge this document at every level, with `rethink` and `reject` allowed, both
reviewers of §6 went to its root. That is 1 example, not a measurement.

### 3.2 Where root-level criticism is possible

The rubric gives the reviewer hooks: "reject each alternative in its strongest version", "if only 1 approach is
viable, say so and why the others are not", "no ground named, no recommendation", "cite the concrete rule, ADR,
architecture document, or code location". A weak alternative, an ungrounded recommendation or a broken invariant is
in reach. All of them stay within the options the Author put on the table.

The schema does not block a root finding: `line` accepts `null` (`src/review.js:35`), `verdict` is free text that
can say "reject", and high already covers "a broken requirement" (`src/review.js:93`). The pipeline has exits: the
session drops a topic whose preconditions fail (step 6), `adr-propose` stops on a duplicate
(`skills/adr-propose/SKILL.md:62`), and the operator can reject a draft (step 22).

### 3.3 What works against it

Shown in the code (`S` = `skills/adr-auto-plan/SKILL.md`):

1. **The reviewer does not see the task.** The brief of step 9 (`S:74`) carries the ADR id, what the round changed
   and the contested picks; no topic, no words of the operator, no answer the operator gave at step 21. On a file
   route (`S:43`) no request exists at all. The reviewer judges the ADR against its own `## Context`.
2. **A rejected root finding reaches the operator only after the push.** At step 20 (`S:85`) the operator sees each
   draft's `decision:`, its minor picks and its unsettled mark. The rejected findings appear in the report of step 43
   (`S:108`), after the commit (step 39) and the push (step 40). Accepting is the decision itself (`S:51`). The
   operator stop is the designed root gate, and it does not see what the session dismissed.
3. **The session triages alone.** Step 13 (`S:78`) decides each finding under "do not ask a minor question"
   (`S:49`); a confirmed or disputed one goes back to the Author who wrote the ADR (`S:80`). `principled_questions:`
   (`S:17-23`) has no class for "the approach is wrong" or "there is no solution here".
4. **The first review comes after an improve round.** Steps 6 and 7 write and polish the ADR before step 9 reviews
   it. No reviewer applies the `preconditions:` of `adr-propose` (`skills/adr-propose/SKILL.md:16-19`), the repo's own
   test of whether an ADR should exist: the rubric is `quality_rules:` of `adr-improve` only (`src/review.js:71-72`).
5. **`adr-propose` cannot say "no".** It stops on failed preconditions and on a duplicate
   (`skills/adr-propose/SKILL.md:57`, `:62`), not on "no viable approach in this context" or "the code already does
   it". The template has no do-nothing alternative (`templates/adr.md:40-49`).
6. **The contract ties every finding to the code** (`src/review.js:90-91`). Impossibility or a better approach often
   rests on the request, a constraint, an API guarantee or an accepted ADR, not on a line of code: such a finding
   comes back `verified: false` and is weak in triage.
7. **The default reviewer is not another model.** `reviewer_1` and `reviewer_2` default to `runtime: subagent`
   (`src/config/adrConfig.js:52-53`), a subagent of the session's model. The operator's premise holds only with a
   configured CLI role.

Hypotheses, not shown, for §4 to test:

- **H1, anchor on the delta.** The brief names "what this round changed" (`S:74`), though the whole ADR is passed
  (`S:75`) and Reviewer_1 is fresh each round (`S:28`).
- **H2, anchor on the Author's frame.** The reviewer reads the Author's options before thinking of its own.
- **H3, compliance mode.** "Judge the ADR by these rules of adr-improve" (`src/review.js:72`) invites an audit of the
  rules, not of the decision.
- **H4, the rules arm the Author.** `adr-improve` rules "revise a recommendation only on a new fact" and
  "disagreement alone is not new information" (`skills/adr-improve/SKILL.md:61-62`) go to the reviewer verbatim and
  serve the Author in a dispute.
- **H5, convergence drives to clean.** An ADR converges when no confirmed finding at or above `medium` remains
  (`S:82`): the loop has no reason to stop a document.

### 3.4 Changes

**Group 1, without a measurement.** They change what information reaches whom, not what a reviewer judges, so they
add no false alarms:

- **C6.** At step 20, show each finding at `high` or above, and each root-level one, that the session rejected or
  decided in a dispute, with the reviewers' verdicts. It closes item 2.
- **C1.** Every brief carries the operator's request verbatim and the operator's answers so far. On a file route it
  states "no request on record", and the reviewer judges `problem:` against the code. It closes item 1.

**Group 2, each needs a measurement.** Each changes what a reviewer reports, and each false alarm costs the operator
a stop:

- **C0.** `adr-propose` gains 2 stops, "no viable approach in this context" and "the capability already exists",
  and the template gains a do-nothing alternative.
- **C2.** A frame review right after step 6, before step 7, over the whole ADR, with a rubric `frame`: is the problem
  real; can it be solved under the constraints and the accepted ADRs; is "do nothing" an option; is there an approach
  outside the Author's options; does the ADR meet the `preconditions:` of `adr-propose`. It repeats after a round that
  changes `decision:` or `scope:`.
- **C2b.** A blind second opinion: the reviewer reads the request and the code, writes its own approach in at most 3
  lines, then opens the ADR and compares.
- **C3.** A field `decision`, only with `--rubric adr`: `sound | revise | rethink | reject | insufficient`. The plan
  and implement reviews keep their schema; `resultProblems` validates the field; step 13 reads it.
- **C4.** The session does not reject a `rethink` or a `reject` alone: a fresh Reviewer_2 with the request reads it,
  and if either reviewer holds it, it goes to the operator as a principled question, a new class in
  `principled_questions:`.
- **C5.** The severity scale gains a line for decisions, such as "high: the decision does not solve the stated task".
  It clarifies what high already covers.
- **C7.** An evidence policy for a root finding: the request, a constraint, an accepted ADR, an API guarantee, or the
  code path that already solves the task. A finding says whether it shows a contradiction or only insufficient
  evidence.

## 4. Plan

### 4.1 Order

1. **This document.** Correct the analysis by the reviews of §6. Done in this revision.
2. **Pilot** (§4.2) on the current version, 6.0.3. It answers the operator's question where it was asked: at which
   stage, if any, does the pipeline stop a wrong decision?
3. **Group 1** (C1, C6), then the same pilot again: does the flaw now reach the operator at step 20?
4. **Measurement** (§4.3), only when the pilot shows a reviewer that had the information and missed the flaw.
5. **Group 2**, each change by the data of §4.3 and the rule of §4.4.

### 4.2 Pilot

A scratch project as `AGENTS.md` prescribes: `ai-factory init --agents claude,codex --config`,
`ai-factory extension add <this repo>`, `git init`. It holds code and a small accepted ADR corpus: an impossibility
that comes from the context needs an accepted ADR or a rule that forbids the only viable means.

3 topics:

| # | Topic | Determined by |
|---|---|---|
| P1 | Wrong problem: the topic assumes a cause; the code shows another | A stated requirement the assumed fix cannot meet, such as a bound on stale reads that a cache breaks |
| P2 | No solution in this context | An accepted ADR or rule that forbids the only means that meets the requirement |
| P3 | Control: a sound topic | A requirement the obvious approach meets |

A separate agent writes the topics, their requirements and the expected disposition of each. The key stays outside
the tree; neither the session that runs `adr-auto-plan` nor the one that scores sees it.

Each topic runs through `adr-auto-plan` from step 1 to the stop of step 19, with no acceptance. The config is pinned
and recorded. The operator chose cheaper models for the runs: the session runs `claude -p` with Sonnet at effort
medium, so the Author and Reviewer_2, both `subagent`, run on Sonnet too; `reviewer_1` is `codex-cli` with
`gpt-6.1-terra` medium. That gives a lower bound: a flaw these models catch the stronger ones likely catch as well,
not the reverse. A topic whose flaw the reviewers miss runs once more with `reviewer_1` on `gpt-6.1-sol` medium, to
separate the model from the setup. Claude Fable writes the fixture, since the traps decide whether the pilot means
anything. Per topic, record:

- which stage first named the root flaw — Author, Reviewer_1, Reviewer_2, batch read, or none;
- the disposition each stage gave: polish, rethink, reject;
- what triage did with it, and whether the flaw is visible to the operator at steps 19–20;
- the rounds, and each review that `end` did not count, apart.

A fresh session scores the records against the key.

Cost: 3 runs to step 19, then 3 more after group 1, each tens of minutes.

### 4.3 Measurement

Only when §4.2 points at the reviewer. It follows the protocol of `test/fixtures/consistency-corpus/README.md`: a
separate author of the traps, a hidden key, scoring in a separate session, 3 runs per cell.

- **Traps**, at least 4: wrong problem, no solution from the context, the capability already exists, the right
  approach outside the Author's family. Each states measurable requirements, so that its expected disposition is
  determined, and comes in 2 forms: the flaw visible from the ADR and the code, or only from the request.
- **Controls**, at least 3 sound ADRs, among them one with only 1 viable approach and one that rejects "do nothing"
  correctly.
- **Brief**: 1 fixed neutral template for every cell.
- **Variants**, 1 factor each: baseline; C1; C2; C2b; C3 where the scoring needs a disposition field.
- **Scoring**, 3 measures apart: diagnosis, the flaw named at `medium` or above; disposition, the reviewer recommends
  `rethink` or `reject`, not polish; validity, `end` counted the review.
- **Fixture** checked in with its key hidden, so that it reruns after a prompt change.
- **Cost**: 11 ADRs × 3 runs = 33 reviews per variant and model. The baseline runs with Sol and Fable; the variants
  with the model that missed more.

### 4.4 Decision

Each group 2 change is decided by its own variant: adopt it when it raises diagnosis and disposition on the traps,
and the false alarms on the controls do not rise over the baseline. Fix this rule before the first run. An adopted
change goes into `src/review.js`, `adr-auto-plan`, `adr-propose` and the tests, then a Sol review, and a Fable
review when Sol finds high or above.

### 4.5 Risks

- 3 topics show where the pipeline stops a flaw, not how often.
- The poisoned topics are made to be wrong; real wrong decisions may look different.
- At step 19 the run only presents; the operator's answer is not simulated.
- Agent-written traps may come out too obvious; the 2 forms of §4.3 and a separate author limit that.
- The pilot and the measurement together take several hours of model time.

## 5. Out of scope

- The plan review (`--rubric plan`): this request is about the decision.
- The code review of `adr-auto-implement`.

## 6. Reviews of this document

Both reviewers got the same prompt: judge the document at every level, the root included, with a verdict
`sound | revise | rethink | reject`. Each ran read-only and did not see the other's answer. Neither ran a model or a
command that writes. They reviewed the first version; the line numbers they cite refer to it. §3–§5 were rewritten by their findings,
after a check of each claim against the code.

### 6.1 Codex `gpt-6-astra` high — verdict `rethink`

- **High.** A "hit" is not a rejection: a reviewer can name the flaw and still recommend polish, and triage (step 13)
  can dismiss it. Score diagnosis, recommended disposition and the end outcome apart.
- **High.** The traps have no single right answer: a cache can cut p99 despite an N+1; T4 declares the outside
  approach right by fiat. Give each trap measurable requirements and fix the failure model of T2.
- **High.** C3 has only negative outcomes: no `sound`, no "insufficient evidence"; the schema is shared with the plan
  and implement reviews.
- **High.** Variant B changes 2 factors; repeating only borderline cells biases the sample; 1 control cannot measure
  specificity. Blind scoring, fixed repetitions, more controls.
- **High.** §3.3 overstates: the brief names the whole ADR, `line` accepts null, `verdict` can already say reject,
  high already covers a broken requirement. These are anchoring hypotheses, not shown incapacity.
- **Medium.** No evidence policy for root findings: impossibility often has no trace in the code. "No exit" ignores
  the operator's rejection (step 22) and the duplicate stop of `adr-propose`. A frame review must repeat after a
  decision change. The baseline ignores runs that `end` does not count.

### 6.2 Claude Fable high — verdict `revise`

The diagnosis holds; §4 needs a redesign.

- **Critical.** The experiment measures reviewer recall, not whether the pipeline stops a wrong decision: triage,
  the return to the Author, convergence and the operator stop are not exercised. Measure 2 layers: recall with a fixed
  neutral brief, and 2–3 end-to-end `adr-auto-plan` runs on poisoned topics plus 1 sound one, recording which stage
  stopped the ADR.
- **Critical.** Variant A's result is fixed by how each trap words its `problem:`. Write each trap in 2 forms, visible
  from the ADR and code or only from the request, or let a real Author write it from a poisoned topic.
- **High.** No statistical power: 8 trap and 2 control observations per variant. The repo's own protocol
  (`test/fixtures/consistency-corpus/README.md`) asks for 3 runs, scoring in a separate session, and a hidden key.
  At least 3 sound controls; about 100 reviews, not 30.
- **High.** The operator stop at step 20 is the designed root gate, and it is blind: rejected findings reach the
  operator only in the report of step 43, after the commit and the push. **C6**: show at step 20 each rejected or
  disputed finding at `high` or above, with the reviewers' verdicts.
- **High.** The Author stage is missing: the first review comes after an improve round, `adr-propose` has no outcome
  "no viable approach" or "the code already does it", the template has no do-nothing alternative, and no reviewer
  applies the `preconditions:` of `adr-propose`. **C0**: a propose stop for "no solution" and "do nothing"; frame
  review right after step 6, with those preconditions in its rubric.
- **High.** C2 keeps the anchor: the reviewer reads the Author's frame first. Test a blind second opinion: the
  reviewer writes its own approach from the task and the code, then opens the ADR.
- **Medium.** C3 as an enum on the shared schema breaks the implement review and `test/review.test.js`; use a field
  of the ADR rubric only, with `sound`. C4: the session must not reject a `rethink` alone; a fresh Reviewer_2 decides
  whether it goes to the operator. Two more blockers: `adr-improve` rules 61–62 arm the Author in a dispute, and
  `CONTRACT` ties every finding to the code. C1 is undefined on file routes and must carry the operator's answers. The
  default reviewer is a `subagent` of the same model, not another model.
- **Low.** The same overstatements in §3.3 as §6.1; T2 is textbook knowledge, so make its impossibility come from an
  accepted ADR in the fixture; T3 depends on whether `LIVE.md` lists the capability.

### 6.3 Comparison

Both went to the root of this document, not only its wording. Both found the same overstatements in §3.3 and the
same flaws in §4: the hit metric, the trap answers, the controls, and the factors of variant B. Astra said
`rethink`. Fable said `revise`. Fable added what Astra missed: a pipeline-level measurement, the blind operator stop
(C6), the Author stage (C0), the anchor in C2, the existing corpus protocol, and the default subagent reviewer.
Spot-checked against the code: the corpus README, the default `subagent` roles in `src/config/adrConfig.js`, the only
reader of `verdict` (`commands/adr.js:377`), and steps 39–43 of `adr-auto-plan`.

## 7. Pilot, 2026-11-18

Run on 6.0.3 by §4.2: the fixture `parcel-notify` (Node.js, 9 source files, 2 accepted ADRs) and its 3 topics by
Claude Fable, the key hidden from the running session; each topic in a fresh copy through `claude -p` with Sonnet
medium; `reviewer_1` as `codex-cli` `gpt-6.1-terra` medium; scored by a fresh Claude Fable session against the key.

| Topic | Trap | Expected | First stage that named the flaw | Outcome | Cost |
|---|---|---|---|---|---|
| B | no solution in this context: the full phone number for 90 days against `adr-keep-no-customer-contact-data` | reject | the session, before the Author | dropped, 3 options for the operator; hit | $0.16, 66 s |
| C | wrong problem: the webhook is already idempotent; the duplicates come from SmsGate retries on a 2 s timeout | rethink | the session, before the Author | dropped, a corrected topic proposed; hit | $0.22, 100 s |
| A | control: throttling in front of SmsGate | proceed | — | a sound ADR, no false alarm; unsettled at `max_rounds` | $3.35, 26 min |

### 7.1 What it shows

- With the flaw checkable from the request and a few files, the session's own reading stops it at step 6, before
  any Author: the exit of §3.2 works, on Sonnet.
- No reviewer saw a wrong-premise topic. §3.3 items 1–6 and H1–H5 stay untested; the condition of §4.1 item 4 is
  neither met nor refuted.
- On the sound topic the loop only adds: every verdict was "revise", `rules:` grew 15 → 24 → 40 → 45 → 46 (the
  accepted ADRs hold 5 and 6), and the run ended with 2 confirmed mediums open at the round cap. H5 has its first
  evidence.
- A round-3 high, "the decision does not meet the stated no-loss and two-minute requirements for all bursts", was
  rejected by the session and shown at the stop among the rejected findings, without the reviewer's verdict.

### 7.2 Defects of the pipeline the pilot found

1. **Triage reads only the claims.** `ai-factory adr review end` prints severity, file, line and claim, not the
   evidence (`commands/adr.js:376`); since 6.0.3 a counted review removes `.git/adr-auto/<id>/`, so `result.json` is
   gone when triage starts. Every round of A was triaged from 1-line claims; round 3 rejected 3 highs that way.
   Fixed in the tree, not released: `end` prints the evidence under each finding (`formatFindings` in
   `src/review.js`); the release waits for the second experiment.
2. **The brief has no writable place.** Step 9 writes it "outside the tree"; under `claude -p --permission-mode
   acceptEdits` a write outside the project or into `.git/` is refused, so the session wrote untracked files into the
   project root.
3. **A subagent review breaks its own bracket.** The session wrote the Reviewer_2 answer into the tree after `begin`,
   `end` refused it, and the retry ran `begin` after the review was done: the snapshot no longer covers the review.
4. **The brief paraphrased the request** and left out the premise sentence: C1 is needed in practice, not only in
   theory.

The harness had its own faults: the context-mode hook of the operator's machine truncated reads inside the runs, the
session ended its turn 3 times while waiting for the Author, and the review copies miss 3 `result.json` files.

### 7.3 Next

A trap the session cannot see before the Author starts: flawed ADRs fed straight to the review as in §4.3, a flaw
that arises only from the Author's design, or a determining fact deeper than the session's pre-read. A clean harness:
the hook off, a writable brief directory, triage from `result.json`, and 3 runs per cell.

## 8. Experiment 2, 2026-11-18: finished ADRs straight to the reviewers

Run on 6.0.3 by §4.3, scaled down. A Claude Fable agent wrote 11 ADRs on the `parcel-notify` fixture, each on its
own branch with its operator request: 4 trap types (W wrong problem, N no solution in context, E already exists, O
outside the frame), each in form X (provable from the ADR and the code) and form R (provable only with the request),
and 3 controls. Each ADR got 12 reviews through `ai-factory adr review --rubric adr`: brief V0 as step 9 writes it,
or V1 with the request verbatim (C1); Codex `gpt-6.1-terra` medium or Claude Sonnet medium; 3 runs. 132 of 132
counted; 5 Terra cells hit the Codex usage limit and ran again after it reset on 2026-11-21. A fresh Claude Fable session scored them against the key.

Diagnosis is a finding at `medium` or above that names the root flaw; disposition is a verdict that rejects the
decision or sends it back to be remade. "Partial" is the lenient band.

| Traps | n | Diagnosis | + partial | Disposition | + partial |
|---|---|---|---|---|---|
| V0 Sonnet | 24 | 9 | 15 | 7 | 12 |
| V0 Terra | 24 | 2 | 7 | 0 | 5 |
| V1 Sonnet | 24 | 17 | 24 | 11 | 23 |
| V1 Terra | 24 | 9 | 18 | 0 | 13 |

| Form R | n | Diagnosis | + partial | Disposition | + partial |
|---|---|---|---|---|---|
| V0 | 24 | 0 | 3 | 0 | 0 |
| V1 | 24 | 11 | 21 | 2 | 18 |

False alarms on the controls: 2 of 36, 9 with the partial band, all on 1 control whose request the ADR's own
`negative:` concedes it does not fully meet. 34 of 42 cells scored the same on every run.

### 8.1 What it shows

1. **Reviewers see more than their verdicts say.** A verdict opens with "Reject" in 5 of 94 trap cells, all Sonnet;
   "rethink" appears in none. Terra's verdict is a revise word in all 46 trap cells, even where its own high
   finding says the decision cannot meet the requirement. The gap is the disposition, not the diagnosis: C3 and C4.
2. **Without the request, form R is invisible.** 0 of 24 cells name the flaw without it; 11 of 24 fully and 21 of
   24 at least partly with it. C1 is measured, not only argued.
3. **The model matters more than the variant for disposition.** Sonnet 18 of 48 hits, Terra 0 of 46. Terra files the
   root fact as one high among local highs, gives 2–5 highs per review on controls too, and marks 0 of 302 findings
   unverified.
4. **"No solution" and "outside the frame" read as a missing alternative.** No cell of type N concludes that the task
   has no solution here; the reviewers ask for another alternative. For type O the omitted approach is named in 20 of
   24 cells, and no verdict sends the decision back for it. That is the rubric speaking: "present at least 2 viable
   approaches", not "is this the right approach".

### 8.2 What it does not show

- One fixture, one ADR per type and form: type and form are confounded with the case. 2 traps are not fully
  determined (L06 has a real side gap; type N may be stricter than a reviewer can reach).
- Disposition is read from free text by 1 scorer; the partial band is wide (33 of 94).
- Model is confounded with the harness: the context-mode MCP and hooks were active in Codex, off in Claude.
- Only round 1 of a hand-written ADR: triage, the Author's reply, later rounds and the operator stop are untested.
- C2, C2b, C3, C4, C5 and C7 were not run.

Score table and per-cell rows: the scratchpad `exp2/score.md` of the session, not checked in.

### 8.3 Next

- Group 1 is confirmed: C1 by §8.1 item 2, and C6 because a root finding under a "revise" verdict otherwise
  depends on triage alone.
- C3 is the next measured change: a `decision` field for `--rubric adr` on the same 11 cases, to see whether a
  reviewer that must pick `sound | revise | rethink | reject | insufficient` picks what its own findings say.
- The 5 Terra cells ran again on 2026-11-21 in the same harness; they change no reading.

## 9. Experiment 2, variant V2: C3, 2026-11-21

The 11 cases again, with brief V1 and C3 in the tree (not released): `--rubric adr` requires `decision` in
`sound | revise | rethink | reject | insufficient`, and the contract defines each value and adds "A finding that says
the decision cannot meet a requirement does not fit `revise`" (`DECISION_CONTRACT` in `src/review.js`). 66 of 66
counted; Terra in the same harness as V1. Scored by a fresh Claude Fable session.

| Traps sent back (`rethink` or `reject`) | V1 verdict | V2 `decision` |
|---|---|---|
| Sonnet | 11/24 | 23/24, 22 on the root flaw |
| Terra | 0/24 | 24/24, 11 on the root flaw |

| False alarms on controls | V1 | V2 |
|---|---|---|
| Sonnet (9) | 0 | 2, both on the contested control L03 |
| Terra (9) | 2 | 6 |

| `decision` | sound | revise | rethink | reject | insufficient |
|---|---|---|---|---|---|
| Sonnet, traps / controls | 0 / 0 | 1 / 7 | 20 / 2 | 3 / 0 | 0 / 0 |
| Terra, traps / controls | 0 / 0 | 0 / 3 | 24 / 6 | 0 / 0 | 0 / 0 |

### 9.1 What it shows

1. **C3 acts on disposition only.** Diagnosis is 26/48 in V1 and 28/48 in V2; sent back goes from 11/48 to 47/48.
2. **Sonnet: C3 helps at a small cost.** 22 of 24 traps go back on the root flaw; the controls get `revise` in 7 of 9.
3. **Terra: C3 overcorrects.** `rethink` in 30 of 33 cells; on 1 control the same 4 local highs gave "revise" in V0
   and V1 and give `rethink` in V2. 7 trap `rethink` rest on other findings than the root flaw.
4. **The mechanism is the "does not fit `revise`" line read literally, on top of Terra's severity inflation**: it
   writes 2.7 high+ findings per control review, Sonnet 1.2. C3 does not raise the severities.
5. **`reject` is not reached and `sound` is dead.** `reject` 3 of 66, none for type N; `sound` 0 of 66, since it asks
   for no finding at or above medium and every review has one; `insufficient` 0 of 66.

### 9.2 Next

V3 tests a reworded C3 on the same cases: `rethink` and `reject` judge the decision itself and cite the finding they
rest on; local defects, however severe, are `revise`; `sound` means the decision stands with at most local findings;
the "does not fit `revise`" line goes.

## 10. Variant V3: C3 reworded, 2026-11-21

The V2 line "does not fit `revise`" goes. The contract asks "would fixing your findings, with the approach kept, make
the decision meet the stated task?", calls a local defect `revise` however severe, lets `sound` allow low findings, and
asks `rethink` and `reject` to name the finding they rest on. 22 reviews, 1 run per cell: only the direction counts.

| Per model, 8 traps / 3 controls | V2, 3 runs | V3, 1 run |
|---|---|---|
| Sonnet: sent back, on the root flaw | 23/24, 22/24 | 6/8, 5/8 |
| Sonnet: false alarms | 2/9 | 0/3 |
| Terra: sent back, on the root flaw | 24/24, 11/24 | 5/8, 5/8 |
| Terra: false alarms | 6/9 | 1/3, on the contested L03 |

### 10.1 What it shows

1. **Terra's overcorrection is mostly gone.** Each of its 5 trap `rethink` rests on the root flaw (V2: 11 of 24); the
   control whose 4 local highs gave `rethink` 3 times in V2 is `revise`. Its 3 lost traps are honest misses: V2 had sent
   them back on other findings, and Terra never found their flaw. Its gap is diagnosis, which the contract does not
   touch.
2. **Sonnet keeps most of the gain with clean controls**, and its 2 losses show a hole in the V3 question. It names the
   root flaw at high and still answers "the approach stands": "0 is unreachable here" with `revise` (type N), and an
   alternative it calls "the strongest" with `revise` because the chosen one "can meet the task" (type O). "Can the
   approach meet the task" passes an approach when no approach can, or when another is clearly better.
3. `sound` and `insufficient` stay at 0 of 22; type N never reaches `reject`.

### 10.2 Next

V4 orders the question: can any approach meet the requirements under the constraints and the accepted ADRs (no:
`reject`); do the code or the accepted ADRs already solve the task (yes: `reject`); is another approach clearly better
by the stated requirements (yes: `rethink`); would the findings, fixed with the approach kept, meet the task (no:
`rethink`); otherwise `revise` or `sound`.

## 11. Variant V4: the ordered question, 2026-11-21, and the result

The contract asks in order, the first yes decides: no approach can meet the requirements → `reject`; the code or the
accepted ADRs already solve the task → `reject`; another approach is clearly better → `rethink`; the approach, its
findings fixed, still misses the task → `rethink`; otherwise `revise` or `sound` (`DECISION_CONTRACT` in
`src/review.js`). 22 reviews, 1 run per cell.

| Per model, 8 traps / 3 controls | V1 | V2, 3 runs | V3 | V4 |
|---|---|---|---|---|
| Sonnet: sent back / on the root flaw | 11/24 | 23/24, 22/24 | 6/8, 5/8 | 8/8, 7/8 |
| Sonnet: false alarms | 0/9 | 2/9 | 0/3 | 0/3 |
| Terra: sent back / on the root flaw | 0/24 | 24/24, 11/24 | 5/8, 5/8 | 6/8, 5/8 |
| Terra: false alarms | 2/9 | 6/9 | 1/3 | 1/3, the contested L03 |

### 11.1 What it shows

1. V4 closes Sonnet's 2 holes of V3: the type O verdict now reads "The chosen approach, polling, is weaker than
   callbacks. The decision rests on finding 1". All 4 cells that differ from V3 move toward the key.
2. Terra's overcorrection does not return: the control with 4 local highs stays `revise`.
3. `reject` for "no solution in this context" is never reached (0 of 20 over V2–V4): the reviewers see a way out
   through a platform change or a superseding ADR, and answer `rethink`. `sound` and `insufficient` stay at 0.
4. No contract variant moves diagnosis or severity: Terra finds the root flaw in 3 of 8 traps and writes 2.7 high+
   findings per control review.

### 11.2 Result

**Adopt C3 as V4, with C1 and C6.** Without the request a form-R flaw is invisible (§8); without a `decision` field a
named root flaw stays under a "revise" verdict (§8, §9); V2's literal line overcorrects (§9); V3's single question
passes an approach when another is clearly better (§10); V4 holds the gain of V2 for Sonnet and the precision of V3 for
Terra.

Open:
- 1 run per cell for V3 and V4: a direction, not a rate.
- 3 controls, 1 of them contested, cannot bound false alarms; `sound` is never picked.
- `reject` for type N: reword question 1 to "within the constraints, without changing the platform or an accepted
  ADR", or accept `rethink` there.
- The model matters: a CLI reviewer that finds the flaw in 3 of 8 traps gains little from any contract. The default
  `subagent` reviewer runs on the session's model.
- C4 (route a `rethink`/`reject` to the operator) and C6 (show rejected root findings at step 20) are not yet in the
  skills; triage in `adr-auto-plan` still has to read `decision`.

Data, keys, fixtures and score scripts: `C:\workspace\projects\AI\adr-review-experiments\` (outside the repo).

### 11.3 Release 6.0.4

In the tree: `formatFindings` (§7.2 item 1), C3 as V4, and C1, C4 and C6 in `adr-auto-plan` (steps 9, 13 and 20,
`principled_questions:`, `forbidden_behaviors:`). A Codex `gpt-6.1-sol` medium review found 1 medium: the rule for a
`rethink` or `reject` named "either reviewer" in one place and "Reviewer_2" in another, and step 16 escalates by
severity only. Fixed: triage confirms it, or a fresh Reviewer_2 reads it whatever the severity, and the ADR parks when
it holds. A targeted Sol medium review of the fix found nothing; no high, so no Fable round. `npm test` 242/242.
