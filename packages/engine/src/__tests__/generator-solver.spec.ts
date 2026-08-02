import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  chooseGuaranteedSolution,
  createInitialState,
  defaultBand,
  generatePackInternal,
  randomTile,
} from '../generator.js';
import { eq, int } from '../num.js';
import { createRng } from '../rng.js';
import { analyseBoard, analyseWithBand } from '../solver.js';
import type { Board } from '../types.js';
import { validatePuzzle } from '../validator.js';
import { BAND, RULES } from './fixtures.js';

describe('solution-first generation and solver [INV-3, INV-6]', () => {
  it('is deterministic in seed and pins a golden board', () => {
    const first = createInitialState(12345, RULES, BAND);
    const second = createInitialState(12345, RULES, BAND);
    expect(first).toEqual(second);
    expect({
      target: first.target,
      firstRow: first.board.tiles[0]?.map((entry) =>
        entry ? [entry.value.n, entry.operation, entry.colour] : null,
      ),
    }).toMatchInlineSnapshot(`
      {
        "firstRow": [
          [
            8,
            "add",
            "coral",
          ],
          [
            7,
            "add",
            "coral",
          ],
          [
            3,
            "add",
            "coral",
          ],
          [
            6,
            "add",
            "coral",
          ],
          [
            5,
            "sub",
            "marine",
          ],
          [
            5,
            "sub",
            "marine",
          ],
          [
            9,
            "sub",
            "marine",
          ],
          [
            2,
            "add",
            "coral",
          ],
        ],
        "target": {
          "d": 1,
          "n": 12,
        },
      }
    `);
  });

  it('proves generated boards solvable across arbitrary seeds', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const state = createInitialState(seed, RULES, BAND);
        const analysis = analyseWithBand(state.board, state.target, state.rules, state.band);
        expect(analysis.isStuck).toBe(false);
        expect(analysis.solutions.some((solution) => eq(solution.result, state.target))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('generates stable validated seed packs', () => {
    const pack = generatePackInternal('sprout', 3, 99);
    const band = defaultBand('sprout')!;
    expect(pack).toHaveLength(3);
    expect(pack.every((entry) => entry.validation.solvable)).toBe(true);
    expect(
      pack.every(
        (entry) =>
          entry.validation.solutionCount >= band.minSolutions &&
          entry.validation.solutionCount <= band.maxSolutions,
      ),
    ).toBe(true);
    expect(generatePackInternal('sprout', 3, 99)).toEqual(pack);
    expect(generatePackInternal('unknown', 1, 1)).toEqual([]);
    expect(generatePackInternal('sprout', 0, 1)).toEqual([]);
  });

  it('constructs legal targets for every operation family', () => {
    for (const operation of ['add', 'sub', 'mul', 'div', 'wild'] as const) {
      const solution = chooseGuaranteedSolution(createRng(42), {
        ...BAND,
        id: 'pathfinder',
        numberRange: [1, 20],
        allowedOperations: [operation],
        allowedColours: [operation === 'wild' ? 'violet' : 'coral'],
        maxTarget: 400,
        allowNegatives: true,
      });
      expect(solution.target.d).toBe(1);
      expect(solution.operation).toBe(operation);
    }
    expect(defaultBand('pathfinder')?.id).toBe('pathfinder');
    expect(defaultBand('missing')).toBeNull();
    expect(
      randomTile(
        createRng(1),
        {
          ...BAND,
          id: 'pathfinder',
          allowedOperations: ['wild'],
          allowedColours: ['violet'],
        },
        'wild',
      ).ownOperator,
    ).toBe('add');
    expect(() =>
      chooseGuaranteedSolution(createRng(1), {
        ...BAND,
        numberRange: [10, 10],
        allowedOperations: ['add'],
        allowedColours: ['coral'],
        maxTarget: 1,
      }),
    ).toThrow();
  });

  it('supports the public rules-only analyser and exactly-three objectives', () => {
    const state = createInitialState(4, RULES, BAND);
    expect(analyseBoard(state.board, state.target, RULES).solutions.length).toBeGreaterThan(0);
    const empty: Board = { width: 1, height: 1, seed: 1, tiles: [[null]] };
    expect(analyseBoard(empty, int(1), RULES).isStuck).toBe(true);
    expect(analyseBoard(empty, int(-1), { ...RULES, objective: 'exactlyThree' }).isStuck).toBe(
      true,
    );
    // A 1x1 board has no chainable pairs at all, so it also fails the decoy floor.
    expect(validatePuzzle(empty, int(1), RULES, BAND)).toMatchObject({
      valid: false,
      reasons: ['unsolvable', 'tooFewSolutions', 'weakDecoys'],
    });
  });
});
