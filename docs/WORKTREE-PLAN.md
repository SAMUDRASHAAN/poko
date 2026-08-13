# WORKTREE PLAN

How two coding agents work in parallel on this repo without colliding.

> **Read with** `ARCHITECTURE.md` (package boundaries) and `AGENTS.md` (rules). This document decides _who works where, when, and what they may touch._

---

## 1. Why worktrees rather than branches-in-one-directory

Two agents editing one working directory is the most expensive failure mode in a multi-agent build: one agent refactors a file the other is mid-way through, tests go red for reasons neither can explain, and you lose an afternoon to a merge you didn't ask for.

`git worktree` gives each agent **its own directory, its own branch, one shared repository and history**. Zero file collisions by construction.

A useful side effect: Claude Code's auto memory is keyed to the git repository, so **all worktrees share one memory directory** — learnings carry across agents and branches instead of being relearned per checkout.

---

## 2. Setup

```bash
# from the main checkout, once
git worktree add ../poko-engine   -b wt/engine
git worktree add ../poko-ui       -b wt/ui

# each agent runs in its own directory
cd ../poko-engine && pnpm install && claude
cd ../poko-ui     && pnpm install && codex
```

```
~/dev/
├── poko/            main — always green, integration only, no agent works here
├── poko-engine/     wt/engine
├── poko-ui/         wt/ui
└── …                further worktrees added per phase
```

**Naming:** `wt/<domain>` for branches, `poko-<domain>` for directories. One domain per worktree, one worktree per agent, always.

---

## 3. The ownership rule

> **A package has exactly one owning worktree at any moment. An agent may read anything and write only what its worktree owns.**

Every task therefore carries three lines (see `AGENTS.md`):

```
May edit:   packages/engine/src/solver.ts + its tests
May read:   packages/engine/src/{types,board,equation,num}.ts
Do NOT touch: generator.ts, refill.ts, apps/**
```

"May read" is generous. "May edit" is narrow. That asymmetry is what makes parallelism safe.

---

## 4. ⭐ The Contract Freeze — what makes parallel work possible at all

Parallelism is impossible while the shared types are still moving. So Phase 0 produces, **before any implementation exists**:

- `packages/engine/src/types.ts` — every shared type, complete
- `packages/engine/src/index.ts` — every public signature, bodies throwing `NOT_IMPLEMENTED`
- `packages/ui/tokens.ts` — the full token set

These three files are then **frozen**. Both agents code against them: one implements behind the signatures, the other builds consumers on top of them, and neither blocks the other.

**Changing a frozen file requires an ADR and a sync point** — both agents commit, merge to main, then re-pull. Expect two or three of these across the whole build. If you're hitting one a week, the contract was under-specified and you should stop and fix it properly rather than keep patching.

---

## 5. Phase plan

### Phase 0 — Foundation · single-threaded · ~1 week

**No parallelism.** You cannot parallelise the work that defines the boundaries.

| Deliverable                                                       | Notes                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Monorepo scaffold, strict tsconfig, Turborepo                     |                                                                                  |
| `AGENTS.md` + `CLAUDE.md` (importing it), `.claude/rules/`        |                                                                                  |
| `.dependency-cruiser.js`                                          | ⭐ **written before `engine` has any code**, so INV-1 can never be violated once |
| ESLint rules, Prettier, husky, commitlint                         |                                                                                  |
| `ci.yml` — typecheck, lint, depcruise                             |                                                                                  |
| `ARCHITECTURE.md`, `docs/adr/0001–0006`, the four specs           |                                                                                  |
| ⭐ **Contract Freeze**: `types.ts`, `index.ts` stubs, `tokens.ts` | Gate for everything after                                                        |

**Exit gate:** CI green on an empty repo. Every guardrail in place before a single feature line is written.

---

### Phase 1 — Engine + verification · 2 worktrees · ~3 weeks

The cross-model pattern at its most valuable: **one agent implements, the other writes the tests and harness against the frozen contract.**

| Worktree    | Agent | Owns                                                    | Builds                                                                                                        |
| ----------- | ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `wt/engine` | A     | `packages/engine/src/**` including colocated unit tests | num, rng, board, equation → generator, solver, validator, refill, difficulty, machine                         |
| `wt/verify` | B     | `tools/verify`, `tools/fuzz`, `tools/levelgen`          | Black-box contract suites, fast-check property harness, golden-seed snapshots, API surface test, levelgen CLI |

They touch **disjoint packages** and share only the frozen public contract. B writes
`tools/verify/solver.contract.spec.ts` red through `@poko/engine`; A owns the
colocated internal unit tests and makes both suites green. Neither agent writes
inside the other agent's package.

> **Order matters:** the solver's tests and the solver itself come _before_ the generator. You cannot verify a generator without a solver to check it with.

**Exit gate — GATE 1:**

- `pnpm fuzz` — 100k boards, zero unsolvable [INV-6]
- `analyse()` < 5 ms on 8×8, asserted in a test
- `dispatch` proven pure; `serialise → restore` lossless [INV-5, INV-7]
- Engine coverage ≥ 90%

**Nothing downstream starts before Gate 1 passes.**

---

### Phase 2 — Rendering + component library · 2 worktrees · ~3 weeks

| Worktree   | Agent                        | Owns                       | Builds                                                              |
| ---------- | ---------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `wt/board` | A _(engine owner continues)_ | `apps/mobile/src/board/**` | Skia canvas, tile atlas, Reanimated gestures, chain path, particles |
| `wt/ui`    | B                            | `packages/ui/**`           | Primitives + presentational components (§1.5 of the build plan)     |

Board is tightly coupled to engine internals, so it stays with the agent who has that context. `ui` needs only `tokens.ts` and is fully independent.

**Exit gate — GATE 2:** 60 fps sustained drag + refill on both physical Android
models in the approved managed low-end profile (ADR-0010).

---

### Phase 3 — Screens + backend · 2 worktrees · ~3 weeks

| Worktree     | Agent | Owns                                                      | Builds                                                          |
| ------------ | ----- | --------------------------------------------------------- | --------------------------------------------------------------- |
| `wt/screens` | A     | `apps/mobile/src/{app,components,stores}/**` (child zone) | 11 child screens, navigation, stores wiring                     |
| `wt/backend` | B     | `apps/api/**`, `packages/client-data/**`                  | Schema, RLS, 6 Edge Functions, SQLite repositories, sync outbox |

Maximum genuine independence in the whole build — one agent is in TSX, the other in SQL and Node. Merge friction near zero.

**Exit gate — GATE 3:** cross-account RLS attack test fails to read another parent's data; airplane-mode session syncs cleanly on reconnect.

---

### Phase 4 — Content + parent zone · 2 worktrees · ~2 weeks

| Worktree     | Agent | Owns                            | Builds                                                                    |
| ------------ | ----- | ------------------------------- | ------------------------------------------------------------------------- |
| `wt/content` | A     | `packages/content/**`           | 50 level seeds via levelgen, band configs, difficulty curve, copy strings |
| `wt/parent`  | B     | `apps/mobile/src/app/parent/**` | 7 parent screens, gate, consent UI, dashboard, privacy centre             |

**Exit gate:** difficulty curve human-reviewed and monotonic; a parent completes onboarding + consent unaided in under 3 minutes.

---

### Phase 5 — Integration · mostly single-threaded · ~3 weeks

**Collapse to one worktree for most of this.** Integration work crosses every boundary, and that is exactly when parallel agents fight.

| Work                                                | Mode                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Audio (VO assembly, SFX, mute paths)                | Can run as a second worktree — `apps/mobile/src/services/audio.ts` is isolated |
| Tutorial, accessibility variants, onboarding polish | Single-threaded — touches everything                                           |
| Art integration (Rive rigs, particles, island art)  | Single-threaded                                                                |
| Perf pass, device matrix sweep                      | Single-threaded                                                                |

---

### Phase 6 — Beta and launch · single-threaded · ~4 weeks

Bug-fixing across a live beta is inherently cross-cutting. Two agents chasing the same crash report is worse than one.

---

## 6. Worktree dependency graph

```
Phase 0  ══ foundation + CONTRACT FREEZE ══
              │
     ┌────────┴────────┐
 wt/engine          wt/verify              Phase 1
     └────────┬────────┘
          ══ GATE 1 ══
     ┌────────┴────────┐
  wt/board            wt/ui                Phase 2
     └────────┬────────┘
          ══ GATE 2 ══
     ┌────────┴────────┐
 wt/screens        wt/backend              Phase 3
     └────────┬────────┘
          ══ GATE 3 ══
     ┌────────┴────────┐
 wt/content        wt/parent               Phase 4
     └────────┬────────┘
              │
      integration (1 worktree)             Phase 5–6
```

---

## 7. Shared file hazard register

Files that more than one worktree will eventually want. Each has an owner and a protocol — **check here before editing any of them.**

| File                              | Owner                          | Protocol                                                                                                                               |
| --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/src/types.ts`    | Contract                       | 🔒 Frozen. ADR + sync point                                                                                                            |
| `packages/engine/src/index.ts`    | Contract                       | 🔒 Frozen signatures. API snapshot test guards it [INV-15]                                                                             |
| `packages/ui/tokens.ts`           | Contract                       | 🔒 Frozen. Additions allowed, changes need an ADR                                                                                      |
| `package.json` / `pnpm-lock.yaml` | **Human**                      | Dependency changes batched, one worktree at a time, ADR required. The classic multi-agent conflict — do not let agents add deps ad hoc |
| `AGENTS.md`, `.claude/rules/**`   | **Human**                      | Agents may propose; only you commit                                                                                                    |
| `ARCHITECTURE.md`                 | **Human**                      | Updated in the same PR as the code it describes                                                                                        |
| `.github/workflows/ci.yml`        | Whoever holds infra that phase | One owner per phase, named in advance                                                                                                  |
| `docs/adr/**`                     | Anyone                         | Append-only, sequential numbers. Claim a number in the PR title to avoid collisions                                                    |
| `apps/mobile/app.config.ts`       | `wt/screens`                   | Others request changes rather than editing                                                                                             |

---

## 8. Daily rhythm

```
morning    each agent: git fetch && git rebase origin/main
           read the task contract; plan mode / read-only pass first
day        implement → hooks lint+typecheck on every edit → commit small and often
           NEVER edit outside "May edit"
end of day open PR → the OTHER agent reviews → CI → merge to main
           branches live < 2 days
```

**Rules that keep this cheap:**

- `main` is always green and nobody develops in it.
- **Rebase feature branches, never merge into them.** Linear history is what makes an agent able to reconstruct what happened.
- Merge to `main` at least daily. A worktree that hasn't merged in three days is a rewrite waiting to happen.
- Cross-model review is mandatory, not optional — the model that didn't write it reviews it.

---

## 9. Conflict protocol

| Situation                               | Do this                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Both worktrees need the same file       | Stop. It's a boundary error — one of them is working outside its package. Re-read `ARCHITECTURE.md` §6          |
| A frozen contract file must change      | Both agents commit and merge → ADR → change in main → both rebase. Announce it; don't slip it into a feature PR |
| Rebase conflict in a file you own       | Resolve yourself                                                                                                |
| Rebase conflict in a file you don't own | Do not resolve. `git rebase --abort`, tell the owner                                                            |
| An agent edited outside its scope       | Revert the out-of-scope hunks. Tighten the task contract before retrying                                        |
| Lockfile conflict                       | Delete the lockfile, `pnpm install`, commit once. Never hand-merge a lockfile                                   |

---

## 10. What NOT to parallelise

Learned constraints — treat them as rules, not preferences.

- ❌ **Two agents inside `packages/engine`.** Densely interconnected and correctness-critical. One owner, always.
- ❌ **Anything during Phase 0.** Boundaries can't be defined in parallel.
- ❌ **Integration, art, tutorial, accessibility** (Phase 5). These cross every boundary by nature.
- ❌ **Beta bug-fixing.** Two agents chasing one crash produce two partial fixes.
- ❌ **Dependency or config changes.** Serialise through you.
- ❌ **More than two worktrees at once.** A third agent adds review load and merge surface faster than it adds throughput, at this team size.

---

## 11. Command reference

```bash
# create
git worktree add ../poko-<domain> -b wt/<domain>

# list / inspect
git worktree list

# stay current (from inside a worktree)
git fetch && git rebase origin/main

# scope work to your package — keeps agent context cheap
pnpm turbo run test --filter=@poko/engine
pnpm turbo run lint --filter=@poko/ui

# Phase 0 gate, while generator/solver are frozen stubs
pnpm verify

# full gate from Gate 1 onward
pnpm verify:gate1

# retire a worktree after its phase merges
git worktree remove ../poko-<domain>
git branch -d wt/<domain>
git worktree prune
```

---

## 12. Phase-end hygiene

At every gate:

1. All worktree branches merged to `main`; `main` green.
2. Retired worktrees removed and pruned — stale worktrees confuse agents that discover them.
3. New worktrees created for the next phase from fresh `main`.
4. `ARCHITECTURE.md` re-reviewed; any drift corrected in the same PR.
5. Corrections you made more than once this phase graduate into a lint rule or an ADR.

Step 5 is the compounding one. It is why month six is cheaper than month one instead of more expensive.
