# Poko's World — agent instructions

Canonical instructions for all coding agents. Claude Code reads this via `CLAUDE.md`,
which imports it. Codex reads it directly. Keep this file under 200 lines.

Architecture detail lives in `ARCHITECTURE.md`. Decisions live in `docs/adr/`.
Read those on demand — do not paste them here.

## Commands

| Task                                   | Command                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Install                                | `pnpm install --frozen-lockfile`                                                                                                       |
| Typecheck                              | `pnpm typecheck`                                                                                                                       |
| Lint                                   | `pnpm lint`                                                                                                                            |
| Formatting                             | `pnpm format:check`                                                                                                                    |
| Architecture boundaries                | `pnpm depcruise`                                                                                                                       |
| Unit tests                             | `pnpm test`                                                                                                                            |
| Solvability fuzz gate (Phase 1 onward) | `pnpm fuzz`                                                                                                                            |
| Dead code                              | `pnpm knip`                                                                                                                            |
| Phase 0 CI gate                        | `pnpm verify`                                                                                                                          |
| Gate 1 and later                       | `pnpm verify:gate1`                                                                                                                    |
| Flutter locked install                 | `cd flutter && flutter pub get --enforce-lockfile`                                                                                     |
| Flutter format/analyze/audit/tests     | `cd flutter && dart run tool/verify_workspace.dart`                                                                                    |
| Flutter Android release                | `cd flutter/apps/mobile && flutter build apk --release --target-platform android-arm64 --split-per-abi`                                |
| Android benchmark APKs                 | `cd flutter/apps/mobile/android && ./gradlew :app:assembleBenchmark :macrobenchmark:assembleBenchmark -Ptarget-platform=android-arm64` |

Scope commands to one package while working: `pnpm turbo run test --filter=@poko/engine`.

## Non-negotiable rules

1. Production game logic lives in `flutter/packages/game_engine`; the retained
   `packages/engine` is its executable TypeScript oracle. Never put rules in widgets,
   controllers, stores or screens.
2. Both engines have zero runtime dependencies. Dart engine code may import Dart core
   implicitly and its own package only; TypeScript engine code imports no package. [INV-1]
3. All randomness uses an explicit seeded engine RNG. Never `Random()` or `Math.random()`
   at a call site. [INV-3]
4. Gameplay values use the engine `Num` type, never `double`, raw float arithmetic or
   a UI number. [INV-4]
5. Production visual values come from
   `flutter/packages/design_system/lib/src/tokens.dart`; the TypeScript token file is
   the frozen migration oracle. No colour or magic style literals elsewhere. [INV-13]
6. `dispatch(state, action)` is a pure reducer. No I/O, no `Date.now()`, no mutation. [INV-5]
7. Child-zone code never touches the network, ads, external links, or third-party analytics. [INV-12]
8. Never store a child's full date of birth. Birth **year** only. [INV-11]
9. Import another package from its public root, never its `src/` path.
10. Minimum touch target in the child zone is 64×64 logical pixels. [INV-14]

## Frozen contract

These files are frozen. Changing them requires an ADR and a sync point across worktrees:

- `packages/engine/src/types.ts`
- `packages/engine/src/index.ts` (signatures)
- `packages/ui/src/tokens.ts`
- `flutter/packages/game_engine/lib/poko_game_engine.dart`
- `flutter/packages/game_engine/lib/src/{api,num,types}.dart`
- `flutter/packages/design_system/lib/src/tokens.dart`
- `contracts/schema/**`

Additions to `tokens.ts` are allowed. Changes to existing tokens are not.

## Definition of done

A foundation task is done only when `pnpm verify:gate1` and
`cd flutter && dart run tool/verify_workspace.dart` are green, plus the relevant
Android artifact builds. Gate 1F additionally requires cross-language parity, Dart
coverage >=90%, and the 100k-state Dart fuzz gate.

Not "it works on my machine". Not "tests are mostly passing".

## Working agreement

- Stay inside the "May edit" list in your task contract. Read widely, write narrowly.
- Task contracts reference only in-repo paths that exist at prompt time. If a contract
  names a file that is not there, say so and stop — never reconstruct what it was
  supposed to contain. A spec you invent is indistinguishable from one you were given,
  and reviewers cannot tell which they are reading.
- Write the failing test first, then make it green.
- Small commits, conventional format: `feat(engine): add chain extension guard`.
- **Agents do not merge.** Take the work to a green PR, say plainly that it is ready,
  and stop. A human lands it. This covers docs-only and test-only PRs too — those
  especially. Green CI is not the bar it looks like: in a test-only PR the thing being
  changed _is_ the detector, so lowering a threshold, widening a tolerance or deleting
  a sweep passes by construction. This repo has shipped that exact failure twice —
  decoy quality was specified in three documents and violated for an entire phase, and
  `band.maxSolutions` was breached on 96.7% of sprout boards for the project's whole
  life. CI was green throughout both.
- Permission to merge is never inherited. Being told to merge one PR, or watching a
  human merge a run of them, authorises nothing afterwards. Absent an instruction about
  the PR in front of you, you do not merge it — "this is how we have been doing it" is
  not an instruction.
- Never add a dependency without an ADR. `packages/engine` accepts none, ever.
- Never edit dependency manifests, lockfiles, agent rules or CI unless your task owns
  that shared surface. Every new third-party dependency requires an ADR.
- If two rules conflict, stop and ask. Do not pick one.
- If you are about to create a new top-level folder, stop. Consult `ARCHITECTURE.md` section 6.

## Where code goes

Consult `ARCHITECTURE.md` section 6 for the full table. The heuristic:

> If a rule would still be true in a text-only version of this game with no screen,
> it belongs in `packages/engine`.

## Testing

- Engines: unit tests for every branch, plus seeded property/fuzz tests for generator,
  solver and refill. Examples alone are not sufficient for those three.
- Until Gate 1F, every Dart result must match the language-neutral fixtures exported
  from the pinned TypeScript oracle; do not rewrite expected fixtures to make a port pass.
- Golden-seed snapshots guard determinism. If a snapshot changes, you changed board
  generation for every existing level — that is a breaking change, not a fix.
- Components: render in all accessibility variants.

## Privacy and safety

This is a product for children under 13 in a jurisdiction with strict child-data law.

- No third-party analytics or ad SDK anywhere in the client. Telemetry is aggregated
  on device and uploaded as day-level rollups only.
- No child credential exists. Children never authenticate.
- No child data is processed before a valid `consent_record` exists — enforced server-side.
- Use the local/dev Supabase project. Production credentials never enter development.
