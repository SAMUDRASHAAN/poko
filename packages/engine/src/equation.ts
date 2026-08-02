import { areAdjacent, getTile } from './board.js';
import { add, div, fmt, gt, isInt, isNegative, mul, sub, ZERO } from './num.js';
import type { BandConfig, Board, Cell, Equation, InvalidReason, Operation, Tile } from './types.js';

const glyph: Readonly<Record<Exclude<Operation, 'wild'>, string>> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};

export function validateChain(
  board: Board,
  cells: readonly Cell[],
  band: Pick<BandConfig, 'minChain' | 'maxChain' | 'allowDiagonals'>,
): InvalidReason | null {
  if (cells.length < band.minChain) return 'tooShort';
  if (cells.length > band.maxChain) return 'tooLong';

  const first = getTile(board, cells[0] as Cell);
  if (!first) return 'notAdjacent';
  const visited = new Set<string>();
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index] as Cell;
    const tile = getTile(board, cell);
    const key = `${cell.row}:${cell.col}`;
    if (!tile || visited.has(key)) return 'notAdjacent';
    if (index > 0 && !areAdjacent(cells[index - 1] as Cell, cell, band.allowDiagonals)) {
      return 'notAdjacent';
    }
    if (tile.colour !== first.colour) return 'colourMismatch';
    visited.add(key);
  }
  return null;
}

function applyOperation(left: Tile['value'], right: Tile['value'], operation: Operation) {
  switch (operation) {
    case 'add':
      return add(left, right);
    case 'sub':
      return sub(left, right);
    case 'mul':
      return mul(left, right);
    case 'div':
      return div(left, right);
    case 'wild':
      return add(left, right);
  }
}

function operatorFor(tiles: readonly Tile[], index: number, chainOperation: Operation): Operation {
  if (chainOperation !== 'wild') return chainOperation;
  const tile = tiles[index];
  return tile?.ownOperator && tile.ownOperator !== 'wild' ? tile.ownOperator : 'add';
}

function makeDisplay(tiles: readonly Tile[], operation: Operation, result: Tile['value']): string {
  let display = fmt(tiles[0]?.value ?? ZERO);
  for (let index = 1; index < tiles.length; index += 1) {
    const nextOperation = operatorFor(tiles, index, operation);
    const visibleOperation = nextOperation === 'wild' ? 'add' : nextOperation;
    display += ` ${glyph[visibleOperation]} ${fmt((tiles[index] as Tile).value)}`;
  }
  return `${display} = ${fmt(result)}`;
}

export function evaluateChain(board: Board, cells: readonly Cell[], band: BandConfig): Equation {
  const tiles = cells
    .map((cell) => getTile(board, cell))
    .filter((tile): tile is Tile => tile !== null);
  if (tiles.length === 0) throw new RangeError('cannot evaluate an empty chain');

  const geometryError = validateChain(board, cells, band);
  const operation = tiles[0]?.operation ?? 'add';
  let result = tiles[0]?.value ?? ZERO;
  let arithmeticError: InvalidReason | null = null;

  for (let index = 1; index < tiles.length && arithmeticError === null; index += 1) {
    const nextOperation = operatorFor(tiles, index, operation);
    try {
      result = applyOperation(result, (tiles[index] as Tile).value, nextOperation);
      if (nextOperation === 'div' && !isInt(result)) arithmeticError = 'inexactDivision';
    } catch {
      arithmeticError = 'inexactDivision';
    }
  }

  const valueError =
    arithmeticError ??
    (!band.allowNegatives && isNegative(result)
      ? 'negative'
      : gt(result, { n: band.maxTarget, d: 1 })
        ? 'exceedsMax'
        : null);
  const invalidReason = geometryError ?? valueError;
  const equation = {
    tiles,
    operation,
    result,
    display: makeDisplay(tiles, operation, result),
    isValid: invalidReason === null,
  } satisfies Omit<Equation, 'invalidReason'>;
  return invalidReason ? { ...equation, invalidReason } : equation;
}
