import { allCells, applyGravity, getTile, removeCells, replaceTiles } from './board.js';
import {
  chooseGuaranteedSolution,
  createInitialState,
  randomTile,
  solutionTiles,
} from './generator.js';
import { createRng } from './rng.js';
import { analyseWithBand } from './solver.js';
import type { BandConfig, Board, Cell, LevelRules } from './types.js';

type RefillResult = {
  readonly board: Board;
  readonly target: ReturnType<typeof chooseGuaranteedSolution>['target'];
  readonly rngState: number;
};

function emptyAdjacentPair(emptyCells: readonly Cell[]): readonly [Cell, Cell] | null {
  const empty = new Set(emptyCells.map((cell) => `${cell.row}:${cell.col}`));
  for (const cell of emptyCells) {
    const right = { row: cell.row, col: cell.col + 1 };
    const below = { row: cell.row + 1, col: cell.col };
    if (empty.has(`${right.row}:${right.col}`)) return [cell, right];
    if (empty.has(`${below.row}:${below.col}`)) return [cell, below];
  }
  return null;
}

function repairPair(board: Board, state: number): readonly [Cell, Cell] {
  const rng = createRng(state);
  const horizontal = rng.int(0, 1) === 0;
  if (horizontal) {
    const row = rng.int(0, board.height - 1);
    const col = rng.int(0, board.width - 2);
    return [
      { row, col },
      { row, col: col + 1 },
    ];
  }
  const row = rng.int(0, board.height - 2);
  const col = rng.int(0, board.width - 1);
  return [
    { row, col },
    { row: row + 1, col },
  ];
}

export function refillAfterRemoval(
  board: Board,
  removed: readonly Cell[],
  band: BandConfig,
  rules: LevelRules,
  rngState: number,
): RefillResult {
  const fallen = applyGravity(removeCells(board, removed));
  const emptyCells = allCells(fallen).filter((cell) => getTile(fallen, cell) === null);
  const rng = createRng(rngState);
  const solution = chooseGuaranteedSolution(rng, band);
  const preferredPair = emptyAdjacentPair(emptyCells);

  const filled = replaceTiles(
    fallen,
    emptyCells.map(
      (cell, index) => [cell, randomTile(rng, band, `refill-${rngState}-${index}`)] as const,
    ),
  );
  const pair = preferredPair ?? repairPair(filled, rng.state());
  const guaranteed = solutionTiles(solution, `refill-${rngState}-solution`);
  const repaired = replaceTiles(filled, [
    [pair[0], guaranteed[0]],
    [pair[1], guaranteed[1]],
  ]);

  if (analyseWithBand(repaired, solution.target, rules, band).solutions.length > 0) {
    return { board: repaired, target: solution.target, rngState: rng.state() };
  }

  const shuffled = createInitialState(rng.state(), rules, band);
  return { board: shuffled.board, target: shuffled.target, rngState: shuffled.rngState };
}
