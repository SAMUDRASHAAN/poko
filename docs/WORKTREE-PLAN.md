# WORKTREE PLAN

How two owners work in parallel after the ADR-0011 Flutter replatform without
colliding. Read with `ARCHITECTURE.md`, `AGENTS.md`, and `03-build-plan.md`.

## 1. Rule and naming

> A package has exactly one owning worktree at any moment. An owner may read the
> repository and write only the paths named in the task contract.

Branches use `wt/<domain>` and sibling directories use `poko-<domain>`. `main` is
integration-only and always green. Worktrees rebase on `origin/main`; they do not
merge main into feature branches.

## 2. Transition state

Completed and retired:

- `wt/engine` and `wt/verify`: TypeScript Gate 1;
- original React Native `wt/board`: frozen after ADR-0011 and never merged as a
  production renderer;
- original TypeScript `wt/ui`: reusable token/accessibility work is reference
  material only until represented in the Dart token contract.

No active feature worktree may start from the pre-ADR-0011 Phase 2 branches.

## 3. Phase 1F foundation — single-threaded

Create `wt/flutter-foundation` from fresh green main. It exclusively owns:

- `flutter/pubspec.yaml`, workspace/package manifests and lockfile;
- Flutter/Dart SDK pin and bootstrap documentation;
- empty `flutter/apps/mobile` and `flutter/packages/*` boundaries;
- initial `contracts/` schemas and fixture version;
- CI changes, analyzer/lint configuration and Dart import audit;
- `AGENTS.md` and scoped rules updated from existing TS/RN-only guidance to the
  real Flutter paths and commands created by this scaffold;
- frozen Dart engine API, `Num` and design-token surface;
- Android host benchmark module skeleton.

Exit only when both pnpm Gate 1 and the empty Flutter workspace are green. Merge
and retire this worktree before creating the parallel pair.

## 4. Phase 1F engine + parity — two worktrees

| Worktree         | Owns                              | Builds                                                                               |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `wt/dart-engine` | `flutter/packages/game_engine/**` | pure Dart port, internal unit/property tests, seeded fuzz adapter                    |
| `wt/parity`      | `contracts/**`, `tools/parity/**` | TS oracle exporter, canonical fixtures, Dart black-box adapter, API/schema snapshots |

The public Dart contract and parity schema are frozen. `wt/parity` never edits the
engine; `wt/dart-engine` never rewrites expected fixtures. A required contract
change stops both worktrees for an ADR and sync point.

**Gate 1F:** `03-build-plan.md` §3.3. Merge both, run the full corpus from main,
then retire both worktrees.

## 5. Phase 2 board + design system — two worktrees

| Worktree           | Owns                                                          | Builds                                                                               |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `wt/flutter-board` | `flutter/apps/mobile/lib/game/**`, Android benchmark workload | Flame loop, board, gestures, animation, Rive composition, controlled device scenario |
| `wt/flutter-ui`    | `flutter/packages/design_system/**`                           | tokens, primitives, accessibility variants, 64×64 semantics helper                   |

The foundation owner serializes dependency and lockfile edits. Neither feature
worktree edits manifests, SDK pins, CI or the other's package.

**Gate 2:** two-model ADR-0010 physical qualification. Merge only after all frame,
memory, trace, process and functional thresholds pass.

## 6. Phase 3 screens + backend — two worktrees

| Worktree             | Owns                                                                     | Builds                                                            |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `wt/flutter-screens` | `flutter/apps/mobile/lib/features/**`, `flutter/packages/client_data/**` | child screens, controllers, SQLite, outbox and offline E2E        |
| `wt/backend`         | `apps/api/**`                                                            | Supabase schema, RLS, consent, sync, reports, privacy and billing |

**Gate 3:** airplane-mode sync exactly once, consent bypass rejected, cross-account
RLS blocked and birth-year-only schema enforced.

## 7. Phase 4 content + parent — two worktrees

| Worktree             | Owns                                                      | Builds                                                      |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `wt/flutter-content` | `flutter/packages/content/**`, canonical content fixtures | seed readers, band configs, copy, VO manifest, curve checks |
| `wt/flutter-parent`  | `flutter/apps/mobile/lib/features/parent/**`              | gate, consent UI, dashboard, controls and privacy center    |

## 8. Phases 5–6 — single-threaded

Integration, final art/Rive, tutorial, accessibility, beta triage and release are
cross-cutting and stay in one worktree. A second worktree is allowed only for an
audio service whose paths and dependencies do not overlap.

## 9. Dependency graph

```text
ADR-0011 + managed evidence
            │
   flutter-foundation
            │
     ┌──────┴──────┐
 dart-engine     parity       Phase 1F
     └──────┬──────┘
          Gate 1F
     ┌──────┴──────┐
 flutter-board  flutter-ui    Phase 2
     └──────┬──────┘
           Gate 2
     ┌──────┴──────┐
 flutter-screens backend      Phase 3
     └──────┬──────┘
           Gate 3
     ┌──────┴──────┐
 flutter-content parent       Phase 4
     └──────┬──────┘
       integration            Phases 5–6
```

## 10. Shared-file hazard register

| File/path                                    | Owner/protocol                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Dart engine public API and `Num`             | Frozen contract; ADR + sync point                                |
| `contracts/schema/**` and baseline manifests | Frozen contract; parity owner proposes, phase owner serializes   |
| Dart design tokens                           | Frozen after foundation; additions reviewed, changes require ADR |
| Flutter manifests/lockfile/SDK pin           | Phase owner only; batch dependency edits                         |
| root pnpm manifests/lockfile                 | Phase owner only                                                 |
| `AGENTS.md`, rules and CI                    | Phase owner; update with the governed scaffold                   |
| `ARCHITECTURE.md`                            | Same PR as architecture-affecting code                           |
| Android/iOS host configuration               | Phase owner; feature owners request changes                      |

Do not hand-merge lockfiles or regenerate expected parity output to make a failing
port pass. A parity mismatch is a product change until explained.

## 11. Daily and conflict protocol

At task start: fetch, rebase, read the task contract and run the scoped baseline.
During work: edit only owned paths, make small conventional commits and keep both
language gates green. At handoff: open a PR, review from the other domain, pass CI,
merge, then retire branches within two days when possible.

If both worktrees need one file, stop: either ownership is wrong or the contract
was under-specified. If a frozen surface must move, merge current work, write an
ADR, change it once on main and rebase both worktrees.

## 12. Phase-end hygiene

At every gate:

1. merge all phase branches into green main;
2. remove and prune retired worktrees;
3. retain machine-readable gate evidence and exact artifact hashes;
4. re-review architecture and ADR status;
5. turn repeated review corrections into a lint/test/ADR;
6. create the next worktrees only from the resulting main commit.
