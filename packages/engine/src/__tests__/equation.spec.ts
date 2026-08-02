import { describe, expect, it } from 'vitest';

import { evaluateChain, validateChain } from '../equation.js';
import { int } from '../num.js';
import type { Board } from '../types.js';
import { BAND, tile } from './fixtures.js';

const board: Board = {
  width: 3,
  height: 2,
  seed: 2,
  tiles: [
    [tile('a', 8, 'sub'), tile('b', 3, 'sub'), tile('c', 2, 'sub')],
    [tile('d', 2), tile('e', 4), tile('f', 5)],
  ],
};

describe('equation evaluation', () => {
  it('evaluates an ordered chain exactly and formats its preview', () => {
    const equation = evaluateChain(
      board,
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      BAND,
    );
    expect(equation.result).toEqual(int(3));
    expect(equation.display).toBe('8 − 3 − 2 = 3');
    expect(equation.isValid).toBe(true);
  });

  it('rejects invalid geometry, colour mixing, negatives, and excessive results', () => {
    expect(validateChain(board, [{ row: 0, col: 0 }], BAND)).toBe('tooShort');
    expect(
      validateChain(
        board,
        [
          { row: 0, col: 0 },
          { row: 1, col: 1 },
        ],
        BAND,
      ),
    ).toBe('notAdjacent');
    expect(
      validateChain(
        board,
        [
          { row: 0, col: 1 },
          { row: 1, col: 1 },
        ],
        BAND,
      ),
    ).toBe('colourMismatch');

    const negative = evaluateChain(
      board,
      [
        { row: 0, col: 2 },
        { row: 0, col: 1 },
      ],
      BAND,
    );
    expect(negative.invalidReason).toBe('negative');

    const excessive = evaluateChain(
      board,
      [
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      { ...BAND, maxTarget: 5 },
    );
    expect(excessive.invalidReason).toBe('exceedsMax');
  });

  it('requires exact division', () => {
    const divisionBoard: Board = {
      width: 2,
      height: 1,
      seed: 3,
      tiles: [[tile('a', 7, 'div'), tile('b', 2, 'div')]],
    };
    expect(
      evaluateChain(
        divisionBoard,
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        {
          ...BAND,
          allowedOperations: ['div'],
          allowedColours: ['sunfish'],
        },
      ).invalidReason,
    ).toBe('inexactDivision');
  });

  it('supports multiplication, exact division, and per-tile wild operators', () => {
    const multiplication: Board = {
      width: 2,
      height: 1,
      seed: 4,
      tiles: [[tile('a', 3, 'mul'), tile('b', 4, 'mul')]],
    };
    expect(
      evaluateChain(
        multiplication,
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        {
          ...BAND,
          allowedOperations: ['mul'],
          maxTarget: 20,
        },
      ).result,
    ).toEqual(int(12));

    const exactDivision: Board = {
      width: 2,
      height: 1,
      seed: 5,
      tiles: [[tile('a', 8, 'div'), tile('b', 2, 'div')]],
    };
    expect(
      evaluateChain(
        exactDivision,
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        {
          ...BAND,
          allowedOperations: ['div'],
        },
      ).result,
    ).toEqual(int(4));

    const wild: Board = {
      width: 3,
      height: 1,
      seed: 6,
      tiles: [
        [
          { ...tile('a', 8), operation: 'wild', colour: 'violet' },
          { ...tile('b', 3), operation: 'wild', colour: 'violet', ownOperator: 'sub' },
          { ...tile('c', 2), operation: 'wild', colour: 'violet', ownOperator: 'mul' },
        ],
      ],
    };
    const wildEquation = evaluateChain(
      wild,
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      {
        ...BAND,
        minChain: 2,
        maxChain: 3,
        allowedOperations: ['wild'],
        allowedColours: ['violet'],
      },
    );
    expect(wildEquation.result).toEqual(int(10));
    expect(wildEquation.display).toBe('8 − 3 × 2 = 10');
  });

  it('rejects empty, repeated, and overlong chains', () => {
    expect(() => evaluateChain(board, [], BAND)).toThrow();
    expect(
      validateChain(
        board,
        [
          { row: 0, col: 0 },
          { row: 0, col: 0 },
        ],
        BAND,
      ),
    ).toBe('notAdjacent');
    expect(
      validateChain(
        board,
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
        { ...BAND, maxChain: 2 },
      ),
    ).toBe('tooLong');
  });
});
