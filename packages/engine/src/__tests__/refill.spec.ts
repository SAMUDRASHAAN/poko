import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createInitialState } from '../generator.js';
import { refillAfterRemoval, tideShuffle } from '../refill.js';
import { int } from '../num.js';
import { createRng } from '../rng.js';
import { analyseWithBand } from '../solver.js';
import type { Board, Tile } from '../types.js';
import { BAND, RULES, tile } from './fixtures.js';

/** Multiset of tile values+colours, order-independent — what a shuffle must preserve. */
function tileCensus(board: Board): Map<string, number> {
  const census = new Map<string, number>();
  for (const row of board.tiles) {
    for (const entry of row) {
      if (!entry) continue;
      const key = `${entry.value.n}/${entry.value.d}:${entry.colour}:${entry.operation}`;
      census.set(key, (census.get(key) ?? 0) + 1);
    }
  }
  return census;
}

/** How many tiles differ between two censuses, counting each surplus once. */
function censusDistance(before: Map<string, number>, after: Map<string, number>): number {
  let changed = 0;
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    changed += Math.max(0, (before.get(key) ?? 0) - (after.get(key) ?? 0));
  }
  return changed;
}

/** A board with a single colour and values that cannot reach the target. */
function unsolvableBoard(): Board {
  const tiles: Tile[][] = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => tile(`stuck-${row}-${col}`, 1, 'add')),
  );
  return { width: 8, height: 8, seed: 7, tiles };
}

describe('solution-aware refill [INV-6]', () => {
  it('keeps every refilled board solvable without mutating its input', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const state = createInitialState(seed, RULES, BAND);
        const solution = analyseWithBand(state.board, state.target, RULES, BAND).bestSolution;
        expect(solution).not.toBeNull();
        const before = JSON.stringify(state.board);
        const refilled = refillAfterRemoval(
          state.board,
          solution?.cells ?? [],
          state.band,
          state.rules,
          state.rngState,
        );
        expect(JSON.stringify(state.board)).toBe(before);
        expect(
          analyseWithBand(refilled.board, refilled.target, RULES, BAND).solutions.length,
        ).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it('repairs a board when removed cells do not provide an adjacent incoming pair', () => {
    const state = createInitialState(22, RULES, BAND);
    for (const rngState of [1, 2, 3, 4]) {
      const refilled = refillAfterRemoval(state.board, [], BAND, RULES, rngState);
      expect(analyseWithBand(refilled.board, refilled.target, RULES, BAND).isStuck).toBe(false);
    }
  });
});

/**
 * Layer 3 of the safety chain in ADR-0004: "full tideShuffle, solution guaranteed,
 * dressed as a story beat".
 *
 * The story beat is the point: the tide rearranges the tiles already on the board.
 * It must not quietly hand back a different board — that would replace the puzzle
 * the child was reasoning about instead of stirring it.
 */
describe('tideShuffle — safety chain layer 3 [INV-6]', () => {
  it('rearranges the existing tiles rather than inventing new ones', () => {
    const board = unsolvableBoard();
    const before = tileCensus(board);
    const shuffled = tideShuffle(board, int(BAND.maxTarget), RULES, BAND, createRng(11));
    // At most the two tiles seeded as the guaranteed solution may differ.
    expect(censusDistance(before, tileCensus(shuffled))).toBeLessThanOrEqual(2);
    expect(shuffled.width).toBe(board.width);
    expect(shuffled.height).toBe(board.height);
  });

  it('guarantees a solution even from a board that has none', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
        const state = createInitialState(seed, RULES, BAND);
        const shuffled = tideShuffle(unsolvableBoard(), state.target, RULES, BAND, createRng(seed));
        const analysis = analyseWithBand(shuffled, state.target, RULES, BAND);
        expect(analysis.solutions.length).toBeGreaterThan(0);
        expect(analysis.isStuck).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('is deterministic and does not mutate its input', () => {
    const board = unsolvableBoard();
    const before = JSON.stringify(board);
    const state = createInitialState(5, RULES, BAND);
    const first = tideShuffle(board, state.target, RULES, BAND, createRng(99));
    const second = tideShuffle(board, state.target, RULES, BAND, createRng(99));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(board)).toBe(before);
  });

  it('leaves refill holding the child’s own board when nothing is incoming', () => {
    // No cells removed, so layer 1 has nothing to seed into and layer 2 carries it.
    // Layer 3 is a true last resort and is not expected to fire here; what matters
    // is that whichever layer answers, it returns a stirred board and not a fresh
    // one — the old code regenerated from scratch at this point.
    const board = unsolvableBoard();
    for (const rngState of [1, 7, 23, 91]) {
      const refilled = refillAfterRemoval(board, [], BAND, RULES, rngState);
      const analysis = analyseWithBand(refilled.board, refilled.target, RULES, BAND);
      expect(analysis.solutions.length).toBeGreaterThan(0);
      // The board must still be the child's board, not a regenerated one.
      expect(censusDistance(tileCensus(board), tileCensus(refilled.board))).toBeLessThanOrEqual(2);
    }
  });
});
