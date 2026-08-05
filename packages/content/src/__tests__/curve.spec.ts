/**
 * Content quality gate.
 *
 * Difficulty-curve monotonicity is the same shape of risk as decoy quality
 * (ADR-0009): a property stated in prose, invisible to every other test, and
 * silently destructive if it drifts. This file is the mechanical half of
 * `02-content-spec.md` §2. The human educator review it also demands is not
 * something a test can supply.
 */
import { describe, expect, it } from 'vitest';
import { analyse, createLevel, generatePack } from '@poko/engine';

import { BANDS } from '../bands.js';
import {
  BAND_ORDER,
  LEVEL_PACKS,
  MINIMUM_CURVE_LENGTH,
  allCandidates,
  analyseCurve,
  buildCurve,
} from '../index.js';

describe('shipped level packs [02-content-spec §4]', () => {
  it('ships at least the required number of validated levels', () => {
    expect(allCandidates().length).toBeGreaterThanOrEqual(MINIMUM_CURVE_LENGTH);
  });

  it('has globally unique ids and seeds', () => {
    const candidates = allCandidates();
    expect(new Set(candidates.map((p) => p.id)).size).toBe(candidates.length);
    expect(new Set(candidates.map((p) => p.seed)).size).toBe(candidates.length);
  });

  it('carries only solvable puzzles inside their band solution limits', () => {
    for (const band of BAND_ORDER) {
      const config = BANDS[band];
      for (const puzzle of LEVEL_PACKS[band].puzzles) {
        expect(puzzle.band, puzzle.id).toBe(band);
        expect(puzzle.validation.solvable, puzzle.id).toBe(true);
        expect(puzzle.validation.solutionCount, puzzle.id).toBeGreaterThanOrEqual(
          config.minSolutions,
        );
        expect(puzzle.validation.solutionCount, puzzle.id).toBeLessThanOrEqual(config.maxSolutions);
      }
    }
  });

  /**
   * `02-content-spec.md` §4.6: levelgen must "reproduce identical output when
   * rerun against the same engine revision". Regenerating from the recorded pack
   * seed and deep-comparing is that check. If a generation change lands without
   * regenerating content, this fails — which is the point. ADR-0009 already
   * invalidated every seed once.
   */
  it('reproduces byte-identically from its pack seed [02-content-spec §4.6]', () => {
    for (const band of BAND_ORDER) {
      const pack = LEVEL_PACKS[band];
      // levelgen sorts before emitting; apply the same order to compare.
      const regenerated = [...generatePack(band, pack.count, pack.packSeed)].sort(
        (left, right) =>
          left.difficultyScore - right.difficultyScore || left.id.localeCompare(right.id),
      );
      expect(regenerated, `${band} pack no longer reproduces`).toEqual(pack.puzzles);
    }
  });

  /**
   * Independently of the recorded counts, every shipped level must still be
   * playable through the public surface a consumer actually calls.
   *
   * Note this asserts solvability, not the exact `validation.solutionCount`: that
   * figure comes from the engine's band-aware analyser, and the package root
   * exports only the rules-only `analyse`. Re-deriving it here is not possible
   * without a frozen-contract change.
   */
  it('stays playable through the public API', () => {
    for (const band of BAND_ORDER) {
      const config = BANDS[band];
      for (const puzzle of LEVEL_PACKS[band].puzzles) {
        const state = createLevel(puzzle.seed, puzzle.rules, config);
        const analysis = analyse(state.board, state.target, state.rules);
        expect(analysis.isStuck, `${puzzle.id} is stuck`).toBe(false);
        expect(analysis.solutions.length, `${puzzle.id} has no solution`).toBeGreaterThan(0);
        expect(createLevel(puzzle.seed, puzzle.rules, config), `${puzzle.id}`).toEqual(state);
      }
    }
  });
});

describe('difficulty curve [02-content-spec §2]', () => {
  it('never decreases in difficulty', () => {
    const report = analyseCurve();
    expect(
      report.monotonic,
      report.firstRegression
        ? `difficulty drops at position ${report.firstRegression.position}: ` +
            `${report.firstRegression.from} → ${report.firstRegression.to}`
        : 'monotonic',
    ).toBe(true);
  });

  it('is long enough to ship', () => {
    expect(analyseCurve().length).toBeGreaterThanOrEqual(MINIMUM_CURVE_LENGTH);
  });

  it('introduces bands in curriculum order', () => {
    const seen: string[] = [];
    for (const entry of buildCurve()) {
      if (seen[seen.length - 1] !== entry.puzzle.band) seen.push(entry.puzzle.band);
    }
    // A band may appear only once as a contiguous run: no band is revisited after
    // a later one has started.
    expect(seen).toEqual(BAND_ORDER.filter((band) => seen.includes(band)));
  });

  it('draws on every band', () => {
    const report = analyseCurve();
    for (const band of BAND_ORDER) {
      expect(report.perBand[band], `${band} contributes no levels`).toBeGreaterThan(0);
    }
  });

  it('positions are contiguous and 1-based', () => {
    const curve = buildCurve();
    expect(curve.map((entry) => entry.position)).toEqual(
      Array.from({ length: curve.length }, (_, index) => index + 1),
    );
  });

  it('detects a regression when one is present', () => {
    // Guards the guard: analyseCurve must actually fail on a bad curve. Built from
    // the real endpoints so the drop is unambiguous — adjacent entries often share
    // a difficulty score, and swapping two equal ones is not a regression.
    const curve = buildCurve();
    const easiest = curve[0];
    const hardest = curve[curve.length - 1];
    expect(
      easiest && hardest && hardest.puzzle.difficultyScore > easiest.puzzle.difficultyScore,
    ).toBe(true);
    if (!easiest || !hardest) return;

    const report = analyseCurve([
      { ...hardest, position: 1 },
      { ...easiest, position: 2 },
    ]);
    expect(report.monotonic).toBe(false);
    expect(report.firstRegression).toEqual({
      position: 2,
      from: hardest.puzzle.difficultyScore,
      to: easiest.puzzle.difficultyScore,
    });
  });
});
