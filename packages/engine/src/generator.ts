import { difficultyScore } from './difficulty.js';
import { int } from './num.js';
import { createRng, type Rng } from './rng.js';
import { validatePuzzle } from './validator.js';
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

export function randomTile(rng: Rng, band: BandConfig, id: string): Tile {
  const { operation, colour } = operationSlot(rng, band);
  const value = rng.int(band.numberRange[0], band.numberRange[1]);
  return operation === 'wild'
    ? { id, value: int(value), colour, operation, ownOperator: 'add' }
    : { id, value: int(value), colour, operation };
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
  const tiles: Tile[][] = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => randomTile(rng, band, `${normalisedSeed}-${row}-${col}`)),
  );
  const solution = chooseGuaranteedSolution(rng, band);
  const cells = solutionCells(rng);
  const guaranteedTiles = solutionTiles(solution, `${normalisedSeed}-solution`);
  const firstRow = tiles[cells[0].row];
  const secondRow = tiles[cells[1].row];
  if (firstRow && secondRow) {
    firstRow[cells[0].col] = guaranteedTiles[0];
    secondRow[cells[1].col] = guaranteedTiles[1];
  }
  return {
    board: { width: 8, height: 8, tiles, seed: normalisedSeed },
    target: solution.target,
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
