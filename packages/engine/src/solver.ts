import { getTile, neighbours } from './board.js';
import { evaluateChain } from './equation.js';
import { eq } from './num.js';
import type {
  Analysis,
  BandConfig,
  Board,
  Cell,
  LevelRules,
  Solution,
  TileColour,
} from './types.js';

function pathKey(cells: readonly Cell[]): string {
  return cells.map((cell) => `${cell.row}:${cell.col}`).join('|');
}

export function analyseWithBand(
  board: Board,
  target: Parameters<typeof eq>[0],
  rules: LevelRules,
  band: BandConfig,
): Analysis {
  const solutions: Solution[] = [];
  const seen = new Set<string>();
  const visited = new Set<number>();
  const path: Cell[] = [];
  const exactLength = rules.objective === 'exactlyThree' ? 3 : null;

  const visit = (cell: Cell, colour: TileColour): void => {
    const index = cell.row * board.width + cell.col;
    const tile = getTile(board, cell);
    if (!tile || tile.colour !== colour || visited.has(index)) return;

    visited.add(index);
    path.push(cell);
    if (path.length >= band.minChain && (exactLength === null || path.length === exactLength)) {
      const equation = evaluateChain(board, path, band);
      if (equation.isValid && eq(equation.result, target)) {
        const key = pathKey(path);
        if (!seen.has(key)) {
          seen.add(key);
          solutions.push({ cells: [...path], result: equation.result });
        }
      }
    }

    if (path.length < band.maxChain) {
      for (const candidate of neighbours(board, cell, band.allowDiagonals))
        visit(candidate, colour);
    }
    path.pop();
    visited.delete(index);
  };

  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) {
      const cell = { row, col };
      const tile = getTile(board, cell);
      if (tile) visit(cell, tile.colour);
    }
  }

  solutions.sort(
    (a, b) => a.cells.length - b.cells.length || pathKey(a.cells).localeCompare(pathKey(b.cells)),
  );
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
