import { add, div, eq, isInt, mul, sub, type Num } from './num.js';
import type {
  Analysis,
  BandConfig,
  Board,
  Cell,
  LevelRules,
  Operation,
  Solution,
  Tile,
  TileColour,
} from './types.js';

const ORTHOGONAL_DELTAS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

const DIAGONAL_DELTAS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function operationFor(tile: Tile, chainOperation: Operation): Operation {
  if (chainOperation !== 'wild') return chainOperation;
  return tile.ownOperator && tile.ownOperator !== 'wild' ? tile.ownOperator : 'add';
}

function applyOperation(left: Num, tile: Tile, chainOperation: Operation): Num | null {
  switch (operationFor(tile, chainOperation)) {
    case 'add':
      return add(left, tile.value);
    case 'sub':
      return sub(left, tile.value);
    case 'mul':
      return mul(left, tile.value);
    case 'div': {
      if (tile.value.n === 0) return null;
      const quotient = div(left, tile.value);
      return isInt(quotient) ? quotient : null;
    }
    case 'wild':
      return add(left, tile.value);
  }
}

function compareSolutions(a: Solution, b: Solution): number {
  if (a.cells.length !== b.cells.length) return a.cells.length - b.cells.length;
  for (let index = 0; index < a.cells.length; index += 1) {
    const left = a.cells[index] as Cell;
    const right = b.cells[index] as Cell;
    if (left.row !== right.row) return left.row - right.row;
    if (left.col !== right.col) return left.col - right.col;
  }
  return 0;
}

export function analyseWithBand(
  board: Board,
  target: Parameters<typeof eq>[0],
  rules: LevelRules,
  band: BandConfig,
): Analysis {
  const solutions: Solution[] = [];
  const tileCount = board.width * board.height;
  const tiles: (Tile | null)[] = new Array<Tile | null>(tileCount);
  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) {
      tiles[row * board.width + col] = board.tiles[row]?.[col] ?? null;
    }
  }

  const visited = new Uint8Array(tileCount);
  const path: number[] = [];
  const exactLength = rules.objective === 'exactlyThree' ? 3 : null;
  const deltas = band.allowDiagonals ? DIAGONAL_DELTAS : ORTHOGONAL_DELTAS;

  const visit = (
    index: number,
    colour: TileColour,
    chainOperation: Operation,
    result: Num,
  ): void => {
    visited[index] = 1;
    path.push(index);

    if (path.length >= band.minChain && (exactLength === null || path.length === exactLength)) {
      const legalValue =
        (band.allowNegatives || result.n >= 0) && result.n <= band.maxTarget * result.d;
      if (legalValue && eq(result, target)) {
        const cells = path.map((pathIndex) => ({
          row: Math.floor(pathIndex / board.width),
          col: pathIndex % board.width,
        }));
        solutions.push({ cells, result });
      }
    }

    if (path.length < band.maxChain) {
      const row = Math.floor(index / board.width);
      const col = index % board.width;
      for (const [rowDelta, colDelta] of deltas) {
        const nextRow = row + rowDelta;
        const nextCol = col + colDelta;
        if (nextRow < 0 || nextRow >= board.height || nextCol < 0 || nextCol >= board.width) {
          continue;
        }

        const nextIndex = nextRow * board.width + nextCol;
        const nextTile = tiles[nextIndex];
        if (!nextTile || nextTile.colour !== colour || visited[nextIndex] === 1) continue;
        const nextResult = applyOperation(result, nextTile, chainOperation);
        if (nextResult) visit(nextIndex, colour, chainOperation, nextResult);
      }
    }

    path.pop();
    visited[index] = 0;
  };

  for (let index = 0; index < tileCount; index += 1) {
    const tile = tiles[index];
    if (tile) visit(index, tile.colour, tile.operation, tile.value);
  }

  solutions.sort(compareSolutions);
  const bestSolution = solutions[0] ?? null;
  return {
    solutions,
    bestSolution,
    hiddenSolutions: Math.max(0, solutions.length - 1),
    setupMoves: bestSolution ? 0 : 1,
    isStuck: bestSolution === null,
    accidentals: solutions.slice(1),
  };
}

export function analyseBoard(
  board: Board,
  target: Parameters<typeof eq>[0],
  rules: LevelRules,
): Analysis {
  const operations = Array.from(
    new Set(board.tiles.flatMap((row) => row.flatMap((tile) => (tile ? [tile.operation] : [])))),
  );
  const colours = Array.from(
    new Set(board.tiles.flatMap((row) => row.flatMap((tile) => (tile ? [tile.colour] : [])))),
  );
  const band: BandConfig = {
    id: 'sprout',
    numberRange: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    allowedOperations: operations.length > 0 ? operations : ['add'],
    allowedColours: colours.length > 0 ? colours : ['coral'],
    minChain: rules.objective === 'exactlyThree' ? 3 : 2,
    maxChain: rules.objective === 'exactlyThree' ? 3 : 5,
    maxTarget: Number.MAX_SAFE_INTEGER,
    allowNegatives: target.n < 0,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: Number.MAX_SAFE_INTEGER,
  };
  return analyseWithBand(board, target, rules, band);
}
