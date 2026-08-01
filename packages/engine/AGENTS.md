# packages/engine

Pure TypeScript. Zero dependencies. No UI imports. Ever. [INV-1]

- Every exported function is pure and deterministic. Same inputs, same outputs, always.
- New behaviour in generator, solver or refill needs a `fast-check` property test.
  Example-based tests alone are not sufficient for those three.
- Never change `types.ts` or the signatures in `index.ts` without an ADR. They are frozen.
- `analyse()` must stay under 5ms on an 8x8 board. There is a test asserting it.
- If you reach for `Math.random()`, `Date.now()`, `fetch`, `window` or an import,
  you are writing this code in the wrong package. See ARCHITECTURE.md section 6.
