/**
 * Band configurations.
 *
 * `02-content-spec.md` §1 assigns these to content: "packages/content owns band
 * configurations". §2 lists the declared controls a band may vary, and this file
 * varies nothing else.
 *
 * ## Known drift, deliberately surfaced rather than papered over
 *
 * `packages/engine/src/generator.ts` also hardcodes a `DEFAULT_BANDS` table, which
 * `generatePack(bandId, …)` resolves internally. So the same configuration exists
 * in two places, and only one of them is the one the spec names as owner.
 *
 * These values are transcribed to match the engine's table exactly, and
 * `curve.spec.ts` asserts that every generated puzzle satisfies the constraints
 * declared HERE — so if the two ever diverge, content fails rather than shipping a
 * pack built to a different configuration than it advertises.
 *
 * Collapsing the duplication means changing the engine's public surface so a
 * caller can supply the band, which is a frozen-contract change: it needs an ADR
 * and a cross-worktree sync point, not a quiet edit.
 */
import type { BandConfig } from '@poko/engine';

/**
 * `BandId` is not exported from the engine's package root, though `PuzzleSeed.band`
 * and `BandConfig.id` are both typed with it. Deriving it from the exported
 * `BandConfig` gives the identical type without touching the frozen contract —
 * adding the export would need an ADR and a cross-worktree sync point.
 */
export type BandId = BandConfig['id'];

export const BANDS: Readonly<Record<BandId, BandConfig>> = {
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
