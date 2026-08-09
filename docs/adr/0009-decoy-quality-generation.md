# ADR-0009: Decoy quality is generated, not hoped for

- **Status:** Accepted
- **Date:** 2026-08-03
- **Supersedes nothing. Extends:** ADR-0004 (solution-first generation)

## Context

ADR-0004 calls decoy quality "a first-class concern" and requires that **60% of
decoy pairs evaluate within ±3 of the target**. The same rule appears in
`docs/02-content-spec.md` and `.claude/rules/engine.md`.

Phase 1 never implemented it. `randomTile` picked filler values uniformly from
`band.numberRange`, with nothing pulling them toward the target, and
`validatePuzzle` checked only solvability and solution counts. Measured over 300
boards per band:

| Band        | Decoys within ±3 | Required |
| ----------- | ---------------- | -------- |
| sprout      | 33.0%            | 60%      |
| adventurer  | 22.1%            | 60%      |
| challenger  | 19.3%            | 60%      |
| trailblazer | 15.1%            | 60%      |
| pathfinder  | 11.3%            | 60%      |

Quality degraded as bands got harder: wider `numberRange` and `maxTarget` scatter
uniform fillers further from the target. The children doing the most advanced
arithmetic got the weakest decoys — visual elimination replacing calculation
exactly where calculation matters most.

Gate 1 was green throughout. This is the failure `.claude/rules/engine.md`
predicts: _"quietly destroys the teaching value while every test still passes."_

## Decision

**1. Decoys are constructed, not sampled.** The target is chosen before the fill.
Cells are filled in reading order, and each is steered to form a near miss with
neighbours already placed, inheriting their colour and operation.

**2. Near, never on.** Offsets exclude 0. A decoy landing exactly on the target is
an accidental solution, not a decoy.

**3. Only chainable pairs count.** `validateChain` rejects colour mismatches, so a
differently-coloured neighbour is not a decoy — a child cannot select it at all.
The denominator is adjacent same-colour pairs whose result is not the target,
measured in reading order (`sub` and `div` are not commutative, so the reverse
selection is a different equation).

**4. Colour runs are capped** at `MAX_STEERED_RUN = 3`. A decoy needs a same-colour
_pair_, not a blob. Uncapped steering grew large single-colour regions, and since
any path through such a region is a legal chain, the count of chains hitting the
target exploded. One seed produced an entire board of 3s with target 9: every pair
was a solution, there were no decoys at all, and the solver found 370 chains
against a ceiling of 6.

**5. Refill fits the target to the survivors.** A refill picks a new target while
most tiles remain — tiles tuned as decoys for the _previous_ target. Rather than
rewrite tiles under the child's fingers, `rankTargetsForBoard` scores every legal
target against the surviving board with a prefix-summed histogram and returns them
ranked; refill takes the best one the band can actually build a solution for.

**6. The rule is enforced at runtime.** `validatePuzzle` gains a `weakDecoys`
reason, with a floor on the number of chainable pairs so the ratio cannot be
satisfied by a board that has almost none.

## Consequences

**This is a breaking change to generation.** Rng consumption order changed, so
every existing seed produces a different board. The golden-seed snapshot was
regenerated deliberately. Any level seeds already distributed are invalid.

Measured after, over 300 boards per band:

| Band        | Generation (mean) | Refill (aggregate) |
| ----------- | ----------------- | ------------------ |
| sprout      | 66.0%             | 64.9%              |
| adventurer  | 69.3%             | 67.4%              |
| challenger  | 73.4%             | 71.7%              |
| trailblazer | 68.8%             | 68.0%              |
| pathfinder  | 69.5%             | 68.6%              |

### The guarantee has two tiers

They must not be conflated, and each is asserted at its own strength:

| Path           | Guarantee       | Why                                                                          |
| -------------- | --------------- | ---------------------------------------------------------------------------- |
| `generatePack` | **absolute**    | `validatePuzzle` rejects `weakDecoys` and the generator retries the seed     |
| `createLevel`  | **statistical** | the tune loop is best-of-`DECOY_TUNE_ATTEMPTS`; it returns the best it found |

**Every child-facing level comes from `generatePack`**, so the product carries the
absolute guarantee. Measured: 0 of 1,000 shipped puzzles below the bar.

`createLevel` on an arbitrary seed does not. Measured over a deterministic
20,000-seed sweep: mean 66.2%, 2 seeds below the bar (0.010%), floor 58.0%.

**Consequence.** Any future child-facing use of arbitrary seeds — an endless mode,
a daily challenge, a practice generator — must route through `generatePack` or
apply `validatePuzzle` itself. Calling `createLevel` directly inherits only the
statistical guarantee, and roughly one seed in five thousand will show a child a
board below the teaching bar.

Refill is weaker again, deliberately: it controls only the incoming tiles and the
choice of target, so it is asserted in aggregate with a per-refill floor that
catches a collapse. Making it per-board would mean rewriting tiles the child did
not clear.

### Note on the original wording, kept deliberately

This ADR first claimed "Generation meets the rule on every board", and the test
suite asserted that as a `fast-check` property over arbitrary seeds on
`createLevel`. Both were overstated: an absolute claim on a best-effort path.
Fast-check correctly falsified it in CI at 0.594 after 109 runs.

The fix was to match each assertion to its guarantee, **not** to make `createLevel`
validate-and-retry — that would change rng consumption order, silently regenerate
every existing level and break every golden seed.

This note stays so a later session does not "simplify" the statistical sweep back
into an absolute property. It would pass locally, and fail in CI eventually, which
is the worst of both.

**The fuzz gate got slower** — 100k boards went from ~16s to ~150s. Decoy scanning
evaluates every adjacent pair many times per generated level. `chainResult` was
added to `equation.ts` to do arithmetic without building the display strings
`evaluateChain` produces, which recovered a large part of that; the rest is the
cost of measuring the property at all. Well inside the 20-minute CI job timeout.

**Known, not fixed here:** `createInitialState` does not enforce
`band.maxSolutions` — only `generatePackInternal` does, via its retry loop. Boards
exceeding the ceiling predate this change (main already exceeded it on 88% of
sprout boards, peak 76 solutions), but steering amplifies the peaks (to ~779 on
trailblazer) because same-colour neighbours create more chains. Levels shipped
through `generatePack` are validated and unaffected. Enforcing the ceiling inside
`createInitialState` needs an `analyse()` per attempt, whose cost against the fuzz
gate should be weighed on its own.

### Resolved — enforced at the call site, not in the generator

That weighing was done. Measured over 2,000 seeds per band, the share of
`createInitialState` boards at or under the ceiling:

| Band        | Ceiling | Within it | Median solutions |
| ----------- | ------: | --------: | ---------------: |
| sprout      |       4 |      3.3% |               14 |
| adventurer  |       5 |     34.3% |                6 |
| challenger  |       5 |     52.8% |                5 |
| trailblazer |       6 |     20.2% |               18 |
| pathfinder  |       8 |     44.0% |               10 |

**The generator cannot enforce it at acceptable cost.** Its tune loop is best-of-12,
so at sprout's 3.3% it would find a compliant board only 32.7% of the time; ~137
attempts are needed for 99%, each carrying an `analyse()`. Worse, re-rolling changes
rng consumption order, which regenerates every existing level — breaking the golden
snapshot, `packages/content`'s byte-identical reproduction test, and all 250
committed pack seeds. That is a breaking change, and it buys nothing the call site
cannot buy more cheaply.

**It did not need to be.** `maxSolutions` is a difficulty ceiling, not a
correctness one — solvability is structurally guaranteed by the planted solution
pair, which is what INV-6 and the fuzz gate protect. A board over the ceiling is
too easy, not broken.

The one live path that skipped validation was the `equationShuffle` power-up
(`machine.ts`), which rebuilt the board straight from `createInitialState`. It now
validates and redraws, exactly as `generatePackInternal` does, bounded at 512 draws
and failing open. Measured cost: 2–31 draws on average by band, worst observed 203
draws / 29 ms, and 0 of 2,000 trials reached the cap. `machine.spec.ts` sweeps all
five bands so the loop cannot be removed silently.

**Why this was invisible:** nothing measured the ceiling. The fuzz gate checks
solvability and stuck-ness only, and it draws its boards from `generatePack`, which
validates — so no green build was ever going to catch it. Same shape as the decoy
defect this ADR exists for.

## Alternatives considered

- **Validation without generation.** Rejecting weak boards in `validatePuzzle`
  alone. Rejected: uniform fill satisfies the rule so rarely that
  `generatePackInternal` would exhaust its 512-attempt budget and fail outright.
- **Rewriting survivors on refill.** Would give a per-board guarantee after
  refills. Rejected: it erases the board the child was reasoning about.
- **Lowering the steering rate to control solution counts.** Measured at 50%, 65%
  and 85%: solution counts barely moved (peak 1274 at 50%) while decoy quality
  fell below the rule. The driver is same-colour region size, not steering rate —
  hence the run cap.
