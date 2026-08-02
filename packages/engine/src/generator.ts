import { difficultyScore } from './difficulty.js';
import { int, type Num } from './num.js';
import { createRng, type Rng } from './rng.js';
import {
  DECOY_NEAR_DISTANCE,
  DECOY_NEAR_RATIO,
  decoyQuality,
  validatePuzzle,
} from './validator.js';
import type {
  BandConfig,
  BandId,
  Board,
  Cell,
  LevelRules,
  LevelState,
  Operation,
  PuzzleSeed,
  Tile,
  TileColour,
} from './types.js';

const DEFAULT_BANDS: Readonly<Record<BandId, BandConfig>> = {
  sprout: {
    id: 'sprout',
    numberRange: [1, 10],
    allowedOperations: ['add', 'sub'],
    allowedColours: ['coral', 'marine'],
    minChain: 2,
    maxChain: 4,
    maxTarget: 20,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 4,
  },
  adventurer: {
    id: 'adventurer',
    numberRange: [1, 12],
    allowedOperations: ['add', 'sub', 'mul'],
    allowedColours: ['coral', 'marine', 'kelp'],
    minChain: 2,
    maxChain: 5,
    maxTarget: 50,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  },
  challenger: {
    id: 'challenger',
    numberRange: [1, 12],
    allowedOperations: ['add', 'sub', 'mul', 'div'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish'],
    minChain: 2,
    maxChain: 5,
    maxTarget: 100,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  },
  trailblazer: {
    id: 'trailblazer',
    numberRange: [1, 15],
    allowedOperations: ['add', 'sub', 'mul', 'div'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish'],
    minChain: 2,
    maxChain: 6,
    maxTarget: 150,
    allowNegatives: false,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 6,
  },
  pathfinder: {
    id: 'pathfinder',
    numberRange: [1, 20],
    allowedOperations: ['add', 'sub', 'mul', 'div', 'wild'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish', 'violet'],
    minChain: 2,
    maxChain: 6,
    maxTarget: 200,
    allowNegatives: true,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 8,
  },
};

type GuaranteedSolution = {
  readonly operation: Operation;
  readonly colour: TileColour;
  readonly left: number;
  readonly right: number;
  readonly target: ReturnType<typeof int>;
};

export function defaultBand(bandId: string): BandConfig | null {
  return Object.prototype.hasOwnProperty.call(DEFAULT_BANDS, bandId)
    ? DEFAULT_BANDS[bandId as BandId]
    : null;
}

function operationSlot(rng: Rng, band: BandConfig): { operation: Operation; colour: TileColour } {
  const slotCount = Math.max(
    1,
    Math.min(band.allowedOperations.length, band.allowedColours.length),
  );
  const slot = rng.int(0, slotCount - 1);
  return {
    operation: band.allowedOperations[slot] ?? 'add',
    colour: band.allowedColours[slot] ?? 'coral',
  };
}

export function chooseGuaranteedSolution(rng: Rng, band: BandConfig): GuaranteedSolution {
  const [minimum, maximum] = band.numberRange;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const { operation, colour } = operationSlot(rng, band);
    const candidateOperation = operation === 'wild' ? 'add' : operation;
    let left = rng.int(minimum, maximum);
    let right = rng.int(minimum, maximum);
    let target: number;

    switch (candidateOperation) {
      case 'add':
        target = left + right;
        break;
      case 'sub':
        if (!band.allowNegatives && left < right) [left, right] = [right, left];
        target = left - right;
        break;
      case 'mul':
        target = left * right;
        break;
      case 'div': {
        const quotient = rng.int(Math.max(1, minimum), Math.max(1, maximum));
        right = rng.int(Math.max(1, minimum), Math.max(1, maximum));
        left = quotient * right;
        target = quotient;
        if (left > maximum) continue;
        break;
      }
    }

    if ((!band.allowNegatives && target < 0) || target > band.maxTarget) continue;
    return { operation, colour, left, right, target: int(target) };
  }

  throw new RangeError(`band ${band.id} cannot produce a legal target`);
}

/**
 * Build a guaranteed solution that lands on a SPECIFIC target, rather than
 * wherever the rng happens to fall. Refill uses this to keep the new target near
 * the values the surviving tiles already carry. Returns null when the band cannot
 * express that target.
 */
export function solutionForTarget(
  rng: Rng,
  band: BandConfig,
  targetValue: number,
): GuaranteedSolution | null {
  if (targetValue > band.maxTarget) return null;
  if (targetValue < 0 && !band.allowNegatives) return null;

  const [minimum, maximum] = band.numberRange;
  const slotCount = Math.max(
    1,
    Math.min(band.allowedOperations.length, band.allowedColours.length),
  );

  for (const slot of rng.shuffle(Array.from({ length: slotCount }, (_, index) => index))) {
    const operation = band.allowedOperations[slot] ?? 'add';
    const colour = band.allowedColours[slot] ?? 'coral';
    const effective = operation === 'wild' ? 'add' : operation;
    const pairs: (readonly [number, number])[] = [];

    for (let left = minimum; left <= maximum; left += 1) {
      let right: number | null = null;
      switch (effective) {
        case 'add':
          right = targetValue - left;
          break;
        case 'sub':
          right = left - targetValue;
          break;
        case 'mul':
          right = left !== 0 && targetValue % left === 0 ? targetValue / left : null;
          break;
        case 'div':
          right = targetValue !== 0 && left % targetValue === 0 ? left / targetValue : null;
          break;
      }
      if (right === null || right < minimum || right > maximum) continue;
      if (effective === 'div' && right === 0) continue;
      pairs.push([left, right]);
    }

    const chosen = pairs[rng.int(0, Math.max(0, pairs.length - 1))];
    if (pairs.length > 0 && chosen) {
      return { operation, colour, left: chosen[0], right: chosen[1], target: int(targetValue) };
    }
  }

  return null;
}

export function randomTile(rng: Rng, band: BandConfig, id: string): Tile {
  const { operation, colour } = operationSlot(rng, band);
  const value = rng.int(band.numberRange[0], band.numberRange[1]);
  return operation === 'wild'
    ? { id, value: int(value), colour, operation, ownOperator: 'add' }
    : { id, value: int(value), colour, operation };
}

/** Share of cells that are steered toward the target rather than filled uniformly. */
const NEAR_MISS_PERCENT = 85;

/**
 * Longest run of one colour the fill will deliberately create.
 *
 * A decoy needs a same-colour PAIR, not a blob. Left uncapped, steering grows
 * large single-colour regions, and because any path through such a region is a
 * legal chain, the count of chains hitting the target exactly explodes — one
 * board reached 1639 solutions against a ceiling of 6.
 */
const MAX_STEERED_RUN = 3;

/** Re-fills to try before settling for the best board seen. */
const DECOY_TUNE_ATTEMPTS = 12;

/** Is `anchor OP value` a near miss for the target — close, but not a solution? */
function isNearMiss(band: BandConfig, target: Num, anchor: Tile, value: number): boolean {
  if (target.d !== 1 || anchor.value.d !== 1) return false;
  const operation = anchor.operation === 'wild' ? (anchor.ownOperator ?? 'add') : anchor.operation;

  let result: number;
  switch (operation === 'wild' ? 'add' : operation) {
    case 'add':
      result = anchor.value.n + value;
      break;
    case 'sub':
      result = anchor.value.n - value;
      break;
    case 'mul':
      result = anchor.value.n * value;
      break;
    case 'div':
      if (value === 0 || anchor.value.n % value !== 0) return false;
      result = anchor.value.n / value;
      break;
  }

  if (!band.allowNegatives && result < 0) return false;
  if (result > band.maxTarget) return false;

  const distance = Math.abs(result - target.n);
  return distance > 0 && distance <= DECOY_NEAR_DISTANCE;
}

/**
 * A tile forming near-miss decoys with as many of `anchors` as one value can.
 *
 * It inherits the anchors' colour and operation, because `validateChain` rejects
 * colour mismatches — a differently-coloured neighbour is not a decoy at all, it
 * is simply unchainable. Only anchors sharing that colour can be satisfied, so
 * the largest same-colour group wins; on a diagonal board a cell sits in up to
 * four pairs, and steering only one of them leaves the rest uniform.
 */
export function nearMissTile(
  rng: Rng,
  band: BandConfig,
  target: Num,
  anchors: readonly Tile[],
  id: string,
): Tile | null {
  if (anchors.length === 0) return null;

  // Group anchors by colour without allocating a Map per cell: this runs for every
  // cell of every fill attempt, and the fuzz gate generates 100k boards.
  const groups: Tile[][] = [];
  for (const anchor of anchors) {
    const existing = groups.find((group) => group[0]?.colour === anchor.colour);
    if (existing) existing.push(anchor);
    else groups.push([anchor]);
  }

  let group: Tile[] = groups[0] ?? [];
  for (const candidate of groups) {
    if (candidate.length > group.length) group = candidate;
  }
  const lead = group[0];
  if (!lead) return null;

  const [minimum, maximum] = band.numberRange;

  // Collect every value achieving the best hit count, then choose among them
  // UNIFORMLY.
  //
  // Scanning the range from a random offset and taking the first hit looks
  // equivalent and is not: it favours whichever value follows the largest gap of
  // misses. That bias compounds cell over cell — each tile anchors the next — and
  // collapses the board into a monoculture. One seed produced an entire board of
  // 3s with target 9, giving 370 solutions against a ceiling of 6 and no decoys
  // at all.
  const candidates: number[] = [];
  let bestHits = 0;

  for (let value = minimum; value <= maximum; value += 1) {
    let hits = 0;
    for (const anchor of group) if (isNearMiss(band, target, anchor, value)) hits += 1;
    if (hits === 0) continue;
    if (hits > bestHits) {
      bestHits = hits;
      candidates.length = 0;
    }
    if (hits === bestHits) candidates.push(value);
  }

  const best =
    candidates.length > 0 ? (candidates[rng.int(0, candidates.length - 1)] ?? null) : null;

  if (best === null) return null;
  return lead.operation === 'wild'
    ? { id, value: int(best), colour: lead.colour, operation: lead.operation, ownOperator: 'add' }
    : { id, value: int(best), colour: lead.colour, operation: lead.operation };
}

/** Length of the contiguous same-colour run ending at (row, col), walking back. */
function runLength(
  rows: readonly (readonly Tile[])[],
  current: readonly Tile[],
  row: number,
  col: number,
  colour: TileColour,
  rowDelta: number,
  colDelta: number,
): number {
  let length = 0;
  let r = row - rowDelta;
  let c = col - colDelta;
  while (length < MAX_STEERED_RUN) {
    const tile = r === row ? current[c] : rows[r]?.[c];
    if (!tile || tile.colour !== colour) break;
    length += 1;
    r -= rowDelta;
    c -= colDelta;
  }
  return length;
}

/** True when this cell should be steered toward the target. Consumes rng either way. */
export function shouldNearMiss(rng: Rng): boolean {
  return rng.int(0, 99) < NEAR_MISS_PERCENT;
}

export function solutionTiles(
  solution: GuaranteedSolution,
  idPrefix: string,
): readonly [Tile, Tile] {
  const base = {
    colour: solution.colour,
    operation: solution.operation,
    ...(solution.operation === 'wild' ? { ownOperator: 'add' as const } : {}),
  };
  return [
    { id: `${idPrefix}-a`, value: int(solution.left), ...base },
    { id: `${idPrefix}-b`, value: int(solution.right), ...base },
  ];
}

function solutionCells(rng: Rng): readonly [Cell, Cell] {
  const horizontal = rng.int(0, 1) === 0;
  if (horizontal) {
    const row = rng.int(0, 7);
    const col = rng.int(0, 6);
    return [
      { row, col },
      { row, col: col + 1 },
    ];
  }
  const row = rng.int(0, 6);
  const col = rng.int(0, 7);
  return [
    { row, col },
    { row: row + 1, col },
  ];
}

/**
 * Fill in reading order so each cell can be steered against a neighbour that is
 * already placed — the left or the one above. Both sit before the current cell in
 * reading order, which is the order `decoyQuality` measures pairs in.
 */
function fillDecoyBoard(rng: Rng, band: BandConfig, target: Num, seed: number): Tile[][] {
  const tiles: Tile[][] = [];

  for (let row = 0; row < 8; row += 1) {
    const current: Tile[] = [];
    for (let col = 0; col < 8; col += 1) {
      const id = `${seed}-${row}-${col}`;
      const previous = row > 0 ? tiles[row - 1] : undefined;
      const anchors: Tile[] = [];
      const left = col > 0 ? current[col - 1] : undefined;
      const above = previous?.[col];
      if (left) anchors.push(left);
      if (above) anchors.push(above);
      // Diagonal bands make diagonal pairs chainable too, so they must be
      // steered as well or they drag the ratio down. Both diagonals in the row
      // above precede this cell in reading order.
      if (band.allowDiagonals) {
        const aboveLeft = col > 0 ? previous?.[col - 1] : undefined;
        const aboveRight = previous?.[col + 1];
        if (aboveLeft) anchors.push(aboveLeft);
        if (aboveRight) anchors.push(aboveRight);
      }

      const steered =
        anchors.length > 0 && shouldNearMiss(rng)
          ? nearMissTile(rng, band, target, anchors, id)
          : null;

      // Reject a steered tile that would extend a colour run past the cap; the
      // decoy is not worth the chain explosion behind it.
      const extendsRun =
        steered !== null &&
        (runLength(tiles, current, row, col, steered.colour, 0, 1) >= MAX_STEERED_RUN ||
          runLength(tiles, current, row, col, steered.colour, 1, 0) >= MAX_STEERED_RUN);

      current.push(extendsRun || steered === null ? randomTile(rng, band, id) : steered);
    }
    tiles.push(current);
  }

  return tiles;
}

function createBoard(
  seed: number,
  band: BandConfig,
): {
  board: Board;
  target: ReturnType<typeof int>;
  rngState: number;
} {
  const normalisedSeed = seed >>> 0;
  const rng = createRng(normalisedSeed);

  // Fill, measure, keep the best — ADR-0004's "validate and tune". `createLevel`
  // has no retry loop of its own the way `generatePackInternal` does.
  //
  // The TARGET is re-rolled per attempt, not just the fill: some targets are
  // intrinsically hostile to decoys. A target of 0 in a band that forbids
  // negatives leaves only 1, 2, 3 as near misses, and a target hard against
  // `maxTarget` is squeezed from the other side. No fill can rescue those, so the
  // loop has to be able to walk away from the target itself.
  let bestTiles: Tile[][] | null = null;
  let bestTarget: Num | null = null;
  let bestRatio = -1;

  for (let attempt = 0; attempt < DECOY_TUNE_ATTEMPTS; attempt += 1) {
    const solution = chooseGuaranteedSolution(rng, band);
    const tiles = fillDecoyBoard(rng, band, solution.target, normalisedSeed);
    const cells = solutionCells(rng);
    const guaranteedTiles = solutionTiles(solution, `${normalisedSeed}-solution`);
    const firstRow = tiles[cells[0].row];
    const secondRow = tiles[cells[1].row];
    if (firstRow && secondRow) {
      firstRow[cells[0].col] = guaranteedTiles[0];
      secondRow[cells[1].col] = guaranteedTiles[1];
    }

    const candidate: Board = { width: 8, height: 8, tiles, seed: normalisedSeed };
    const ratio = decoyQuality(candidate, solution.target, band).ratio;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestTiles = tiles;
      bestTarget = solution.target;
    }
    if (ratio >= DECOY_NEAR_RATIO) break;
  }

  return {
    board: { width: 8, height: 8, tiles: bestTiles ?? [], seed: normalisedSeed },
    target: bestTarget ?? int(0),
    rngState: rng.state(),
  };
}

export function createInitialState(seed: number, rules: LevelRules, band: BandConfig): LevelState {
  const generated = createBoard(seed, band);
  return {
    phase: 'ready',
    board: generated.board,
    target: generated.target,
    chain: { cells: [] },
    preview: null,
    score: 0,
    combo: 0,
    movesUsed: 0,
    movesRemaining: rules.moveLimit ?? null,
    timeRemainingMs: rules.timeLimitMs ?? null,
    solvedCount: 0,
    attemptCount: 0,
    hintsUsed: 0,
    rules,
    band,
    rngState: generated.rngState,
    history: [],
  };
}

function packRules(band: BandConfig): LevelRules {
  return {
    objective: 'equationCount',
    goalValue: 10,
    moveLimit: 20,
    obstacles: [],
    allowedPowerUps: ['hintLens', 'equationShuffle'],
    targetSkills: [`${band.id}.mixed`],
  };
}

export function generatePackInternal(bandId: string, count: number, seed: number): PuzzleSeed[] {
  const band = defaultBand(bandId);
  if (!band || count <= 0) return [];
  const result: PuzzleSeed[] = [];
  const usedSeeds = new Set<number>();
  for (let index = 0; index < Math.floor(count); index += 1) {
    const firstCandidate = ((seed >>> 0) + Math.imul(index, 0x9e3779b9)) >>> 0;
    const rules = packRules(band);
    let puzzleSeed = firstCandidate;
    let validation: ReturnType<typeof validatePuzzle> | null = null;
    for (let attempt = 0; attempt < 512; attempt += 1) {
      puzzleSeed = (firstCandidate + attempt) >>> 0;
      if (usedSeeds.has(puzzleSeed)) continue;
      const candidate = createInitialState(puzzleSeed, rules, band);
      validation = validatePuzzle(candidate.board, candidate.target, rules, band);
      if (validation.valid) break;
    }
    if (!validation?.valid) throw new Error(`could not generate a valid ${band.id} puzzle`);
    usedSeeds.add(puzzleSeed);
    result.push({
      id: `${band.id}-${puzzleSeed.toString(36)}`,
      seed: puzzleSeed,
      band: band.id,
      rules,
      difficultyScore: difficultyScore(band, rules, validation.analysis),
      validation: {
        solvable: true,
        solutionCount: validation.analysis.solutions.length,
        accidentals: validation.analysis.accidentals.length,
      },
    });
  }
  return result;
}
