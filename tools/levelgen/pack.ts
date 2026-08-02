import { generatePack, type PuzzleSeed } from '../verify/engine-contract.js';

export const BAND_IDS = [
  'sprout',
  'adventurer',
  'challenger',
  'trailblazer',
  'pathfinder',
] as const;

export type LevelgenBandId = (typeof BAND_IDS)[number];

export type LevelPackArtifact = {
  readonly schemaVersion: 1;
  readonly packSeed: number;
  readonly band: LevelgenBandId;
  readonly count: number;
  readonly puzzles: readonly PuzzleSeed[];
};

const MAX_SOLUTIONS: Readonly<Record<LevelgenBandId, number>> = {
  sprout: 4,
  adventurer: 5,
  challenger: 5,
  trailblazer: 6,
  pathfinder: 8,
};

export function isLevelgenBandId(value: string): value is LevelgenBandId {
  return BAND_IDS.some((band) => band === value);
}

function assertInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`);
}

export function validatePuzzles(
  band: LevelgenBandId,
  count: number,
  puzzles: readonly PuzzleSeed[],
): void {
  if (puzzles.length !== count) {
    throw new Error(`engine returned ${puzzles.length} puzzles; expected ${count}`);
  }

  const ids = new Set<string>();
  const seeds = new Set<number>();
  for (const puzzle of puzzles) {
    if (puzzle.band !== band) throw new Error(`puzzle ${puzzle.id} is outside band ${band}`);
    if (!puzzle.validation.solvable) throw new Error(`puzzle ${puzzle.id} is unsolvable`);
    if (
      puzzle.validation.solutionCount < 1 ||
      puzzle.validation.solutionCount > MAX_SOLUTIONS[band]
    ) {
      throw new Error(`puzzle ${puzzle.id} has an out-of-band solution count`);
    }
    if (puzzle.validation.accidentals > MAX_SOLUTIONS[band] - 1) {
      throw new Error(`puzzle ${puzzle.id} exceeds the accidental-solution limit`);
    }
    if (!Number.isFinite(puzzle.difficultyScore) || puzzle.difficultyScore < 0) {
      throw new Error(`puzzle ${puzzle.id} has an invalid difficulty score`);
    }
    if (ids.has(puzzle.id)) throw new Error(`duplicate puzzle id: ${puzzle.id}`);
    if (seeds.has(puzzle.seed)) throw new Error(`duplicate puzzle seed: ${puzzle.seed}`);
    ids.add(puzzle.id);
    seeds.add(puzzle.seed);
  }
}

export function buildPackArtifact(
  band: LevelgenBandId,
  count: number,
  seed: number,
): LevelPackArtifact {
  assertInteger('count', count);
  assertInteger('seed', seed);
  if (count <= 0) throw new RangeError('count must be greater than zero');

  const puzzles = generatePack(band, count, seed);
  validatePuzzles(band, count, puzzles);
  const sorted = [...puzzles].sort(
    (left, right) =>
      left.difficultyScore - right.difficultyScore || left.id.localeCompare(right.id),
  );

  return {
    schemaVersion: 1,
    packSeed: seed >>> 0,
    band,
    count,
    puzzles: sorted,
  };
}

export function renderPackArtifact(artifact: LevelPackArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
