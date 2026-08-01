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

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not implemented yet (Phase 1)`);
    this.name = 'NotImplementedError';
  }
}

/** Build a fresh, validated level. Deterministic in `seed`. */
export function createLevel(_seed: number, _rules: LevelRules, _band: BandConfig): LevelState {
  throw new NotImplementedError('createLevel');
}

/** Pure reducer. Same state + same action = same next state, always. [INV-5] */
export function dispatch(_state: LevelState, _action: GameAction): LevelState {
  throw new NotImplementedError('dispatch');
}

/** Lossless with `restore`. [INV-7] */
export function serialise(_state: LevelState): string {
  throw new NotImplementedError('serialise');
}

export function restore(_blob: string): LevelState {
  throw new NotImplementedError('restore');
}

/** Every solution for a target. Budget: under 5ms on an 8x8 board. */
export function analyse(_board: Board, _target: Num, _rules: LevelRules): Analysis {
  throw new NotImplementedError('analyse');
}

/** Solution-first level generation. Never produces an impossible target. [INV-6] */
export function generatePack(_bandId: string, _count: number, _seed: number): PuzzleSeed[] {
  throw new NotImplementedError('generatePack');
}

/** Exponential moving average update. Pure. */
export function updateMastery(_prev: Mastery, _attempt: Attempt): Mastery {
  throw new NotImplementedError('updateMastery');
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
