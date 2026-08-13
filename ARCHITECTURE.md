# ARCHITECTURE.md

Canonical architecture for **Poko's World** — the child learning app whose v1 release is **Tally Sea**, a numeracy puzzle game.

> **For agents:** read this before writing code in a package you haven't touched this session. §6 (_Where does this code go?_) and §7 (_Invariants_) answer most questions without reading further. Every invariant has a mechanical enforcement — if you think you need to break one, stop and write an ADR instead.

|             |                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **Status**  | Living document. Changes require an ADR (see §17)                                              |
| **Scope**   | The complete system. v1 is built; v2/v3 extension points are marked **PLANNED — do not build** |
| **Related** | `AGENTS.md` (rules) · `docs/00-product-spec.md` (game design) · `docs/adr/` (decisions)        |

---

## 1. What this system is

A cross-platform learning app for children aged 4–12, offline-first, parent-gated, with no ads and no behavioural profiling of children.

- **v1 (building now)** — _Tally Sea_: an 8×8 number-puzzle game. Solution-first puzzle generation, on-device, deterministic. Poko is a scripted host. Spoken output, no voice input, no AI at runtime.
- **v2 (planned)** — episodic story content and the _session ribbon_ that binds story to puzzle. Constrained voice input.
- **v3 (planned)** — live conversational AI tutor beats.

**The architecture's central bet:** all game rules live in one pure-TypeScript package with no dependencies and no UI imports, so correctness can be proved in CI without a device, and so the same logic runs unchanged in the app, the web build, the level-generation CLI, and the test harness.

---

## 2. System map

```
┌────────────────────────────────────────────────────────────────────┐
│ CLIENT — Expo / React Native (iOS, Android) · Vite + React (web)   │
│                                                                    │
│  screens (expo-router)   board (Skia)   components (packages/ui)   │
│           │                   │                  │                 │
│           └───────────────────┴──────────────────┘                 │
│                               │                                    │
│                      stores (Zustand) — holds state, owns no rules │
│                               │                                    │
│           ┌───────────────────┴────────────────────┐               │
│           │      packages/engine  (PURE TS)        │  ⭐            │
│           │  board · equation · generator · solver │               │
│           │  validator · refill · difficulty       │               │
│           │  scoring · mastery · state machine     │               │
│           └───────────────────┬────────────────────┘               │
│                               │                                    │
│         packages/client-data — SQLite repositories + sync outbox   │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTPS, batched, idempotent
┌───────────────────────────────┴────────────────────────────────────┐
│ BACKEND — Supabase                                                 │
│  Auth (parent phone OTP)  ·  Postgres + RLS  ·  Edge Functions     │
│  consent · sync · reports · privacy export/erase · billing hook    │
│  Storage: level seed packs, VO packs, data exports                 │
└────────────────────────────────────────────────────────────────────┘
```

**Children never authenticate.** There is no child credential anywhere in the system. All child data is reached through the parent's session.

---

## 3. Repository layout

```
poko/
├── packages/
│   ├── engine/        ⭐ pure TS. Zero runtime dependencies. No UI imports. Ever.
│   ├── ui/               design tokens + presentational primitives
│   ├── content/          level seeds, band configs, copy strings, VO manifest
│   └── client-data/      SQLite schema, repositories, sync outbox
├── apps/
│   ├── mobile/           Expo app (iOS + Android)
│   ├── web/              Vite + React            [v1.1 — scaffolded, not shipped]
│   └── api/              Supabase project: migrations, RLS policies, Edge Functions
├── tools/
│   ├── levelgen/         Node CLI — generates and validates level seed packs
│   └── fuzz/             Node — property-based solvability harness (CI gate)
└── docs/                 specs + ADRs
```

---

## 4. Package dependency rule

```
        apps/mobile ──┬──► packages/ui
        apps/web    ──┤
                      ├──► packages/client-data ──► packages/engine
                      ├──► packages/content ──────► packages/engine
                      └──► packages/engine

        tools/*     ──────► packages/engine
        apps/api    ──────► (nothing in this repo — standalone)
```

**Arrows point one way only. There are no upward imports.**

| Package       | May import                       | May NOT import                                                     |
| ------------- | -------------------------------- | ------------------------------------------------------------------ |
| `engine`      | **nothing** (stdlib only)        | React, React Native, Expo, our other packages, any npm runtime dep |
| `ui`          | React, RN, `engine` types only   | app code, client-data, content                                     |
| `content`     | `engine`                         | React, RN, UI, app code                                            |
| `client-data` | `engine`, sqlite driver          | React components, UI                                               |
| `apps/*`      | everything above                 | each other                                                         |
| `tools/*`     | `engine`, `content`, node stdlib | React, RN, UI, apps                                                |

Enforced by `.dependency-cruiser.js`. A violation fails CI (`pnpm depcruise`).

---

## 5. Layer model

The ten logical layers from the product spec, mapped onto real packages:

| #   | Layer                                                      | Lives in                                     |
| --- | ---------------------------------------------------------- | -------------------------------------------- |
| 1   | UI — screens, board renderer, HUD, gestures                | `apps/mobile/src/{app,board,components}`     |
| 2   | Board engine — grid, adjacency, swap, gravity, refill      | `packages/engine/{board,refill}.ts`          |
| 3   | Equation engine — evaluation, precedence, validity         | `packages/engine/{equation,num}.ts`          |
| 4   | Puzzle generator — solution-first construction, decoys     | `packages/engine/generator.ts`               |
| 5   | Puzzle validator — solvability proof, accidental solutions | `packages/engine/{solver,validator}.ts`      |
| 6   | Difficulty manager — scoring, band rules, curves           | `packages/engine/difficulty.ts`              |
| 7   | Adaptive engine — mastery model, scheduler, target picker  | `packages/engine/{mastery,target}.ts`        |
| 8   | Progress & reward — stars, coins, badges, streaks          | `packages/engine/scoring.ts` + `client-data` |
| 9   | Parent dashboard — reports, controls, privacy, billing     | `apps/mobile/src/app/parent/*` + `apps/api`  |
| 10  | Audio & accessibility services                             | `apps/mobile/src/services/*`                 |

Layers 2–7 are entirely inside `engine`. That is the point.

---

## 6. Where does this code go?

The decision table. Consult this before creating any file.

| If you are writing…                                    | It goes in                                       | Never in                       |
| ------------------------------------------------------ | ------------------------------------------------ | ------------------------------ |
| A rule about what counts as a valid move               | `engine/equation.ts`                             | a component, a store, a hook   |
| Anything that decides _what the player sees next_      | `engine/`                                        | the screen that renders it     |
| A number that affects gameplay                         | `engine/` using `Num`                            | anywhere as a raw `number`     |
| Randomness of any kind                                 | `engine/rng.ts`, seeded                          | `Math.random()`, anywhere      |
| A colour, spacing value, radius, or font size          | `packages/ui/tokens.ts`                          | inline styles, component files |
| A reusable visual element with no game knowledge       | `packages/ui/`                                   | `apps/mobile/src/components`   |
| A visual element that knows about tiles/targets/chains | `apps/mobile/src/components/`                    | `packages/ui`                  |
| Board drawing or gesture handling                      | `apps/mobile/src/board/`                         | components, screens            |
| A screen or route                                      | `apps/mobile/src/app/`                           | anywhere else                  |
| Reading or writing persisted data                      | `packages/client-data/` repositories             | components, screens, services  |
| A network call                                         | `apps/mobile/src/services/sync.ts` or `apps/api` | components, engine             |
| Level definitions                                      | `packages/content/levels/*.json` as **seeds**    | hand-authored boards           |
| A migration or RLS policy                              | `apps/api/migrations/`                           | client code                    |
| Something you're not sure about                        | ask, or write an ADR                             | a new top-level folder         |

**Heuristic:** if a rule would still be true in a text-only version of this game with no screen, it belongs in `engine`.

---

## 7. Invariants

Numbered so ADRs, lint rules, PR reviews and commit messages can reference them ("violates INV-4").

| ID         | Invariant                                                                                            | Enforced by                                           |
| ---------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **INV-1**  | `packages/engine` imports nothing outside the stdlib                                                 | dependency-cruiser                                    |
| **INV-2**  | Game rules exist only in `engine`. Components and stores contain no rules                            | dependency-cruiser + engine coverage ≥90%             |
| **INV-3**  | All randomness flows through `rng.ts` with an explicit seed                                          | ESLint ban on `Math.random()` + golden-seed snapshots |
| **INV-4**  | Gameplay values use the `Num` type. Never a raw float                                                | type system + ESLint                                  |
| **INV-5**  | `dispatch(state, action)` is a **pure reducer** — no I/O, no `Date.now()`, no mutation               | unit tests + review                                   |
| **INV-6**  | Every reachable board state has **at least one solution** for its current target                     | `pnpm fuzz` — 100k property-tested states             |
| **INV-7**  | Game state is fully serialisable; `serialise → restore` is lossless                                  | round-trip property test                              |
| **INV-8**  | The app is fully playable with the network permanently off                                           | E2E airplane-mode suite                               |
| **INV-9**  | SQLite on device is the source of truth; the server is a sync target                                 | architecture review                                   |
| **INV-10** | No child data is processed before a valid `consent_record` exists                                    | server-side check in every child-data Edge Function   |
| **INV-11** | No child's full date of birth is stored anywhere. Birth **year** only                                | schema + migration review                             |
| **INV-12** | No third-party analytics or ad SDK exists in the child zone; telemetry is device-side aggregate only | dependency audit in CI                                |
| **INV-13** | Every visual token comes from `tokens.ts`                                                            | ESLint hex-literal ban                                |
| **INV-14** | Every interactive element in the child zone is ≥64×64 px                                             | component tests                                       |
| **INV-15** | The engine's public API changes only via a reviewed diff                                             | API surface snapshot test                             |

---

## 8. Core data flows

### 8.1 Gameplay tick (the hot path — runs hundreds of times per session)

```
finger moves
  → Reanimated worklet (UI thread) updates the drag path        ← no React render
  → on cell entry: engine.dispatch(EXTEND_CHAIN)                 ← pure, <1ms
  → equation preview recomputed, rendered on the Skia canvas
release
  → engine.dispatch(COMMIT)
     ├─ chain ≠ target → REJECTING → back to READY (no penalty, no move cost)
     └─ chain = target → RESOLVING → REFILLING → TARGET_ROTATING → READY
                             │
                             ├─ removeTiles → applyGravity
                             ├─ selectTarget(learnerModel)     weak skills weighted ×3
                             ├─ solution-aware refill: seed → repair → tideShuffle
                             └─ solver.analyse() asserts ≥1 solution      [INV-6]
  → state persisted to SQLite on return to READY                 [INV-7]
  → attempt row queued to the sync outbox
```

`RESOLVING → REFILLING → TARGET_ROTATING` is **atomic in the engine** even though the UI animates it over ~700 ms. Input is accepted only in `READY`, `DRAGGING`, `PREVIEWING`.

### 8.2 Persistence and sync

```
engine state ──► repository ──► SQLite (source of truth)  [INV-9]
                                   │
                                   └─► outbox row (uuid + updated_at)
                                            │
                       connectivity ────► POST /sync (batch)
                                            │
                            server applies idempotently, last-write-wins
                            on updated_at; progress resolves "best wins"
                                            │
                                   ◄── server changes since cursor ──► merge
```

### 8.3 Consent and auth (blocking — nothing child-related happens before it completes)

```
phone → OTP → parent session → CONSENT SCREEN → consent_record (immutable, append-only)
                                                        │
                                          ── only now ──┴──► child_profile may be created
```

Enforced server-side, not just in the UI. [INV-10]

---

## 9. State ownership

Exactly one owner per category. If you need state, find its owner rather than adding a new store.

| State                                     | Owner                                              | Persisted                |
| ----------------------------------------- | -------------------------------------------------- | ------------------------ |
| Board, chain, target, score, moves, phase | `engine.LevelState`, held by `gameSlice`           | SQLite, on every `READY` |
| Active child, band, tier, settings        | `profileSlice`                                     | SQLite                   |
| Mastery per skill                         | `client-data` repository, cached in `profileSlice` | SQLite → synced          |
| Unlocks, streak, wallet, badges           | `metaSlice`                                        | SQLite → synced          |
| Audio volumes, mute                       | `audioSlice`                                       | SQLite                   |
| Accessibility variants                    | `a11ySlice`                                        | SQLite                   |
| Outbox depth, online status               | `syncSlice`                                        | transient                |
| Parent settings, subscription             | server, cached locally                             | Postgres                 |

**Stores hold state and forward actions. They contain no rules.** If you write `if (chain.length > 2)` in a store or component, it belongs in the engine. [INV-2]

---

## 10. The engine contract

```ts
// packages/engine/src/index.ts — the only public surface  [INV-15]
export function createLevel(seed: number, rules: LevelRules, band: BandConfig): LevelState;
export function dispatch(state: LevelState, action: GameAction): LevelState; // pure  [INV-5]
export function serialise(state: LevelState): string;
export function restore(blob: string): LevelState;
export function analyse(board: Board, target: Num, rules: LevelRules): Analysis;
export function generatePack(bandId: string, count: number, seed: number): PuzzleSeed[];
export function updateMastery(prev: Mastery, attempt: Attempt): Mastery;
export type { LevelState, GameAction, Board, Tile, Num, LevelRules, BandConfig, Analysis };
```

Everything else in `engine` is internal. Consumers import from the package root, never from deep paths.

Performance measurements and validation timestamps are tooling metadata, not engine outputs. The
engine never reads a clock to populate return values; callers benchmark pure calls externally. [INV-5]

**The type contract (`types.ts` + these signatures) is frozen after Phase 0.** Changing it requires an ADR and a sync point across all active worktrees — see `docs/WORKTREE-PLAN.md` §7.

---

## 11. Determinism and the content model

A level **is a seed**. `(seed, bandConfig, levelRules)` reproduces a byte-identical board on every platform, every run, forever.

Consequences worth internalising:

- Level packs are ~12 bytes per level, not 12 KB. They ship in the bundle and update over-the-air.
- Bug reports are reproducible from a seed and an action log.
- Scores are verifiable server-side by replaying the action log through the same pure reducer.
- Daily challenges are shareable: everyone gets the identical board from one seed.
- **Any change to iteration order or RNG consumption in the engine silently changes every existing level.** This is why golden-seed snapshot tests exist. [INV-3]

---

## 12. Backend

Deliberately small — roughly 800–1,200 lines total for v1. The game runs entirely on-device; the server does five things:

| Concern     | Implementation                                          |
| ----------- | ------------------------------------------------------- |
| Parent auth | Supabase Auth, phone OTP. No child credentials [INV-10] |
| Consent     | Edge Function → append-only `consent_record`            |
| Sync        | Edge Function, batched, idempotent                      |
| Reports     | Edge Function, plain-language weekly rollup             |
| Privacy     | Export + erase Edge Functions (DPDP data rights)        |
| Billing     | RevenueCat webhook → `subscription`                     |

**RLS on every table, no exceptions.** Parents reach child rows only through `child_profile.parent_id = auth.uid()`.

**Not built, and not to be built in v1:** realtime gateway, AI orchestration, pgvector, microservices, leaderboards, level content API.

---

## 13. Extension points (v2/v3) — **do not build yet**

Designed for, deliberately absent. Marked here so nobody designs them out by accident.

| Future               | Where it attaches                                                                 | Guard                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Story episodes       | `content` gains `episodes/`; a `StoryPlayer` sits beside `board/`                 | Episode → puzzle binding is one-way: story declares `target_skills` + narrative target, the generator satisfies it |
| Session ribbon       | Ribbon state machine joins `engine/machine.ts`                                    | Ribbon phases wrap level phases; level machine is unchanged                                                        |
| Fractions / decimals | `num.ts` swaps its integer backing for full rational arithmetic                   | **Every signature already takes `Num`, so no call site changes** [INV-4]                                           |
| Voice input          | New service; `engine` exposes the expected-answer set per beat                    | Constrained recognition only; tap fallback is permanent                                                            |
| Live AI tutor        | New realtime gateway + orchestration service, outside this repo's client packages | Engine stays pure; AI never mutates game state directly                                                            |
| Web                  | `apps/web` imports the same `engine` and most of `ui`                             | Already scaffolded; keep `ui` free of RN-only APIs where practical                                                 |

---

## 14. Performance budgets

Measured on two physical phones in the approved managed low-end profile
(ADR-0010: ARM64, 3–4 GiB RAM, value-class SoC, 60 Hz), never a simulator.

| Budget                    | Target                     |
| ------------------------- | -------------------------- |
| Board frame time          | < 16 ms sustained (60 fps) |
| `analyse()` on 8×8        | < 5 ms                     |
| Full refill cycle compute | < 40 ms                    |
| Cold start → playable     | < 6 s                      |
| Warm start → Continue     | < 2 s                      |
| Install size              | < 80 MB                    |
| Memory ceiling            | < 220 MB                   |

Board rendering is **one Skia canvas with a pre-rendered tile atlas**, not 64 React views. Drag runs in Reanimated worklets on the UI thread; React re-renders only on state transitions.

---

## 15. Security and privacy boundaries

- The child zone has **no path** to the network, billing, external links, or another child's data.
- The parent gate is the only door and is one-way: leaving the parent zone returns to Profile Select, never into a child session.
- Telemetry is aggregated **on device** and uploaded as day-level rollups. No event streams, no third-party SDK in the child zone. [INV-12]
- Crash reporting runs with PII scrubbing on and no child identifiers attached.
- Agents and developers use a **local/dev Supabase project**. Production credentials never enter a development environment.

---

## 16. Glossary

| Term           | Meaning                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| **Band**       | Skill difficulty tier (1–5). Procedural, cheap, fine-grained                     |
| **Tier**       | Narrative maturity tier (1–3). Authored, expensive, coarse                       |
| **Chain**      | An ordered path of adjacent same-colour tiles forming one equation               |
| **Target**     | The number the current chain must equal. Changes after every solve               |
| **Beat**       | A discrete interaction moment inside an episode **[v2]**                         |
| **Ribbon**     | The single daily session: episode → puzzle → resolution → wind-down **[v2]**     |
| **Seed**       | The integer that deterministically reproduces a board                            |
| **Setup move** | A swap required before any solution becomes reachable. The main difficulty lever |
| **Sumling**    | A number creature; a tile                                                        |

---

## 17. Change protocol

1. **Adding a file** — consult §6. If it doesn't fit any row, that's a signal to ask, not to invent a folder.
2. **Adding a dependency** — ADR required. `engine` accepts none, ever. [INV-1]
3. **Changing the engine's public API or `types.ts`** — ADR + a sync point across active worktrees.
4. **Breaking an invariant** — not a code change, an ADR. If the ADR is accepted, update §7 and the enforcement mechanism in the same PR.
5. **Changing this document** — in the same PR as the code it describes. A doc that lags the code is worse than no doc, because agents will trust it.

```

```

---

_Last reviewed: at Phase 0 completion. Re-review at each gate._
