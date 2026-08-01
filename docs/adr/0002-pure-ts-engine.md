# ADR-0002: The game engine is pure TypeScript with zero dependencies

- **Status:** Accepted
- **Date:** 2026-08-01

## Context

The engine must produce provably solvable puzzles. Puzzle correctness cannot be
established by playing the game; it needs exhaustive property testing at a scale
only a headless harness can reach. Historically, teams building this kind of game
embed rules in components, discover the generator produces unsolvable boards, and
bolt on hacks because the logic is no longer testable in isolation.

## Decision

`packages/engine` imports nothing outside the standard library — not React, not
React Native, not our other workspace packages, not any npm runtime dependency.
All game rules live there. Enforced by `.dependency-cruiser.js` and ESLint, so a
violation fails CI rather than relying on discipline.

## Consequences

- 100k-board fuzz runs execute in CI in seconds, with no device or emulator.
- The identical logic runs in the app, the web build, the levelgen CLI and tests.
- Scores are verifiable server-side by replaying an action log through the same
  pure reducer.
- **Cost:** some ceremony. Data must be passed in rather than reached for, and
  the engine cannot log, fetch, or read the clock. Time and randomness are
  parameters. This is the constraint doing its job, not friction to route around.

## Alternatives considered

- **Rules in React hooks** — untestable without a renderer, and unshareable with
  the web build and the CLI.
- **Engine with small utility deps (lodash, seedrandom)** — rejected. "Zero" is
  enforceable by a lint rule; "a few small ones" is a judgement call that erodes.
