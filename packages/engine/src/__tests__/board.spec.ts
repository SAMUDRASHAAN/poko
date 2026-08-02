import { describe, expect, it } from 'vitest';

import { applyGravity, areAdjacent, getTile, removeCells, swapTiles } from '../board.js';
import type { Board } from '../types.js';
import { tile } from './fixtures.js';

const board: Board = {
  width: 2,
  height: 3,
  seed: 1,
  tiles: [
    [tile('a', 1), tile('b', 2)],
    [tile('c', 3), null],
    [tile('d', 4), tile('e', 5)],
  ],
};

describe('board primitives', () => {
  it('reads bounds safely and recognises cardinal/diagonal adjacency', () => {
    expect(getTile(board, { row: 0, col: 0 })?.id).toBe('a');
    expect(getTile(board, { row: -1, col: 0 })).toBeNull();
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 }, false)).toBe(true);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 }, false)).toBe(false);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 }, true)).toBe(true);
  });

  it('removes and swaps without mutating the source board', () => {
    const removed = removeCells(board, [{ row: 2, col: 0 }]);
    const swapped = swapTiles(board, { row: 0, col: 0 }, { row: 2, col: 1 });

    expect(getTile(removed, { row: 2, col: 0 })).toBeNull();
    expect(getTile(swapped, { row: 0, col: 0 })?.id).toBe('e');
    expect(getTile(board, { row: 0, col: 0 })?.id).toBe('a');
    expect(() => swapTiles(board, { row: 0, col: 0 }, { row: 9, col: 9 })).toThrow();
  });

  it('applies column gravity while preserving tile order', () => {
    const fallen = applyGravity(removeCells(board, [{ row: 2, col: 0 }]));
    expect(fallen.tiles.map((row) => row[0]?.id ?? null)).toEqual([null, 'a', 'c']);
    expect(fallen.tiles.map((row) => row[1]?.id ?? null)).toEqual([null, 'b', 'e']);
  });
});
