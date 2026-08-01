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
- [ ] Configure the remote, push, and enable branch protection on `main`
- [ ] Order the reference devices (one ~Rs.10k Android, one SE-class iPhone)
- [ ] Run the 3-day `rive-react-native` spike (gates ADR-0001)
- [ ] Book Indian privacy counsel for the DPDP consent flow
- [ ] Trademark search: "Poko's World" / "Sumlings" (Classes 9 and 41)
- [ ] Create the two Phase 1 worktrees

## Exit gate

- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm verify` green on a repo with no Phase 1 feature code (2026-08-02)

Phase 1 may start after the owner-controlled Rive decision and remote/worktree setup above.
