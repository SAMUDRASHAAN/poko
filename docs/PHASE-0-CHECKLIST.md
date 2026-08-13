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
- [x] Configure authenticated managed-device-lab access and pin two qualifying
      low-end Android model/API pairs per ADR-0010
      — project `poko-device-lab-20260814` has billing disabled and the Testing
      and Tool Results APIs enabled. `docs/05-managed-device-profile.md` pins
      Galaxy A03s (`a03su`, API 33) and Galaxy A04s (`a04s`, API 34), both
      physical ARM64 devices marked `DEVICE_CAPACITY_LOW`. Both completed the
      no-cost Nitro functional smoke and controlled qualification.
- [x] Run the `rive-react-native` spike (gates ADR-0001)
      — **failed the frame contingency on both managed models.** Five controlled
      60 Hz iterations completed without crashes/restarts and below 113 MB PSS,
      but CPU P95 was 19.93 ms on A03s and 18.66 ms on A04s; overrun P95 was
      positive on both. ADR-0011 supersedes ADR-0001 and selects Flutter. Exact
      evidence is in `06-rive-spike-results.md`.
- [ ] Book Indian privacy counsel for the DPDP consent flow
- [ ] Trademark search: "Poko's World" / "Sumlings" (Classes 9 and 41)
- [x] Create the two Phase 1 worktrees
      — `wt/engine` and `wt/verify` were created from green `main`, carried Phase 1,
      and were retired at the gate. The original Phase 2 pair is frozen by
      ADR-0011 and must not supply production React Native code.

## Exit gate

- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm verify` green on a repo with no Phase 1 feature code (2026-08-02)

TypeScript Phase 1 is complete. Flutter Phase 1F starts only after the serialized
foundation from the ADR-0011-rebased build and worktree plans.

> **What actually happened, recorded so the gap is visible rather than implied.**
>
> Phase 1 ran and completed **without** the Rive decision, and Gate 1 is green. That
> was defensible: `packages/engine` imports nothing and is the least
> framework-exposed work in the plan. It was not free — ADR-0001 states that if the
> spike fails, the shared TypeScript engine is lost along with it.
>
> Phase 2 did **not** get the same latitude. The controlled spike failed and
> ADR-0011 exercised the pre-agreed Flutter fallback before a React Native mobile
> scaffold or renderer was merged. The completed TypeScript engine is retained as
> a parity oracle so gameplay behavior can be preserved mechanically in Dart.
