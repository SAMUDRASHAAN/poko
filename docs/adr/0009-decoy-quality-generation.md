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

| Band        | Generation (mean / worst) | Refill (aggregate) |
| ----------- | ------------------------- | ------------------ |
| sprout      | 66.0% / 60.0%             | 64.9%              |
| adventurer  | 69.3% / 60.0%             | 67.4%              |
| challenger  | 73.4% / 60.0%             | 71.7%              |
| trailblazer | 68.8% / 60.0%             | 68.0%              |
| pathfinder  | 69.5% / 60.0%             | 68.6%              |

**Generation meets the rule on every board.** Refill is deliberately weaker: it
controls only the incoming tiles and the choice of target, so it is asserted in
aggregate with a per-refill floor that catches a collapse. Making it per-board
would mean rewriting tiles the child did not clear.

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
