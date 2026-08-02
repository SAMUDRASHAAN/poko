import type { Board, Cell, Tile } from './types.js';

function isInBounds(board: Board, cell: Cell): boolean {
  return cell.row >= 0 && cell.row < board.height && cell.col >= 0 && cell.col < board.width;
}

export function getTile(board: Board, cell: Cell): Tile | null {
  if (!isInBounds(board, cell)) return null;
  return board.tiles[cell.row]?.[cell.col] ?? null;
}

export function areAdjacent(a: Cell, b: Cell, allowDiagonals: boolean): boolean {
  const rowDistance = Math.abs(a.row - b.row);
  const colDistance = Math.abs(a.col - b.col);
  if (rowDistance === 0 && colDistance === 0) return false;
  if (allowDiagonals) return rowDistance <= 1 && colDistance <= 1;
  return rowDistance + colDistance === 1;
}

function mutableRows(board: Board): (Tile | null)[][] {
  return Array.from({ length: board.height }, (_, row) =>
    Array.from({ length: board.width }, (_, col) => board.tiles[row]?.[col] ?? null),
  );
}

export function replaceTiles(board: Board, replacements: readonly [Cell, Tile | null][]): Board {
  const tiles = mutableRows(board);
  for (const [cell, tile] of replacements) {
    if (!isInBounds(board, cell))
      throw new RangeError(`cell (${cell.row}, ${cell.col}) is outside board`);
    const row = tiles[cell.row];
    if (!row) throw new RangeError(`row ${cell.row} is outside board`);
    row[cell.col] = tile;
  }
  return { ...board, tiles };
}

export function removeCells(board: Board, cells: readonly Cell[]): Board {
  return replaceTiles(
    board,
    cells.map((cell) => [cell, null] as const),
  );
}

export function swapTiles(board: Board, a: Cell, b: Cell): Board {
  if (!isInBounds(board, a) || !isInBounds(board, b)) {
    throw new RangeError('cannot swap outside the board');
  }
  return replaceTiles(board, [
    [a, getTile(board, b)],
    [b, getTile(board, a)],
  ]);
}

export function applyGravity(board: Board): Board {
  const tiles = mutableRows(board);
  for (let col = 0; col < board.width; col += 1) {
    const present: Tile[] = [];
    for (let row = board.height - 1; row >= 0; row -= 1) {
      const tile = board.tiles[row]?.[col];
      if (tile) present.push(tile);
    }
    for (let row = board.height - 1, index = 0; row >= 0; row -= 1, index += 1) {
      const targetRow = tiles[row];
      if (targetRow) targetRow[col] = present[index] ?? null;
    }
  }
  return { ...board, tiles };
}

export function allCells(board: Board): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) cells.push({ row, col });
  }
  return cells;
}

export function neighbours(board: Board, cell: Cell, allowDiagonals: boolean): Cell[] {
  const result: Cell[] = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      const candidate = { row: cell.row + rowDelta, col: cell.col + colDelta };
      if (isInBounds(board, candidate) && areAdjacent(cell, candidate, allowDiagonals)) {
        result.push(candidate);
      }
    }
  }
  return result;
}
