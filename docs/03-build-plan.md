# Build plan — Poko's World v1

|                  |                                                        |
| ---------------- | ------------------------------------------------------ |
| **Status**       | Canonical implementation inventory                     |
| **Execution**    | Follow `WORKTREE-PLAN.md` for ownership and sequencing |
| **Architecture** | Follow `ARCHITECTURE.md`; invariants are release gates |

## 1. Foundation and shared contracts

### 1.1 Repository

- pnpm workspaces and Turborepo;
- strict shared TypeScript configuration;
- ESLint, Prettier, commitlint, Husky, lint-staged;
- dependency-cruiser, Knip, Vitest coverage, and CI;
- package-level `AGENTS.md` where a boundary needs additional rules.

### 1.2 Pure engine contract

`packages/engine/src/types.ts` and the signatures exported from `index.ts` are
frozen at Phase 0. Implementations arrive behind those signatures. Public imports
use `@poko/engine`; deep imports are forbidden outside the engine package.

### 1.3 Content contract

Content supplies seeds, band configuration, level rules, copy, and VO manifests.
It never supplies a hand-authored board or bypasses engine validation.

### 1.4 Design tokens

`packages/ui/src/tokens.ts` is the only source of colour, spacing, radius, type,
font, touch, and motion values. Existing token values are frozen; additions are
reviewable contract changes.

### 1.5 Component library

Phase 2 builds presentational primitives in `packages/ui` with no game, store,
navigation, persistence, or network knowledge:

- layout: `Stack`, `Inline`, `Box`, `SafeArea`;
- typography: `Text`, `Heading`, `NumberDisplay`;
- actions: `Button`, `IconButton`, `AudioButton`, `Toggle`;
- containers: `Card`, `Sheet`, `Dialog`, `Banner`;
- feedback: `ProgressBar`, `Spinner`, `Badge`, `Toast`;
- identity/decorative: `Avatar`, `Icon`, `OperationMark`;
- accessibility helpers: `SpokenLabel`, `FocusRing`, `HitTarget`.

Each primitive supports relevant large-text, reduced-motion, high-contrast,
left-handed, colour-vision, and dyslexia-font variants. Game-aware tile, target,
chain, HUD, and reward components remain in `apps/mobile/src/components`.

## 2. Phase 0 — foundation

Deliver the repository, guardrails, documentation, frozen engine/UI contracts,
exact `Num`, deterministic RNG, golden-seed test, and typed Gate 1 harness.

**Gate:** `pnpm install --frozen-lockfile` and `pnpm verify` pass with Phase 1
engine functions still throwing `NotImplementedError`.

## 3. Phase 1 — engine and independent verification

### Engine worktree

Owns `packages/engine/src/**`, including colocated internal unit tests. Build in
dependency order:

1. board representation, coordinates, adjacency, chain operations;
2. equation evaluation and validation;
3. solver and performance test;
4. solution-first generator and golden generated seeds;
5. validator, gravity, solution-aware refill, repair, and tide shuffle;
6. difficulty, target selection, mastery, scoring, and pure state machine;
7. serialization/restore and reducer property tests.

### Verification worktree

Owns `tools/verify`, `tools/fuzz`, and `tools/levelgen`. It tests only the frozen
package-root API and never edits engine files. It builds black-box contract and
property suites, the 100k-state solvability gate, API snapshot, determinism
snapshots, and pack generation CLI.

**Gate 1:** `pnpm verify:gate1`, engine coverage ≥90%, 100,000 generated boards
with zero unsolvable, `analyse()` under 5 ms on 8×8, reducer purity, and lossless
serialization.

## 4. Phase 2 — board renderer and UI

- `apps/mobile/src/board`: one Skia canvas, tile atlas, Reanimated gesture path,
  particles, refill and target-transition animation;
- `packages/ui`: §1.5 primitives and accessibility variants;
- app shell sufficient to run the board performance harness.

**Gate 2:** sustained 60 fps drag and refill on both physical Android models in
the approved managed low-end profile (ADR-0010).

## 5. Phase 3 — screens, persistence, and backend

- child route group and eleven screen responsibilities from `01-experience-spec.md`;
- Zustand slices that hold state and forward engine actions without rules;
- SQLite schema, repositories, migration runner, and sync outbox;
- Supabase schema, RLS, consent, sync, reports, export, erase, and billing webhook;
- local/dev Supabase configuration and cross-account attack tests.

**Gate 3:** airplane-mode session syncs once on reconnect and cross-account RLS
tests cannot access another parent's rows.

## 6. Phase 4 — content and parent zone

- at least 50 validated level seeds, five band configs, copy, VO manifest, and
  human-reviewed monotonic difficulty curve;
- seven parent-zone responsibilities from `01-experience-spec.md`, including
  consent, reports, controls, subscription state, export, and erasure.

**Gate:** content QA passes and parent onboarding through consent completes
unaided in under three minutes.

## 7. Phase 5 — integration

Integrate audio, tutorial, accessibility, onboarding polish, art/Rive assets,
performance, background/restore behaviour, device matrix, and offline recovery.
This phase is single-threaded except for an isolated audio service worktree.

## 8. Phase 6 — beta and launch

Run beta triage single-threaded, privacy/security review, store compliance,
performance regression, crash recovery, data export/erase exercises, release
candidate signing, and rollback rehearsal.

## 9. Task contract

Every implementation task declares:

```text
May edit:      exact owned paths
May read:      dependencies and relevant specs
Do NOT touch:  neighbouring owner paths and frozen contracts
Acceptance:    commands, tests, budgets, and observable behaviour
```

An owner may read the entire repository but writes only the declared paths.
Dependency, lockfile, frozen contract, and CI changes are serialized through the
Phase owner.

## 10. Verification matrix

| Concern                        | Mechanical check                                         |
| ------------------------------ | -------------------------------------------------------- |
| Type safety                    | `pnpm typecheck`                                         |
| Conventions and invariant bans | `pnpm lint`                                              |
| Package boundaries             | `pnpm depcruise`                                         |
| Unit/property coverage         | `pnpm test`                                              |
| Unused code/dependencies       | `pnpm knip`                                              |
| Phase 0 aggregate              | `pnpm verify`                                            |
| Gate 1 aggregate               | `pnpm verify:gate1`                                      |
| Device interaction             | Managed physical-device suites added with the mobile app |
| Data isolation                 | Supabase RLS attack suite added with the API             |

## 11. External readiness

Before board/rendering commitment, complete the Rive React Native spike required
by ADR-0001 on the two-model managed physical-device profile defined by ADR-0010.
Before public beta, complete Indian privacy counsel review, child/family
store-policy review, and trademark clearance. These owner actions are tracked
outside the code repository and cannot be substituted by emulator-only CI.
