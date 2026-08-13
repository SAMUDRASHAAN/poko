# ARCHITECTURE.md

Canonical architecture for **Poko's World** — the child learning app whose v1
release is **Tally Sea**, a numeracy puzzle game.

> Read this before writing code in a package you have not touched this session.
> §6 and §7 define placement and invariants. Breaking either requires an ADR.

|             |                                                                                       |
| ----------- | ------------------------------------------------------------------------------------- |
| **Status**  | Living document; Flutter rebaseline accepted by ADR-0011                              |
| **Scope**   | Complete v1 system; v2/v3 extension points are planned only                           |
| **Related** | `AGENTS.md` · `docs/03-build-plan.md` · `docs/WORKTREE-PLAN.md` · ADR-0010 · ADR-0011 |

## 1. What this system is

Poko's World is a cross-platform, offline-first learning app for children aged
4–12. It contains no ads or behavioural profiling. V1 is Tally Sea: an 8×8
solution-first number puzzle with deterministic generation and a scripted host.

The production client is Flutter. Flame owns the board render/update loop and the
official Rive Flutter runtime owns rigged characters. Game rules live in a pure
Dart package with no Flutter or I/O dependency.

The completed pure-TypeScript engine remains an executable oracle during the
replatform. It is not embedded in, bridged into, or shipped with the Flutter app.
Language-neutral fixtures prove the Dart implementation preserves its behaviour.

## 2. System map

```text
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT — Flutter (Android, iOS, web)                             │
│                                                                  │
│ screens/controllers   Flame board   design system   Rive host    │
│          │                 │              │             │        │
│          └─────────────────┴──────────────┴─────────────┘        │
│                                  │                               │
│                       flutter game_engine (PURE DART)            │
│           board · equation · generator · solver · state machine │
│                                  │                               │
│                   client_data — SQLite + sync outbox             │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ HTTPS, batched, idempotent
┌──────────────────────────────────┴───────────────────────────────┐
│ BACKEND — Supabase                                               │
│ parent auth · Postgres/RLS · Edge Functions · Storage           │
│ consent · sync · reports · export/erase · billing webhook       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ BUILD-TIME ORACLE — existing TypeScript engine and tools         │
│ emits/validates language-neutral golden fixtures and corpora     │
└──────────────────────────────────────────────────────────────────┘
```

Children never authenticate. Child rows are reached only through a parent
session after an immutable consent record exists.

## 3. Repository layout

```text
poko/
├── contracts/                  language-neutral schemas and parity fixtures
├── flutter/
│   ├── apps/mobile/            Flutter Android/iOS/web client
│   └── packages/
│       ├── game_engine/        pure Dart; zero runtime dependencies
│       ├── design_system/      tokens and presentational widgets
│       ├── content/            seed packs, band configs, copy and VO manifest
│       └── client_data/        SQLite repositories and sync outbox
├── packages/
│   ├── engine/                 completed TypeScript behavioural oracle
│   ├── content/                current canonical seed/config source
│   ├── ui/                     current token contract source
│   └── client-data/            current persistence reference implementation
├── apps/api/                   Supabase migrations, RLS and Edge Functions
├── tools/                      TS oracle, fuzz, parity and content tooling
└── docs/                       specs and ADRs
```

`contracts/` and `flutter/` are the only new top-level directories authorized by
ADR-0011. Until the Dart port passes parity, the TypeScript packages remain the
source used to generate fixtures. After parity, a separate ADR may retire or
archive reference implementations; no silent deletion is allowed.

## 4. Dependency rule

```text
flutter/apps/mobile ──┬──► design_system
                     ├──► content ───────► game_engine
                     ├──► client_data ───► game_engine
                     └──► game_engine

flutter/packages/game_engine ──► Dart core only
apps/api ───────────────────────► no client package

tools/parity ──► TS engine + contracts + Dart engine command adapter
TS engine ─────► JavaScript standard library only
```

Flutter widgets, Flame, Rive, SQLite, Supabase clients, clocks, and randomness are
forbidden from `flutter/packages/game_engine`. Dart import-boundary checks and the
existing TypeScript dependency-cruiser both fail CI on violations.

## 5. Layer model

|   # | Layer                                  | Production location                     |
| --: | -------------------------------------- | --------------------------------------- |
|   1 | Screens, board, HUD, gestures          | `flutter/apps/mobile/lib/`              |
|   2 | Board grid, adjacency, gravity, refill | `flutter/packages/game_engine/lib/src/` |
|   3 | Exact equation evaluation and validity | `flutter/packages/game_engine/lib/src/` |
|   4 | Solution-first generator and decoys    | `flutter/packages/game_engine/lib/src/` |
|   5 | Solver and solvability validator       | `flutter/packages/game_engine/lib/src/` |
|   6 | Difficulty and target selection        | `flutter/packages/game_engine/lib/src/` |
|   7 | Mastery, scoring, pure state machine   | `flutter/packages/game_engine/lib/src/` |
|   8 | Progress/rewards and persistence       | `game_engine` + `client_data`           |
|   9 | Parent dashboard, privacy, billing     | Flutter parent routes + `apps/api`      |
|  10 | Audio and accessibility services       | `flutter/apps/mobile/lib/services/`     |

Layers 2–7 are pure Dart. UI code may render decisions but never make them.

## 6. Where code goes

| Writing…                                        | Put it in                             | Never in                            |
| ----------------------------------------------- | ------------------------------------- | ----------------------------------- |
| A rule about a valid move or next state         | Dart `game_engine`                    | widget, controller, Flame component |
| A gameplay number or exact equation             | Dart `game_engine` using `Num`        | raw floating-point UI value         |
| Randomness                                      | seeded `game_engine` RNG              | `Random()` at a call site           |
| A colour, spacing, radius, font or motion token | `design_system/lib/src/tokens.dart`   | widget literals                     |
| Reusable game-agnostic widget                   | `design_system`                       | mobile feature folder               |
| Tile, target, chain or reward presentation      | `flutter/apps/mobile/lib/game/`       | `design_system`                     |
| Board render/update or gestures                 | `flutter/apps/mobile/lib/game/board/` | screen/controller                   |
| Route or screen                                 | `flutter/apps/mobile/lib/features/`   | engine/package internals            |
| Persisted data                                  | `client_data` repository              | widget/controller/service           |
| Network call                                    | mobile sync service or `apps/api`     | child widget or engine              |
| Language-neutral parity fixture/schema          | `contracts/`                          | generated build directory           |
| Migration or RLS policy                         | `apps/api/migrations/`                | client code                         |
| Unknown category                                | ask or write an ADR                   | an unreviewed top-level folder      |

Heuristic: if the rule remains true in a text-only game, it belongs in
`game_engine` and must be represented in parity fixtures.

## 7. Invariants

| ID         | Invariant                                                                                               | Mechanical enforcement                     |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **INV-1**  | Both production Dart engine and TS oracle import no runtime dependency outside their standard libraries | Dart import audit + dependency-cruiser     |
| **INV-2**  | Game rules exist only in `game_engine`; widgets, controllers and Flame components contain none          | import audit + engine coverage + review    |
| **INV-3**  | All randomness has an explicit seed and matches the golden corpus                                       | banned unseeded RNG + parity snapshots     |
| **INV-4**  | Gameplay values use the exact `Num` value type, never a float                                           | analyzer/lints + tests                     |
| **INV-5**  | `dispatch(state, action)` is pure: no I/O, clock, global state or mutation                              | property tests + review                    |
| **INV-6**  | Every reachable board state has at least one solution                                                   | 100,000-state Dart fuzz + TS parity corpus |
| **INV-7**  | Game state serializes/restores losslessly and canonically                                               | cross-language round-trip fixtures         |
| **INV-8**  | The app is fully playable with the network permanently off                                              | airplane-mode E2E                          |
| **INV-9**  | SQLite is the device source of truth; server is a sync target                                           | architecture test/review                   |
| **INV-10** | No child data is processed before valid consent                                                         | server attack suite                        |
| **INV-11** | No full child date of birth is stored; birth year only                                                  | schema constraint + migration review       |
| **INV-12** | No third-party analytics/ad SDK in the child zone                                                       | dependency audit                           |
| **INV-13** | Every visual token comes from the Dart token contract                                                   | custom lint + widget tests                 |
| **INV-14** | Every child-zone interactive target is at least 64×64 logical pixels                                    | widget semantics tests                     |
| **INV-15** | Dart engine public API and parity schema change only through reviewed snapshots                         | API/schema snapshot tests                  |

## 8. Core data flows

### Gameplay tick

```text
pointer moves
  → Flame input handler updates drag path in the game loop
  → on cell entry: gameEngine.dispatch(extendChain)
  → board paints equation preview in the same render surface
release
  → gameEngine.dispatch(commit)
     ├─ invalid target → rejecting → ready
     └─ valid target → resolving → refilling → targetRotating → ready
                         ├─ remove + gravity
                         ├─ weak-skill-weighted target selection
                         ├─ seeded refill → repair → tide shuffle
                         └─ solver asserts at least one solution
  → canonical state saved to SQLite on ready
  → attempt queued in sync outbox
```

The engine transition is atomic even when Flutter animates it over several frames.
Input is accepted only in ready, dragging, and previewing phases.

### Persistence and sync

```text
engine state → repository → SQLite → UUID outbox row
                                      │
connectivity → batched POST /sync ────┘
server applies idempotently and returns changes since cursor → local merge
```

### Consent and auth

```text
phone → OTP → parent session → consent screen → immutable consent_record
                                                   │
                                     only then ─────┴→ child_profile
```

## 9. State ownership

| State                                     | Owner                                                       | Persistence             |
| ----------------------------------------- | ----------------------------------------------------------- | ----------------------- |
| Board, chain, target, score, moves, phase | immutable `game_engine.LevelState`, held by game controller | SQLite on every ready   |
| Active child, band, settings              | profile controller                                          | SQLite                  |
| Mastery, unlocks, wallet, badges          | `client_data` repositories, cached by controllers           | SQLite → sync           |
| Audio and accessibility                   | dedicated app controllers                                   | SQLite                  |
| Outbox depth and connectivity             | sync controller                                             | transient               |
| Subscription and parent settings          | server, cached locally                                      | Postgres + SQLite cache |

Controllers hold state and forward actions; they own no gameplay rules. The state
management dependency, if any, requires its own ADR and serialized lockfile edit.

## 10. Engine contracts and parity

The Dart public surface mirrors the semantics of the accepted TypeScript API:
create level, dispatch action, serialize/restore, analyze board, generate pack,
and update mastery. Dart naming may follow language conventions; the
language-neutral request/response schema in `contracts/` is authoritative for
cross-language parity.

Before the Dart engine becomes production-authoritative it must match:

1. golden seed → board snapshots;
2. action-log → state snapshots at every step;
3. canonical serialization fixtures;
4. solver analyses and generated packs;
5. the same 100,000 seeded reachable-state corpus.

Parity compares canonical JSON values, not source structures or debug strings.
Performance timestamps are tooling metadata and never engine output.

## 11. Determinism and content

A level is `(seed, bandConfig, levelRules)`. The tuple must reproduce the same
canonical board and engine state in the TypeScript oracle, Dart engine, Android,
iOS, web, CI, and content tools. Changing RNG consumption or iteration order is a
breaking content change guarded by golden fixtures.

Seed packs remain small and auditable. Arbitrary runtime seeds must be validated;
production content is drawn from validated packs, not assumed safe statistically.

## 12. Backend

The game is fully on-device. Supabase provides parent phone auth, immutable
consent, idempotent sync, reports, privacy export/erase, Storage, RLS, and the
billing webhook. RLS is mandatory on every table. V1 has no realtime gateway,
runtime AI, vector database, microservices, leaderboard, or level-content API.

## 13. Planned extension points — do not build in v1

Story episodes, session ribbon, fractions/decimals, constrained voice input, and
a live tutor remain planned. They attach through engine/content contracts and may
not mutate game state from UI or AI services. Flutter web is the default shared
web path after ADR-0011; a separate web stack requires a later ADR.

## 14. Performance budgets

Qualification runs on both ADR-0010 physical phones at verified 60 Hz.

| Budget                 |  Target |
| ---------------------- | ------: |
| Board frame CPU P95    |  <16 ms |
| Frame overrun P95      |   ≤0 ms |
| Janky/missed frames    |     <1% |
| `analyse()` on 8×8     |   <5 ms |
| Full refill compute    |  <40 ms |
| Cold start to playable |    <6 s |
| Warm start to Continue |    <2 s |
| Install size           |  <80 MB |
| Process PSS            | <220 MB |

The board is one Flame render surface and update loop, not 64 independently
rebuilding widgets. Rive characters remain outside the puzzle engine and must be
included in the controlled Gate 2 workload.

## 15. Security and privacy boundaries

The child zone has no network, billing, external-link, or cross-child-data path.
Telemetry is aggregated on-device and uploaded only as day-level rollups. Crash
reporting must scrub PII and attach no child identifier. Development uses only a
local/dev Supabase project; production credentials never enter development.

## 16. Change protocol

1. Consult §6 before adding a file.
2. Any dependency requires an ADR; `game_engine` and the TS oracle accept none.
3. Changing a public engine API or parity schema requires an ADR and worktree sync.
4. Breaking an invariant requires an ADR plus enforcement update in the same PR.
5. Architecture changes land with the code/config they govern.
6. Do not delete the TS oracle or reference packages until parity has passed and a
   retirement ADR names what replaces every consumer.

_Last reviewed: ADR-0011 Flutter rebaseline, 2026-08-14._
