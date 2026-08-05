/**
 * Decoy quality — the teaching-value guard.
 *
 * `.claude/rules/engine.md`, docs/02-content-spec.md and ADR-0004 all require that
 * 60% of decoy pairs evaluate within +/-3 of the target. Weak decoys let a child
 * pattern-match instead of calculating, which destroys the teaching value while
 * every other test still passes — so this file is the only thing standing between
 * the product and that failure. See ADR-0009.
 *
 * A "decoy pair" is an adjacent CHAINABLE pair (same colour, per validateChain)
 * whose result is not the target. Colour-mismatched pairs are excluded because a
 * child cannot chain them at all.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createInitialState, defaultBand, generatePackInternal } from '../generator.js';
import { refillAfterRemoval } from '../refill.js';
import { analyseWithBand } from '../solver.js';
import { DECOY_NEAR_RATIO, decoyQuality } from '../validator.js';
import type { BandId } from '../types.js';
import { RULES } from './fixtures.js';

const BAND_IDS: readonly BandId[] = [
  'sprout',
  'adventurer',
  'challenger',
  'trailblazer',
  'pathfinder',
];

describe('decoy quality [ADR-0004, ADR-0009]', () => {
  it.each(BAND_IDS)('generates boards whose decoys are near the target: %s', (bandId) => {
    const band = defaultBand(bandId);
    expect(band).not.toBeNull();
    if (!band) return;

    let chainable = 0;
    let near = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const state = createInitialState(seed, RULES, band);
      const quality = decoyQuality(state.board, state.target, band);
      chainable += quality.chainable;
      near += quality.near;
    }

    // Aggregate across seeds so one unlucky board cannot fail the suite, while a
    // systemic regression still does.
    expect(chainable).toBeGreaterThan(0);
    expect(near / chainable).toBeGreaterThanOrEqual(DECOY_NEAR_RATIO);
  });

  /**
   * ────────────────────────────────────────────────────────────────────────────
   * The guarantee has TWO TIERS. Each test below asserts at the strength its
   * path actually provides, and the two must not be conflated.
   *
   *   generatePack  — ABSOLUTE.    validate + retry on `weakDecoys`, so a puzzle
   *                                that misses the bar is never returned.
   *   createLevel   — STATISTICAL. the tune loop is best-of-`DECOY_TUNE_ATTEMPTS`
   *                                and returns the best board it found, which
   *                                for a small fraction of seeds is under 0.6.
   *
   * Every child-facing level comes from `generatePack`, so the product carries
   * the absolute guarantee. `createLevel` on an arbitrary seed does not.
   * ────────────────────────────────────────────────────────────────────────────
   */

  /**
   * TIER 1 — the absolute path, tested at full strength.
   *
   * Arbitrary pack seeds via fast-check. Every puzzle a pack returns must clear
   * the bar, with no tolerance: this is the path the product ships on.
   */
  it.each(BAND_IDS)('generatePack never returns a board below the bar: %s', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`${bandId} band missing`);

    fc.assert(
      fc.property(fc.integer(), (packSeed) => {
        for (const puzzle of generatePackInternal(bandId, 3, packSeed)) {
          const state = createInitialState(puzzle.seed, puzzle.rules, band);
          const quality = decoyQuality(state.board, state.target, band);
          expect(quality.chainable, puzzle.id).toBeGreaterThan(0);
          expect(quality.ratio, puzzle.id).toBeGreaterThanOrEqual(DECOY_NEAR_RATIO);
        }
      }),
      { numRuns: 25 },
    );
  });

  /**
   * TIER 2 — the statistical path, tested as a distribution.
   *
   * A FIXED seed sequence, deliberately NOT fast-check.
   *
   * An absolute per-board floor on a best-effort path is a category error, and
   * fast-check will eventually falsify it — it already did, in CI, at 0.594 after
   * 109 runs. Replacing this sweep with a property test would re-introduce that
   * failure and teach everyone to re-run red builds. Do not "simplify" it back.
   *
   * What is asserted instead is the shape of the distribution: it must be
   * centred well above the bar, its tail below the bar must stay negligible, and
   * no board may fall off a cliff. A real regression moves all three.
   */
  const SWEEP_SEEDS = 20_000;
  const SWEEP_MEAN_FLOOR = DECOY_NEAR_RATIO;
  const SWEEP_TAIL_LIMIT = 0.001; // at most 0.1% of seeds below the bar
  const SWEEP_ABSOLUTE_FLOOR = 0.55;

  it.each(BAND_IDS)('createLevel holds the bar statistically across seeds: %s', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`${bandId} band missing`);

    let total = 0;
    let below = 0;
    let floor = 1;

    for (let index = 0; index < SWEEP_SEEDS; index += 1) {
      // Deterministic, well-spread sequence: the same seeds every run, so a
      // failure is reproducible rather than a coin toss.
      const seed = (index * 2654435761) >>> 0;
      const state = createInitialState(seed, RULES, band);
      const { ratio } = decoyQuality(state.board, state.target, band);

      total += ratio;
      if (ratio < DECOY_NEAR_RATIO) below += 1;
      if (ratio < floor) floor = ratio;
    }

    const mean = total / SWEEP_SEEDS;
    const tail = below / SWEEP_SEEDS;
    const report =
      `mean ${(mean * 100).toFixed(1)}%, ` +
      `${below}/${SWEEP_SEEDS} below the bar (${(tail * 100).toFixed(3)}%), ` +
      `floor ${(floor * 100).toFixed(1)}%`;

    expect(mean, `mean below the bar — ${report}`).toBeGreaterThanOrEqual(SWEEP_MEAN_FLOOR);
    expect(tail, `too many seeds below the bar — ${report}`).toBeLessThanOrEqual(SWEEP_TAIL_LIMIT);
    expect(floor, `a board fell off a cliff — ${report}`).toBeGreaterThanOrEqual(
      SWEEP_ABSOLUTE_FLOOR,
    );
  });

  /**
   * TIER 1, restated as the shipping path.
   *
   * A level rebuilt from a validated `PuzzleSeed` — which is exactly what the app
   * does with content — inherits the absolute guarantee. This makes the claim
   * executable rather than something the ADR merely asserts in prose.
   */
  it.each(BAND_IDS)('a level rebuilt from a validated seed clears the bar: %s', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`${bandId} band missing`);

    const pack = generatePackInternal(bandId, 25, 4242);
    expect(pack.length).toBe(25);

    for (const puzzle of pack) {
      const state = createInitialState(puzzle.seed, puzzle.rules, band);
      const quality = decoyQuality(state.board, state.target, band);
      expect(quality.ratio, `${puzzle.id} shipped below the bar`).toBeGreaterThanOrEqual(
        DECOY_NEAR_RATIO,
      );
    }
  });

  /**
   * Refill is a weaker guarantee than generation, deliberately.
   *
   * At generation the engine owns every tile. At refill it owns only the incoming
   * tiles and the choice of target — the tiles the child did NOT clear cannot be
   * rewritten under their fingers without erasing the board they were reasoning
   * about. So the rule is asserted across refills, with a floor that catches a
   * collapse on any single one. See ADR-0009.
   */
  const REFILL_COLLAPSE_FLOOR = 0.45;

  it.each(BAND_IDS)('sustains decoy quality across refills: %s', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`${bandId} band missing`);

    let chainable = 0;
    let near = 0;
    for (let seed = 1; seed <= 250; seed += 1) {
      const state = createInitialState(seed, RULES, band);
      const best = analyseWithBand(state.board, state.target, RULES, band).bestSolution;
      const refilled = refillAfterRemoval(
        state.board,
        best?.cells ?? [],
        band,
        state.rules,
        state.rngState,
      );
      const quality = decoyQuality(refilled.board, refilled.target, band);
      expect(quality.chainable).toBeGreaterThan(0);
      // Pre-fix, a single refill could fall to 1.7%. This floor catches that.
      expect(quality.ratio).toBeGreaterThanOrEqual(REFILL_COLLAPSE_FLOOR);
      chainable += quality.chainable;
      near += quality.near;
    }

    expect(near / chainable).toBeGreaterThanOrEqual(DECOY_NEAR_RATIO);
  });

  it('stays solvable while steering decoys', () => {
    for (const bandId of BAND_IDS) {
      const band = defaultBand(bandId);
      if (!band) throw new Error(`${bandId} band missing`);
      for (let seed = 1; seed <= 60; seed += 1) {
        const state = createInitialState(seed, RULES, band);
        const analysis = analyseWithBand(state.board, state.target, RULES, band);
        expect(analysis.isStuck).toBe(false);
        expect(analysis.solutions.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Steering pulls neighbouring tiles toward one colour and one value range, and
   * left unchecked it collapses the board into a monoculture: one seed produced an
   * entire board of 3s with target 9, where every pair was a solution, there were
   * no decoys at all, and the solver found 370 chains against a ceiling of 6.
   *
   * `MAX_STEERED_RUN` in the generator is what prevents that. This is the test
   * that fails if it is ever removed.
   */
  it.each(BAND_IDS)('does not collapse the board into a monoculture: %s', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`${bandId} band missing`);

    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createInitialState(seed, RULES, band);
      const values = new Set<number>();
      const colours = new Set<string>();
      let commonest = 0;
      const counts = new Map<number, number>();

      for (const row of state.board.tiles) {
        for (const tile of row) {
          if (!tile) continue;
          values.add(tile.value.n);
          colours.add(tile.colour);
          const next = (counts.get(tile.value.n) ?? 0) + 1;
          counts.set(tile.value.n, next);
          commonest = Math.max(commonest, next);
        }
      }

      expect(values.size).toBeGreaterThanOrEqual(3);
      expect(colours.size).toBeGreaterThanOrEqual(Math.min(2, band.allowedColours.length));
      // No single value may own most of the board.
      expect(commonest).toBeLessThan(state.board.width * state.board.height * 0.5);
    }
  });
});
