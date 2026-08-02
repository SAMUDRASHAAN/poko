import { chainResult } from './equation.js';
import { sub, type Num } from './num.js';
import { analyseWithBand } from './solver.js';
import type { Analysis, BandConfig, Board, Cell, LevelRules } from './types.js';

/**
 * Decoy quality [ADR-0004, ADR-0009].
 *
 * 60% of decoy pairs must evaluate within +/-3 of the target. Weak decoys let a
 * child eliminate visually instead of calculating, which destroys the teaching
 * value silently — no other check in the engine would notice.
 */
export const DECOY_NEAR_RATIO = 0.6;
export const DECOY_NEAR_DISTANCE = 3;

/**
 * A ratio over a handful of pairs is meaningless: without a floor, a board with
 * almost no chainable pairs would pass while being trivially eliminable.
 */
const MIN_CHAINABLE_DECOYS = 24;

/** How many best-fitting targets a refill may try before choosing freely. */
const TARGET_CANDIDATES = 12;

const ORTHOGONAL_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
];

const DIAGONAL_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

type DecoyQuality = {
  /** Adjacent same-colour pairs whose result is not the target. */
  readonly chainable: number;
  /** Of those, how many land within +/-3 of the target. */
  readonly near: number;
  readonly ratio: number;
};

/**
 * Walks every adjacent chainable pair once, in reading order (top-left tile
 * first) — the order a child scans them in. `sub` and `div` are not commutative,
 * so selecting the same two tiles in reverse is a different equation and is not
 * counted here.
 */
function forEachChainablePair(board: Board, band: BandConfig, visit: (result: Num) => void): void {
  const deltas = band.allowDiagonals ? DIAGONAL_PAIRS : ORTHOGONAL_PAIRS;

  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) {
      for (const [rowDelta, colDelta] of deltas) {
        const partner: Cell = { row: row + rowDelta, col: col + colDelta };
        if (partner.row >= board.height || partner.col >= board.width || partner.col < 0) continue;

        const result = chainResult(board, [{ row, col }, partner], band);
        if (result !== null) visit(result);
      }
    }
  }
}

export function decoyQuality(board: Board, target: Num, band: BandConfig): DecoyQuality {
  let chainable = 0;
  let near = 0;

  forEachChainablePair(board, band, (result) => {
    const delta = sub(result, target);
    if (delta.n === 0) return; // a solution, not a decoy

    chainable += 1;
    // Exact rational comparison: |n/d| <= 3 without touching a float. [INV-4]
    if (Math.abs(delta.n) <= DECOY_NEAR_DISTANCE * delta.d) near += 1;
  });

  return { chainable, near, ratio: chainable === 0 ? 0 : near / chainable };
}

/**
 * Targets ranked by how many of this board's existing pairs they turn into near
 * misses, best first.
 *
 * A refill chooses a NEW target while most tiles survive, so picking that target
 * blind throws away the tuning those survivors already carry.
 *
 * Scores every legal target in one pass with a prefix-summed histogram, and
 * subtracts exact hits because those become solutions, not decoys.
 */
export function rankTargetsForBoard(board: Board, band: BandConfig): number[] {
  // Spans the values actually on the board, not a fixed 0..maxTarget window: a
  // band that allows negatives produces negative pair results, and clamping them
  // away hides most of the board from the scoring.
  const values: number[] = [];
  forEachChainablePair(board, band, (result) => {
    if (result.d === 1) values.push(result.n);
  });
  if (values.length === 0) return [];

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const histogram = new Array<number>(highest - lowest + 1).fill(0);
  for (const value of values) {
    histogram[value - lowest] = (histogram[value - lowest] ?? 0) + 1;
  }

  const prefix = new Array<number>(histogram.length + 1).fill(0);
  for (let index = 0; index < histogram.length; index += 1) {
    prefix[index + 1] = (prefix[index] ?? 0) + (histogram[index] ?? 0);
  }

  const countBetween = (from: number, to: number): number => {
    const low = Math.max(0, from - lowest);
    const high = Math.min(histogram.length - 1, to - lowest);
    if (high < low) return 0;
    return (prefix[high + 1] ?? 0) - (prefix[low] ?? 0);
  };

  // A target must itself be legal for the band, even if the board's values roam
  // beyond that.
  const firstTarget = band.allowNegatives ? lowest : Math.max(0, lowest);
  const lastTarget = Math.min(highest, band.maxTarget);

  const scored: { target: number; score: number }[] = [];
  for (let target = firstTarget; target <= lastTarget; target += 1) {
    scored.push({
      target,
      score:
        countBetween(target - DECOY_NEAR_DISTANCE, target + DECOY_NEAR_DISTANCE) -
        (histogram[target - lowest] ?? 0),
    });
  }

  // Ranked, not just the winner: the best-fitting target is not always one the
  // band can actually build a guaranteed solution for, and falling straight back
  // to a blind choice throws away the fit entirely.
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TARGET_CANDIDATES)
    .map((entry) => entry.target);
}

type ValidationReason = 'unsolvable' | 'tooFewSolutions' | 'tooManySolutions' | 'weakDecoys';

type PuzzleValidation = {
  readonly valid: boolean;
  readonly analysis: Analysis;
  readonly reasons: readonly ValidationReason[];
};

export function validatePuzzle(
  board: Board,
  target: Parameters<typeof analyseWithBand>[1],
  rules: LevelRules,
  band: BandConfig,
): PuzzleValidation {
  const analysis = analyseWithBand(board, target, rules, band);
  const reasons: ValidationReason[] = [];
  if (analysis.isStuck) reasons.push('unsolvable');
  if (analysis.solutions.length < band.minSolutions) reasons.push('tooFewSolutions');
  if (analysis.solutions.length > band.maxSolutions) reasons.push('tooManySolutions');

  const decoys = decoyQuality(board, target, band);
  if (decoys.chainable < MIN_CHAINABLE_DECOYS || decoys.ratio < DECOY_NEAR_RATIO) {
    reasons.push('weakDecoys');
  }

  return { valid: reasons.length === 0, analysis, reasons };
}
