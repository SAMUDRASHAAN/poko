# ADR-0007: Node types are a root-only tooling dependency

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The Phase 1 fuzz and level-generation tools run in Node and must be typechecked in
Phase 0. Without Node's ambient types, calls such as `process.exit` and access to
environment variables are unchecked or fail compilation. The engine itself must
retain zero runtime dependencies under INV-1.

## Decision

Add `@types/node` as a root development dependency and enable it only in tooling
TypeScript configurations. `packages/engine` continues to declare `types: []` and
has no runtime or development dependencies of its own.

## Consequences

- Node tools participate in `pnpm typecheck` instead of silently escaping CI.
- Node globals cannot leak into the engine through ambient types.
- The lockfile gains a development-only package; runtime bundles are unchanged.

## Alternatives considered

- **Leave tools untyped** — rejected because the original fuzz harness already
  referenced contract fields that did not exist, and CI failed to notice.
- **Enable Node types globally** — rejected because it would weaken the engine's
  headless boundary and make accidental Node API usage typecheck successfully.
