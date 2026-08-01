---
paths:
  - 'packages/engine/**/*.ts'
---

# Engine rules

`packages/engine` is the correctness core. Everything here is pure, deterministic
and headless. [INV-1, INV-5]

## Absolute

- No imports. Standard library only. Not React, not our other packages, not `node:*`.
- No `Math.random()`, no `Date.now()`, no `fetch`, no `window`, no `console.log`.
- Every gameplay value is a `Num`. Never a raw `number`, never a float. [INV-4]
- Randomness comes from a `Rng` passed in as a parameter, never created ad hoc
  inside a helper — the caller owns the seed.

## Testing

- `fast-check` property tests are mandatory for `generator`, `solver` and `refill`.
  Example tests alone do not establish INV-6.
- Golden-seed tests pin generation output. A changed snapshot means you changed
  every existing level — that is a breaking change requiring an ADR, not a fix.
- `analyse()` has a performance assertion: under 5ms on an 8x8 board.

## Order of construction

Write `solver` and its tests BEFORE `generator`. You cannot verify a generator
without a solver to check it with.

## The safety chain in refill

`refill.ts` guarantees INV-6 through three layers, in this order:

1. seed a guaranteed solution into the incoming tiles
2. repair (mutate <= 2 tiles) if validation still finds none
3. full `tideShuffle` as the last resort, solution guaranteed

Never remove a layer. Never reorder them.

## Decoy quality

60% of decoy pairs must evaluate within +/-3 of the target. Weak decoys let a
child pattern-match instead of calculating, which quietly destroys the teaching
value while every test still passes.
