# ADR-0003: All gameplay values use an exact rational `Num` type

- **Status:** Accepted
- **Date:** 2026-08-01

## Context

v1 uses integers only (addition and positive subtraction, 1-10). Expert mode in
v3 requires fractions, decimals and percentages. IEEE-754 floats cannot represent
those exactly: `0.1 + 0.2 !== 0.3`. In a maths app, that means marking a correct
child answer wrong — the most damaging possible defect for this product.

## Decision

Define `Num = { n: number; d: number }` (always reduced, sign on the numerator)
in `num.ts`, with `add`/`sub`/`mul`/`div`/`eq` and exact-division helpers. Every
engine signature takes `Num` from Phase 0, even though v1 only ever produces
integers.

## Consequences

- Cost today: near zero. `int(7)` instead of `7`.
- Cost avoided later: retrofitting would touch every signature in the engine and
  carry regression risk in the one place a maths app cannot afford it.
- Exact division (`dividesExactly`) is expressible, which bands 1-4 require.
- **Cost:** slightly noisier arithmetic at call sites, and a `toNumber()` escape
  hatch that must never be used for game rules — only for layout and rendering.

## Alternatives considered

- **`number` now, refactor later** — the migration lands exactly when the maths
  gets hard, which is the worst possible time.
- **A bignum library** — violates ADR-0002 (zero dependencies), and 53-bit
  integers are far beyond what an 8x8 board of 1-20 tiles requires.
