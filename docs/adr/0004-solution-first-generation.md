# ADR-0004: Solution-first generation with solution-aware refill

- **Status:** Accepted
- **Date:** 2026-08-01

## Context

The design requires the target to change after every successful move AND that an
impossible target is never presented. Together these mean the system is not
generating a level once — it is regenerating a provably solvable puzzle after
every match, on-device, inside an animation frame budget. A precomputed level
pack cannot satisfy this.

## Decision

Never pick a target then search for a solution. Instead: choose the operation and
operands first, compute the result, and use that as the target. Place the
guaranteed solution on the board, then fill with decoys, then validate and tune.

On refill, apply a three-layer safety chain, in order:

1. seed a guaranteed solution into the incoming tiles
2. repair (mutate at most 2 tiles) if validation still finds none
3. full `tideShuffle`, solution guaranteed, dressed as a story beat

## Consequences

- INV-6 becomes structural: an impossible target cannot be constructed.
- Requires a solver fast enough to run inside a refill — budget 5ms on an 8x8.
- Decoy quality becomes a first-class concern: 60% of decoy pairs must evaluate
  within +/-3 of the target, or children pattern-match instead of calculating and
  the game silently stops teaching while all tests still pass.
- **Cost:** generation is more complex than random-and-check, and the safety
  chain must never be reordered or thinned.

## Alternatives considered

- **Random target, then search** — produces impossible targets, which is the one
  failure a six-year-old cannot diagnose or recover from.
- **Precomputed level packs** — incompatible with a target that changes on every
  solve.
