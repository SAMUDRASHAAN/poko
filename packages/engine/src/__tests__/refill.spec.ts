import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createInitialState } from '../generator.js';
import { refillAfterRemoval } from '../refill.js';
import { analyseWithBand } from '../solver.js';
import { BAND, RULES } from './fixtures.js';

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
