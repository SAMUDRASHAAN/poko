# Build plan — Poko's World v1

|                  |                                                              |
| ---------------- | ------------------------------------------------------------ |
| **Status**       | Gate 1F complete; Phase 2 is the active implementation phase |
| **Execution**    | Follow `WORKTREE-PLAN.md` for ownership and sequencing       |
| **Architecture** | Follow `ARCHITECTURE.md`; invariants are release gates       |

## 1. Completed foundation and oracle

Phase 0 produced the pnpm/Turborepo repository, strict TypeScript guardrails,
frozen contracts, CI, specs, and architecture rules. Phase 1 completed the pure
TypeScript engine plus independent verification:

- deterministic exact-number board/equation engine;
- solution-first generator, solver, validator, refill and state machine;
- canonical serialization, golden seeds and API snapshot;
- at least 90% engine coverage and the 100,000-board solvability gate;
- content, client-data, UI token, Gate 2 parser and verification packages.

Gate 1 is green. After ADR-0011 this implementation is the behavioural oracle for
the Dart port, not the production client runtime.

## 2. Completed architecture gate

The React Native Rive contingency is closed. Five controlled iterations on each
ADR-0010 model were functionally stable but missed frame budgets. ADR-0011 selects
Flutter + Flame + the official Rive Flutter runtime. Exact results and retained
artifacts are in `06-rive-spike-results.md`.

No React Native scaffold, dependency, Skia renderer, or Reanimated code may be
merged. Existing spike branches are evidence only.

## 3. Phase 1F — Flutter foundation and engine parity — complete

### 3.1 Serialized foundation — complete

The foundation sync point provides:

- `flutter/` workspace with pinned Flutter/Dart SDK and locked dependencies;
- `contracts/` with versioned language-neutral schemas and oracle fixtures;
- strict analyzer/lint rules, formatter, unit/widget/Golden test setup and CI;
- Flutter/Dart `AGENTS.md` and scoped rules that replace RN-only paths and commands;
- empty package boundaries from `ARCHITECTURE.md` §3;
- dependency/import audits for the pure Dart engine;
- managed-device Macrobenchmark integration point in the Android host;
- frozen Dart `Num`, engine public API and design-token contract.

Every third-party package requires an ADR. ADR-0012 chooses only the minimum
needed to establish Flutter, Flame, Rive, test infrastructure, local persistence,
and the app shell; screen/navigation conveniences wait until their phase.

### 3.2 Dart engine port — complete

Port behind the frozen Dart surface in dependency order:

1. exact `Num`, deterministic RNG and canonical JSON codec;
2. board, coordinates, adjacency and chain operations;
3. equation evaluation and validation;
4. solver and performance distribution;
5. generator, validator, gravity, refill, repair and tide shuffle;
6. difficulty, target selection, mastery, scoring and pure state machine;
7. serialization/restore and action-trace replay.

The port may read TypeScript source for intent but is judged only by public
language-neutral fixtures. It must not call Node, JavaScript, FFI, WebView, or a
network service at runtime.

### 3.3 Independent parity verification — complete

The verification owner expands `contracts/` and `tools/parity` without editing
the Dart engine. It exports fixtures from the accepted TypeScript oracle and
compares canonical Dart output for golden seeds, action logs, serialization,
analysis, packs, and the 100,000-state corpus.

**Gate 1F:** both language toolchains are green; all parity fixtures match; Dart
engine coverage is at least 90%; 100,000 Dart states have zero unsolvable boards;
`analyse()` P95 is below 5 ms on the pinned CI runner; serialization is lossless;
an offline app-shell smoke starts on Android.

These checks are permanent CI gates: the workspace verifier enforces Dart engine
coverage, `tools/parity` checks all seven public operations and the complete
seeded corpus, and the release job builds and audits the offline ARM64 Android
artifact. The TypeScript implementation remains a retained executable oracle;
production gameplay rules now live in the Dart engine.

Gate closure evidence from the merged Phase 1F tree on 2026-08-14:

- Dart line coverage: 93.22% (1,278/1,371);
- public parity fixtures: 17/17, zero mismatches;
- full corpus: 100,000/100,000, zero failures, canonical digest
  `8af0e008a0454462`, Dart `analyse()` P95 0.044 ms;
- offline Android emulator cold start: pass, with no `INTERNET` permission and
  release APK SHA-256
  `43c90ffcd5952427151d960435f554d65a375d6408c40a34cb6161a65d49c5ac`.

## 4. Phase 2 — Flutter board renderer and design system

- `flutter/apps/mobile/lib/game/board`: one Flame game/render loop, tile atlas,
  pointer/drag path, refill, target rotation, particles and Rive host composition;
- `flutter/packages/design_system`: layout, typography, actions, containers,
  feedback, identity and accessibility widgets;
- app shell sufficient to execute the managed-device performance script;
- AndroidX Macrobenchmark target/test APKs retained with exact hashes.

Before feature code, land the scripted drag → commit → refill → target rotation
measurement, 64×64 hit-target helper, and accessibility variant harness.

**Gate 2:** both ADR-0010 physical models complete at least five measured
iterations at verified 60 Hz with frame CPU P95 <16 ms, overrun P95 ≤0 ms,
<1% janky frames, process PSS <220 MB, complete traces, stable process identity,
and all engine/UI assertions passing.

## 5. Phase 3 — screens, persistence and backend

- child feature routes and eleven responsibilities from `01-experience-spec.md`;
- controllers that hold state and forward pure engine actions without rules;
- Dart SQLite schema, repositories, migration runner and sync outbox;
- Supabase schema, RLS, consent, sync, reports, export, erase and billing webhook;
- local/dev Supabase configuration and cross-account attack tests.

**Gate 3:** full airplane-mode session syncs exactly once on reconnect; consent
attack is rejected server-side; cross-account RLS cannot read another parent's
rows; full birth date is structurally unstorable.

## 6. Phase 4 — content and parent zone

- at least 50 oracle-validated seed records and five band configs, imported through
  parity-tested Dart content readers;
- copy, VO manifest and human-reviewed monotonic difficulty curve;
- seven Flutter parent-zone responsibilities including consent, reports,
  controls, subscription, export and erasure.

**Gate:** content QA and parity pass; parent onboarding through consent completes
unaided in under three minutes.

## 7. Phase 5 — integration

Integrate audio, tutorial, accessibility, onboarding polish, final Rive rigs,
particles, island art, background/restore, offline recovery and device sweep.
Work is single-threaded except for a strictly isolated audio worktree.

## 8. Phase 6 — beta and launch

Run beta triage single-threaded, privacy/security review, child-store compliance,
performance regression, crash recovery, data export/erase exercises, signing and
rollback rehearsal.

## 9. Task contract

Every task declares exact editable paths, readable dependencies, forbidden paths,
acceptance commands, budgets and observable behavior. Dependency locks, SDK pins,
CI, frozen contracts and generated parity baselines are serialized through the
phase owner.

## 10. Verification matrix

| Concern                         | Mechanical check                                       |
| ------------------------------- | ------------------------------------------------------ |
| TypeScript oracle               | `pnpm verify:gate1`                                    |
| Flutter analysis and formatting | pinned Flutter commands from `flutter/README.md`       |
| Dart unit/widget coverage       | `flutter test --coverage` through the workspace runner |
| Import/dependency boundaries    | Dart import audit + TypeScript dependency-cruiser      |
| Cross-language behavior         | `tools/parity` canonical fixture comparison            |
| Dart solvability                | 100,000-state seeded fuzz gate                         |
| Device interaction/performance  | managed physical Macrobenchmark suites                 |
| Data isolation and consent      | Supabase attack suite                                  |

The concrete Flutter commands are frozen with the Phase 1F scaffold, not guessed
in advance of the SDK/package-manager decision.

## 11. External readiness

Managed-device access is ready and ADR-0011 is resolved. Before public beta,
complete Indian privacy counsel review, child/family store-policy review and
trademark clearance. These owner actions cannot be substituted by passing CI.
