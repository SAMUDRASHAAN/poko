import { allCells, applyGravity, getTile, removeCells, replaceTiles } from './board.js';
import {
  chooseGuaranteedSolution,
  nearMissTile,
  randomTile,
  solutionForTarget,
  shouldNearMiss,
  solutionTiles,
} from './generator.js';
import { createRng, type Rng } from './rng.js';
import { analyseWithBand } from './solver.js';
import { rankTargetsForBoard } from './validator.js';
import type { Num } from './num.js';
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

/** The caller owns the seed: the rng is injected, never constructed here. [INV-3] */
function repairPair(board: Board, rng: Rng): readonly [Cell, Cell] {
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

/** Reshuffles to try before falling back to seeding a solution outright. */
const TIDE_SHUFFLE_ATTEMPTS = 8;

/**
 * Layer 3 of the safety chain — "full `tideShuffle`, solution guaranteed, dressed
 * as a story beat" (ADR-0004).
 *
 * The story beat is the whole point, and it constrains the implementation: the
 * tide *rearranges the tiles already on the board*. It does not generate a new
 * one. Regenerating would replace the puzzle the child was reasoning about with a
 * stranger, which is not something an animation can honestly narrate.
 *
 * So the tile multiset is preserved. Only if no arrangement yields a solution are
 * two tiles overwritten with a guaranteed pair, so "solution guaranteed" holds
 * unconditionally. The target is never changed — it is given, not chosen.
 */
export function tideShuffle(
  board: Board,
  target: Num,
  rules: LevelRules,
  band: BandConfig,
  rng: Rng,
): Board {
  const cells = allCells(board);
  const present = cells
    .map((cell) => getTile(board, cell))
    .filter((tile): tile is Tile => tile !== null);

  let stirred = board;
  for (let attempt = 0; attempt < TIDE_SHUFFLE_ATTEMPTS; attempt += 1) {
    const shuffled = rng.shuffle(present);
    let index = 0;
    stirred = replaceTiles(
      board,
      cells.map((cell) => [
        cell,
        getTile(board, cell) === null ? null : (shuffled[index++] ?? null),
      ]),
    );
    if (analyseWithBand(stirred, target, rules, band).solutions.length > 0) return stirred;
  }

  // No arrangement of these tiles reaches the target. Seed a pair so the guarantee
  // holds; everything else the child can see is still their own board.
  if (target.d !== 1) return stirred;
  const solution = solutionForTarget(rng, band, target.n);
  if (!solution) return stirred;

  const pair = repairPair(stirred, rng);
  const guaranteed = solutionTiles(solution, `tide-${rng.state()}`);
  return replaceTiles(stirred, [
    [pair[0], guaranteed[0]],
    [pair[1], guaranteed[1]],
  ]);
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
  const guaranteed = solutionTiles(solution, `refill-${rngState}-solution`);

  // The three layers of ADR-0004, in order, each validated before the next is
  // tried. Collapsing them — as this function used to — means layer 1 is never
  // exercised alone, so a regression in solution seeding is masked forever by the
  // repair that always followed it.

  // LAYER 1 — seed the guaranteed solution into the INCOMING tiles.
  const seeded = preferredPair
    ? replaceTiles(filled, [
        [preferredPair[0], guaranteed[0]],
        [preferredPair[1], guaranteed[1]],
      ])
    : filled;
  if (analyseWithBand(seeded, solution.target, rules, band).solutions.length > 0) {
    return { board: seeded, target: solution.target, rngState: rng.state() };
  }

  // LAYER 2 — repair, mutating at most 2 tiles already on the board.
  const pair = repairPair(seeded, rng);
  const repaired = replaceTiles(seeded, [
    [pair[0], guaranteed[0]],
    [pair[1], guaranteed[1]],
  ]);
  if (analyseWithBand(repaired, solution.target, rules, band).solutions.length > 0) {
    return { board: repaired, target: solution.target, rngState: rng.state() };
  }

  // LAYER 3 — the tide. Stirs the child's own tiles rather than replacing them.
  return {
    board: tideShuffle(repaired, solution.target, rules, band, rng),
    target: solution.target,
    rngState: rng.state(),
  };
}
