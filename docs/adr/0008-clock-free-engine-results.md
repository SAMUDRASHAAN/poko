# ADR-0008: Timing and timestamps stay outside engine results

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The Phase 0 contract placed `analysedInMs` on `Analysis` and `checkedAt` on a
generated puzzle's validation record. Producing either value would require the
engine to read a clock, conflicting with the pure deterministic reducer and
generation model in INV-3 and INV-5.

## Decision

Remove wall-clock duration and timestamp fields from engine-owned return types.
The fuzz harness and performance tests measure `analyse()` externally. The
level-generation CLI may attach artifact timestamps after the pure engine call,
outside `packages/engine`.

## Consequences

- Identical engine inputs continue to produce byte-identical outputs.
- Performance budgets remain enforceable without contaminating the result.
- Content artifact metadata needs a tooling-owned wrapper rather than living in
  `PuzzleSeed`.

## Alternatives considered

- **Return elapsed time from `analyse()`** — rejected because output would vary by
  device load and platform.
- **Inject a clock into the engine** — deterministic under a fake clock, but adds
  complexity solely to return metadata that callers can measure directly.
