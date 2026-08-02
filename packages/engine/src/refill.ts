import { allCells, applyGravity, getTile, removeCells, replaceTiles } from './board.js';
import {
  chooseGuaranteedSolution,
  createInitialState,
  nearMissTile,
  randomTile,
  solutionForTarget,
  shouldNearMiss,
  solutionTiles,
} from './generator.js';
import { createRng, type Rng } from './rng.js';
import { analyseWithBand } from './solver.js';
import { rankTargetsForBoard } from './validator.js';
import type { BandConfig, Board, Cell, LevelRules, Tile } from './types.js';

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

/**
 * A refill picks a NEW target, which means the tiles the child did NOT clear were
 * tuned as decoys for the previous one and are near-useless against the new one.
 *
 * Rather than rewrite surviving tiles under the child's fingers — visually
 * jarring, and it would erase the board they were reasoning about — choose the
 * target that best fits the tiles already there. Only incoming tiles are ever
 * written. Falls back to a free choice when the band cannot express that target.
 * [ADR-0009]
 */
function chooseRefillSolution(
  rng: Rng,
  band: BandConfig,
  survivors: Board,
): ReturnType<typeof chooseGuaranteedSolution> {
  for (const fitted of rankTargetsForBoard(survivors, band)) {
    const solution = solutionForTarget(rng, band, fitted);
    if (solution) return solution;
  }
  return chooseGuaranteedSolution(rng, band);
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
  const solution = chooseRefillSolution(rng, band, fallen);
  const preferredPair = emptyAdjacentPair(emptyCells);

  // Fill in reading order, one cell at a time, so each incoming tile can be
  // steered against a neighbour that is already on the board. Filling them in a
  // single pass would leave every incoming tile uniform, and decoy quality would
  // decay back to Phase 1 levels as soon as the child cleared anything. [ADR-0009]
  const ordered = [...emptyCells].sort((a, b) => a.row - b.row || a.col - b.col);
  let filled = fallen;
  ordered.forEach((cell, index) => {
    const id = `refill-${rngState}-${index}`;
    const left = cell.col > 0 ? getTile(filled, { row: cell.row, col: cell.col - 1 }) : null;
    const above = cell.row > 0 ? getTile(filled, { row: cell.row - 1, col: cell.col }) : null;
    const anchors = [left, above].filter((tile): tile is Tile => tile !== null);

    const tile =
      anchors.length > 0 && shouldNearMiss(rng)
        ? nearMissTile(rng, band, solution.target, anchors, id)
        : null;
    filled = replaceTiles(filled, [[cell, tile ?? randomTile(rng, band, id)]]);
  });
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
