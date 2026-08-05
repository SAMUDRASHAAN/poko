/**
 * Gate 1 black-box behaviour suite.
 *
 * This deliberately imports only the package root. It verifies the contract a
 * consumer observes without coupling the harness to any engine implementation.
 */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  analyse,
  createLevel,
  dispatch,
  generatePack,
  restore,
  serialise,
  updateMastery,
  type BandConfig,
  type LevelRules,
  type Mastery,
} from '@poko/engine';

const SPROUT: BandConfig = {
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
};

const RULES: LevelRules = {
  objective: 'equationCount',
  goalValue: 10,
  moveLimit: 20,
  obstacles: [],
  allowedPowerUps: ['hintLens', 'equationShuffle'],
  targetSkills: ['sprout.mixed'],
};

describe('level generation and analysis [INV-3, INV-6]', () => {
  it('is deterministic for the same seed and varies across seeds', () => {
    const first = createLevel(0xdecafbad, RULES, SPROUT);
    const replay = createLevel(0xdecafbad, RULES, SPROUT);
    const other = createLevel(0xdecafbae, RULES, SPROUT);

    expect(replay).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('produces a publicly discoverable solution for every sampled seed', () => {
    for (let seed = 0; seed < 128; seed += 1) {
      const state = createLevel(seed, RULES, SPROUT);
      const analysis = analyse(state.board, state.target, state.rules);

      expect(analysis.isStuck, `seed ${seed}`).toBe(false);
      expect(analysis.bestSolution, `seed ${seed}`).not.toBeNull();
      expect(analysis.solutions.length, `seed ${seed}`).toBeGreaterThanOrEqual(SPROUT.minSolutions);
    }
  });

  /**
   * The 5ms budget is asserted against the DISTRIBUTION, not against every
   * individual sample.
   *
   * Asserting each seed individually failed twice on CI — seed 66 at 8.6ms, seed
   * 56 at 6.4ms — including on a documentation-only pull request that changed no
   * code, while the same seeds measure ~0.5ms locally. A single wall-clock sample
   * on a shared runner picks up GC pauses and CPU steal from other tenants. A
   * required check that cries wolf teaches everyone to re-run red builds, which is
   * how a real failure eventually gets waved through.
   *
   * Median and p90 carry the real signal: a genuine regression moves the whole
   * distribution, not one sample. The max is kept as a pathology guard at 5x the
   * budget — far above observed runner noise, but low enough to catch a board that
   * is genuinely catastrophic to analyse.
   *
   * Per-device frame budgets are Gate 2's job on real hardware; CI can only
   * honestly assert "no gross regression".
   */
  it('keeps public 8x8 analysis inside the 5ms budget', () => {
    const BUDGET_MS = 5;
    const PATHOLOGY_CEILING_MS = BUDGET_MS * 5;

    // Warm up module/JIT paths before measuring the public call itself.
    const warm = createLevel(41, RULES, SPROUT);
    analyse(warm.board, warm.target, warm.rules);

    const samples: { seed: number; elapsedMs: number }[] = [];
    for (let seed = 42; seed < 74; seed += 1) {
      const state = createLevel(seed, RULES, SPROUT);
      const started = performance.now();
      analyse(state.board, state.target, state.rules);
      samples.push({ seed, elapsedMs: performance.now() - started });
    }

    const sorted = [...samples].sort((a, b) => a.elapsedMs - b.elapsedMs);
    const at = (quantile: number): { seed: number; elapsedMs: number } =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] as {
        seed: number;
        elapsedMs: number;
      };

    const median = at(0.5);
    const p90 = at(0.9);
    const slowest = sorted[sorted.length - 1] as { seed: number; elapsedMs: number };
    const report =
      `median ${median.elapsedMs.toFixed(3)}ms, ` +
      `p90 ${p90.elapsedMs.toFixed(3)}ms, ` +
      `slowest ${slowest.elapsedMs.toFixed(3)}ms (seed ${slowest.seed})`;

    expect(median.elapsedMs, `median over budget — ${report}`).toBeLessThan(BUDGET_MS);
    expect(p90.elapsedMs, `p90 over budget — ${report}`).toBeLessThan(BUDGET_MS);
    expect(slowest.elapsedMs, `a single analysis was pathologically slow — ${report}`).toBeLessThan(
      PATHOLOGY_CEILING_MS,
    );
  });
});

describe('pure state transitions and persistence [INV-5, INV-7]', () => {
  it('plays a solver-provided solution without mutating the prior state', () => {
    let state = createLevel(90210, RULES, SPROUT);
    const solution = analyse(state.board, state.target, state.rules).bestSolution;
    expect(solution).not.toBeNull();
    if (!solution) return;

    const initialBlob = serialise(state);
    const begin = { type: 'BEGIN_CHAIN' as const, cell: solution.cells[0]! };
    const firstRun = dispatch(state, begin);
    const replay = dispatch(state, begin);

    expect(firstRun).toEqual(replay);
    expect(serialise(state)).toBe(initialBlob);
    state = firstRun;

    for (const cell of solution.cells.slice(1)) {
      const before = serialise(state);
      state = dispatch(state, { type: 'EXTEND_CHAIN', cell });
      expect(serialise(restore(before))).toBe(before);
    }

    expect(state.phase).toBe('previewing');
    expect(state.preview?.isValid).toBe(true);

    const committed = dispatch(state, { type: 'COMMIT' });
    expect(committed.solvedCount).toBe(1);
    expect(committed.attemptCount).toBe(1);
    expect(committed.movesUsed).toBe(1);
    expect(committed.chain.cells).toEqual([]);
    expect(committed.preview).toBeNull();
  });

  it('round-trips complete state losslessly and rejects non-state JSON', () => {
    let state = createLevel(1234, RULES, SPROUT);
    state = dispatch(state, { type: 'REQUEST_HINT' });
    state = dispatch(state, { type: 'PAUSE' });

    const blob = serialise(state);
    const restored = restore(blob);

    expect(restored).toEqual(state);
    expect(serialise(restored)).toBe(blob);
    expect(() => restore('{"not":"a level"}')).toThrow(TypeError);
  });
});

describe('pack and mastery services', () => {
  it('generates deterministic, unique, validated puzzle packs', () => {
    const first = generatePack('sprout', 12, 77);
    const replay = generatePack('sprout', 12, 77);

    expect(replay).toEqual(first);
    expect(first).toHaveLength(12);
    expect(new Set(first.map((puzzle) => puzzle.id)).size).toBe(first.length);
    expect(new Set(first.map((puzzle) => puzzle.seed)).size).toBe(first.length);

    for (const puzzle of first) {
      expect(puzzle.band).toBe('sprout');
      expect(puzzle.validation.solvable).toBe(true);
      expect(puzzle.validation.solutionCount).toBeGreaterThanOrEqual(SPROUT.minSolutions);
      expect(puzzle.validation.solutionCount).toBeLessThanOrEqual(SPROUT.maxSolutions);

      const state = createLevel(puzzle.seed, puzzle.rules, SPROUT);
      expect(analyse(state.board, state.target, state.rules).isStuck).toBe(false);
    }

    expect(generatePack('unknown', 5, 77)).toEqual([]);
    expect(generatePack('sprout', 0, 77)).toEqual([]);
  });

  it('updates mastery deterministically without mutating prior evidence', () => {
    const previous: Mastery = Object.freeze({
      skillId: 'sprout.addition',
      mastery: 0.5,
      attempts: 4,
      correct: 3,
      avgTimeMs: 5000,
      hintsUsed: 1,
      nextReviewInDays: 1,
    });
    const attempt = Object.freeze({
      skillId: previous.skillId,
      correct: true,
      timeMs: 3000,
      hintUsed: false,
      expectedTimeMs: 5000,
    });

    const first = updateMastery(previous, attempt);
    const replay = updateMastery(previous, attempt);

    expect(replay).toEqual(first);
    expect(previous.attempts).toBe(4);
    expect(first.attempts).toBe(5);
    expect(first.correct).toBe(4);
    expect(first.mastery).toBeGreaterThan(previous.mastery);
    expect(() => updateMastery(previous, { ...attempt, skillId: 'other' })).toThrow(RangeError);
  });
});
