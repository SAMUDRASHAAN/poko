/**
 * The shipped level packs.
 *
 * A level is a deterministic seed, never a hand-authored board [02-content-spec §1].
 * These artifacts are produced by `tools/levelgen`, which generates, validates,
 * sorts and emits stable JSON; content selects and orders them, and never
 * overrides a validator result.
 *
 * Regenerate with, per band:
 *   node --import tsx tools/levelgen/index.ts \
 *     --band <band> --count 50 --seed <packSeed> --output packages/content/levels/<band>.json
 *
 * The pack seeds below are the reproduction key. `packs.spec.ts` regenerates from
 * them and fails if a committed artifact no longer matches the engine.
 */
import type { PuzzleSeed } from '@poko/engine';

import type { BandId } from './bands.js';

import adventurer from '../levels/adventurer.json' with { type: 'json' };
import challenger from '../levels/challenger.json' with { type: 'json' };
import pathfinder from '../levels/pathfinder.json' with { type: 'json' };
import sprout from '../levels/sprout.json' with { type: 'json' };
import trailblazer from '../levels/trailblazer.json' with { type: 'json' };

export type LevelPack = {
  readonly schemaVersion: 1;
  readonly packSeed: number;
  readonly band: BandId;
  readonly count: number;
  readonly puzzles: readonly PuzzleSeed[];
};

/**
 * Band order is the progression order. New concepts are introduced one at a time
 * [02-content-spec §2], so this order is curriculum, not preference.
 */
export const BAND_ORDER: readonly BandId[] = [
  'sprout',
  'adventurer',
  'challenger',
  'trailblazer',
  'pathfinder',
];

export const LEVEL_PACKS: Readonly<Record<BandId, LevelPack>> = {
  sprout: sprout as LevelPack,
  adventurer: adventurer as LevelPack,
  challenger: challenger as LevelPack,
  trailblazer: trailblazer as LevelPack,
  pathfinder: pathfinder as LevelPack,
};

/** The pack seed each band's artifact was generated from. */
export const PACK_SEEDS: Readonly<Record<BandId, number>> = {
  sprout: LEVEL_PACKS.sprout.packSeed,
  adventurer: LEVEL_PACKS.adventurer.packSeed,
  challenger: LEVEL_PACKS.challenger.packSeed,
  trailblazer: LEVEL_PACKS.trailblazer.packSeed,
  pathfinder: LEVEL_PACKS.pathfinder.packSeed,
};

/** Every generated candidate, in band order. Not the shipped curve — see `curve.ts`. */
export function allCandidates(): readonly PuzzleSeed[] {
  return BAND_ORDER.flatMap((band) => LEVEL_PACKS[band].puzzles);
}
