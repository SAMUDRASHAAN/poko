# Poko's World — agent instructions

Canonical instructions for all coding agents. Claude Code reads this via `CLAUDE.md`,
which imports it. Codex reads it directly. Keep this file under 200 lines.

Architecture detail lives in `ARCHITECTURE.md`. Decisions live in `docs/adr/`.
Read those on demand — do not paste them here.

## Commands

| Task                                   | Command                          |
| -------------------------------------- | -------------------------------- |
| Install                                | `pnpm install --frozen-lockfile` |
| Typecheck                              | `pnpm typecheck`                 |
| Lint                                   | `pnpm lint`                      |
| Formatting                             | `pnpm format:check`              |
| Architecture boundaries                | `pnpm depcruise`                 |
| Unit tests                             | `pnpm test`                      |
| Solvability fuzz gate (Phase 1 onward) | `pnpm fuzz`                      |
| Dead code                              | `pnpm knip`                      |
| Phase 0 CI gate                        | `pnpm verify`                    |
| Gate 1 and later                       | `pnpm verify:gate1`              |

Scope commands to one package while working: `pnpm turbo run test --filter=@poko/engine`.

## Non-negotiable rules

1. Game logic lives in `packages/engine`. Never in components, stores, hooks or screens.
2. `packages/engine` imports nothing — not React, not React Native, not our other packages,
   no npm runtime dependency. Standard library only. [INV-1]
3. All randomness goes through `rng.ts` with an explicit seed. Never `Math.random()`. [INV-3]
4. Gameplay values use the `Num` type from `num.ts`. Never a raw `number`, never a float. [INV-4]
5. Colours, spacing, radii and font sizes come from `packages/ui/src/tokens.ts`.
   No hex literals, no magic numbers in styles. [INV-13]
6. `dispatch(state, action)` is a pure reducer. No I/O, no `Date.now()`, no mutation. [INV-5]
7. Child-zone code never touches the network, ads, external links, or third-party analytics. [INV-12]
8. Never store a child's full date of birth. Birth **year** only. [INV-11]
9. Import from a package root (`@poko/engine`), never a deep path (`@poko/engine/src/solver`).
10. Minimum touch target in the child zone is 64x64 px. [INV-14]

## Frozen contract

These files are frozen. Changing them requires an ADR and a sync point across worktrees:

- `packages/engine/src/types.ts`
- `packages/engine/src/index.ts` (signatures)
- `packages/ui/src/tokens.ts`

Additions to `tokens.ts` are allowed. Changes to existing tokens are not.

## Definition of done

A Phase 0 task is done when `pnpm verify` is green:
typecheck, lint, formatting, depcruise, tests, coverage >=90% on implemented engine code, knip.
From Gate 1 onward, `pnpm verify:gate1` additionally requires the 100k-board fuzz gate.

Not "it works on my machine". Not "tests are mostly passing".

## Working agreement

- Stay inside the "May edit" list in your task contract. Read widely, write narrowly.
- Write the failing test first, then make it green.
- Small commits, conventional format: `feat(engine): add chain extension guard`.
- Never add a dependency without an ADR. `packages/engine` accepts none, ever.
- Never edit `package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `.claude/rules/**` or CI config
  without being asked. Propose the change instead.
- If two rules conflict, stop and ask. Do not pick one.
- If you are about to create a new top-level folder, stop. Consult `ARCHITECTURE.md` section 6.

## Where code goes

Consult `ARCHITECTURE.md` section 6 for the full table. The heuristic:

> If a rule would still be true in a text-only version of this game with no screen,
> it belongs in `packages/engine`.

## Testing

- Engine: unit tests for every branch, plus property tests with `fast-check` for
  generator, solver, refill. Examples alone are not sufficient for those three.
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
