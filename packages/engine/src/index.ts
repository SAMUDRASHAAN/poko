/**
 * FROZEN CONTRACT — the engine's only public surface. [INV-15]
 *
 * Bodies throw until implemented. Both agents code against these signatures from
 * Phase 0, so implementation and consumers proceed in parallel.
 *
 * Changing a signature requires an ADR and a sync point across worktrees.
 * An API surface snapshot test guards this file.
 */
import type {
  Analysis,
  Attempt,
  BandConfig,
  Board,
  GameAction,
  LevelRules,
  LevelState,
  Mastery,
  PuzzleSeed,
} from './types.js';
import type { Num } from './num.js';
import { createInitialState, generatePackInternal } from './generator.js';
import { dispatchGame } from './machine.js';
import { updateMasteryModel } from './mastery.js';
import { restoreState, serialiseState } from './serialisation.js';
import { analyseBoard } from './solver.js';

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not implemented yet (Phase 1)`);
    this.name = 'NotImplementedError';
  }
}

/** Build a fresh, validated level. Deterministic in `seed`. */
export function createLevel(seed: number, rules: LevelRules, band: BandConfig): LevelState {
  return createInitialState(seed, rules, band);
}

/** Pure reducer. Same state + same action = same next state, always. [INV-5] */
export function dispatch(state: LevelState, action: GameAction): LevelState {
  return dispatchGame(state, action);
}

/** Lossless with `restore`. [INV-7] */
export function serialise(state: LevelState): string {
  return serialiseState(state);
}

export function restore(blob: string): LevelState {
  return restoreState(blob);
}

/** Every solution for a target. Budget: under 5ms on an 8x8 board. */
export function analyse(board: Board, target: Num, rules: LevelRules): Analysis {
  return analyseBoard(board, target, rules);
}

/** Solution-first level generation. Never produces an impossible target. [INV-6] */
export function generatePack(bandId: string, count: number, seed: number): PuzzleSeed[] {
  return generatePackInternal(bandId, count, seed);
}

/** Exponential moving average update. Pure. */
export function updateMastery(previous: Mastery, attempt: Attempt): Mastery {
  return updateMasteryModel(previous, attempt);
}

export type {
  Analysis,
  Attempt,
  BandConfig,
  Board,
  Cell,
  Chain,
  Equation,
  GameAction,
  LevelRules,
  LevelState,
  Mastery,
  Operation,
  Phase,
  PowerUpId,
  PuzzleSeed,
  Solution,
  Tile,
  TileColour,
} from './types.js';
export type { Num } from './num.js';
export { int, frac, add, sub, mul, div, eq, isInt, fmt, ZERO, ONE } from './num.js';
export { createRng, type Rng } from './rng.js';
