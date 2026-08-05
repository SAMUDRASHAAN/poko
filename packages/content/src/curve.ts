/**
 * The shipped difficulty curve.
 *
 * `02-content-spec.md` §2: "A production curve must be monotonic under the
 * engine's difficulty score and reviewed by a human educator or designated
 * curriculum owner."
 *
 * Monotonicity is mechanical and enforced here. **Human review is not**, and this
 * module cannot substitute for it — §4 is explicit that no level enters the app
 * merely because generation succeeded.
 *
 * ## Why a selection step exists at all
 *
 * Concatenating the per-band packs does NOT produce a monotonic curve. The bands
 * overlap under the engine's difficulty score:
 *
 * | Band        | Generated range |
 * | ----------- | --------------- |
 * | sprout      | 40 – 55         |
 * | adventurer  | 49 – 64         |
 * | challenger  | 57 – 77         |
 * | trailblazer | 59 – 84         |
 * | pathfinder  | 72 – 97         |
 *
 * Played in band order, difficulty would drop 6 points crossing sprout →
 * adventurer, and again at every later boundary. A child would hit an easier level
 * immediately after being promoted, which is precisely the "frustration and
 * repetition" §4 asks the curve review to catch.
 *
 * So the curve is a monotonic subsequence: walk the bands in curriculum order and
 * keep a level only if it is at least as hard as the last one kept. Overlapping
 * levels are dropped from the curve, not from the packs — they remain available
 * for practice, review, or a future adaptive selection.
 */
import type { PuzzleSeed } from '@poko/engine';

import type { BandId } from './bands.js';

import { BAND_ORDER, LEVEL_PACKS } from './packs.js';

/** `02-content-spec.md` §4: the bundled pack ships at least this many levels. */
export const MINIMUM_CURVE_LENGTH = 50;

export type CurveEntry = {
  /** 1-based position in the shipped progression. */
  readonly position: number;
  readonly puzzle: PuzzleSeed;
};

/**
 * The shipped progression, ascending in difficulty and never decreasing.
 *
 * Deterministic: derived from committed artifacts with no randomness of its own.
 */
export function buildCurve(): readonly CurveEntry[] {
  const entries: CurveEntry[] = [];
  let floor = Number.NEGATIVE_INFINITY;

  for (const band of BAND_ORDER) {
    // Packs are emitted difficulty-sorted by levelgen; sort defensively so this
    // does not silently depend on that.
    const ascending = [...LEVEL_PACKS[band].puzzles].sort(
      (left, right) =>
        left.difficultyScore - right.difficultyScore || left.id.localeCompare(right.id),
    );

    for (const puzzle of ascending) {
      if (puzzle.difficultyScore < floor) continue;
      floor = puzzle.difficultyScore;
      entries.push({ position: entries.length + 1, puzzle });
    }
  }

  return entries;
}

export type CurveReport = {
  readonly length: number;
  readonly monotonic: boolean;
  readonly firstRegression: {
    readonly position: number;
    readonly from: number;
    readonly to: number;
  } | null;
  readonly difficultyRange: readonly [number, number];
  readonly perBand: Readonly<Record<BandId, number>>;
};

/** Measures the curve. Reports rather than throws, so tests can assert specifics. */
export function analyseCurve(curve: readonly CurveEntry[] = buildCurve()): CurveReport {
  const perBand = Object.fromEntries(BAND_ORDER.map((band) => [band, 0])) as Record<BandId, number>;
  let firstRegression: CurveReport['firstRegression'] = null;

  for (let index = 0; index < curve.length; index += 1) {
    const entry = curve[index] as CurveEntry;
    perBand[entry.puzzle.band] += 1;

    const previous = index > 0 ? (curve[index - 1] as CurveEntry) : null;
    if (
      previous &&
      entry.puzzle.difficultyScore < previous.puzzle.difficultyScore &&
      !firstRegression
    ) {
      firstRegression = {
        position: entry.position,
        from: previous.puzzle.difficultyScore,
        to: entry.puzzle.difficultyScore,
      };
    }
  }

  const first = curve[0];
  const last = curve[curve.length - 1];

  return {
    length: curve.length,
    monotonic: firstRegression === null,
    firstRegression,
    difficultyRange: [first?.puzzle.difficultyScore ?? 0, last?.puzzle.difficultyScore ?? 0],
    perBand,
  };
}
