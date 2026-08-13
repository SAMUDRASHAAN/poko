# Phase 0 — setup checklist

Tick these before any feature code is written. Order matters: guardrails must
exist before the code they guard.

## Repo

- [x] pnpm workspaces + Turborepo
- [x] `tsconfig.base.json` — strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [x] Prettier + ESLint flat config
- [x] commitlint with a scope allowlist
- [x] husky: `pre-commit` (lint-staged), `commit-msg` (commitlint)
- [x] `pnpm install` run once with pnpm 9.12.0; lockfile generated and committed

## Guardrails (these are the point of Phase 0)

- [x] `.dependency-cruiser.js` — written BEFORE the engine has code, so INV-1 can never be broken once
- [x] ESLint rules: hex literals, `Math.random`, `Date.now`, browser storage, deep imports
- [x] Vitest coverage thresholds: engine 90% lines / 90% functions / 85% branches
- [x] `ci.yml` — frozen install, typecheck, lint, format, depcruise, test, knip, forbidden-SDK audit
- [x] `verify:gate1` adds the 100k-board fuzz gate once Phase 1 replaces the frozen stubs
- [x] `.claude/hooks/` — post-edit lint+typecheck, pre-bash danger block
- [x] `.claude/settings.json` permissions deny-list

## Context layer

- [x] `AGENTS.md` (under 200 lines) + `CLAUDE.md` importing it
- [x] Nested `packages/engine/AGENTS.md` for Codex
- [x] `.claude/rules/` — engine, board-render, screens, backend, ui-components
- [x] `.claude/agents/engine-reviewer.md`
- [x] `ARCHITECTURE.md` with 15 numbered invariants
- [x] `docs/adr/0001`–`0008` + template
- [x] `docs/WORKTREE-PLAN.md`
- [x] Canonical product, experience, content, and build specs in `docs/00`–`03`

## Contract Freeze

- [x] `packages/engine/src/types.ts` — complete, frozen
- [x] `packages/engine/src/index.ts` — signatures frozen, bodies throw `NotImplementedError`
- [x] `packages/ui/src/tokens.ts` — complete, frozen
- [x] `num.ts` + `rng.ts` implemented and tested (20 tests, incl. property tests)
- [x] Golden-seed test pinned
- [x] Public API surface test pinned

## Not yet done — your next actions

- [x] `git init` on `main` + local Phase 0 baseline commit
- [x] Configure the remote, push, and enable branch protection on `main`
      — `SAMUDRASHAAN/poko`; `main` requires PRs with `verify` + `commit messages` + `fuzz`, strict, linear history, admin enforcement on (verified: a direct
      push is rejected with GH006)
- [ ] Configure authenticated managed-device-lab access and pin two qualifying
      low-end Android model/API pairs per ADR-0010
- [ ] Run the 3-day `rive-react-native` spike (gates ADR-0001)
      — **provisional physical pass, no verdict.** Legacy and Nitro runtimes build,
      render, and survive the stress harness on the available 7.2 GiB Snapdragon
      695 phone (`spikes/rive-spike/RESULTS.md`). Nitro removes the legacy
      event-emitter incompatibility, but its sustained p95 reached 17 ms. Repeat
      on both qualifying managed physical models; a `.riv` rig is still outstanding.
- [ ] Book Indian privacy counsel for the DPDP consent flow
- [ ] Trademark search: "Poko's World" / "Sumlings" (Classes 9 and 41)
- [x] Create the two Phase 1 worktrees
      — `wt/engine` and `wt/verify` were created from green `main`, carried Phase 1,
      and were retired at the gate per `WORKTREE-PLAN.md` §12. The Phase 2 pair
      (`wt/board`, `wt/ui`) now exists in their place.

## Exit gate

- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm verify` green on a repo with no Phase 1 feature code (2026-08-02)

Phase 1 may start after the owner-controlled Rive decision and remote/worktree setup above.

> **What actually happened, recorded so the gap is visible rather than implied.**
>
> Phase 1 ran and completed **without** the Rive decision, and Gate 1 is green. That
> was defensible: `packages/engine` imports nothing and is the least
> framework-exposed work in the plan. It was not free — ADR-0001 states that if the
> spike fails, the shared TypeScript engine is lost along with it.
>
> Phase 2 does **not** get the same latitude. `wt/board` is Skia and Reanimated, and
> is discarded outright if ADR-0001 reverses. Authenticated access to the two-model
> managed physical-device profile is now the single highest-value unblock: it
> gates the spike, the spike gates ADR-0001, and ADR-0001 gates whether Phase 2 is
> React Native at all.
