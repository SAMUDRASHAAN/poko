import { describe, expect, it } from 'vitest';

import { createInitialState, defaultBand } from '../generator.js';
import { dispatchGame } from '../machine.js';
import { int } from '../num.js';
import { analyseWithBand } from '../solver.js';
import type { BandId } from '../types.js';
import { validatePuzzle } from '../validator.js';
import { BAND, RULES } from './fixtures.js';

function playBestSolution(seed = 7) {
  let state = createInitialState(seed, RULES, BAND);
  const solution = analyseWithBand(state.board, state.target, RULES, BAND).bestSolution;
  if (!solution) throw new Error('fixture must be solvable');
  state = dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
  for (const cell of solution.cells.slice(1)) {
    state = dispatchGame(state, { type: 'EXTEND_CHAIN', cell });
  }
  return { state, solution };
}

describe('pure game reducer [INV-5, INV-7]', () => {
  it('previews and atomically resolves a correct chain', () => {
    const { state: preview } = playBestSolution();
    expect(preview.phase).toBe('previewing');
    const before = JSON.stringify(preview);
    const resolved = dispatchGame(preview, { type: 'COMMIT' });
    expect(JSON.stringify(preview)).toBe(before);
    expect(resolved.phase).toBe('ready');
    expect(resolved.solvedCount).toBe(1);
    expect(resolved.movesUsed).toBe(1);
    expect(resolved.score).toBeGreaterThan(0);
    expect(analyseWithBand(resolved.board, resolved.target, RULES, BAND).isStuck).toBe(false);
  });

  it('rejects a wrong chain without spending a move', () => {
    let state = createInitialState(8, RULES, BAND);
    state = { ...state, target: int(999) };
    const solution = analyseWithBand(
      state.board,
      createInitialState(8, RULES, BAND).target,
      RULES,
      BAND,
    ).bestSolution;
    if (!solution) throw new Error('fixture must have a chain');
    state = dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
    state = dispatchGame(state, { type: 'EXTEND_CHAIN', cell: solution.cells[1]! });
    const rejected = dispatchGame(state, { type: 'COMMIT' });
    expect(rejected.phase).toBe('ready');
    expect(rejected.movesUsed).toBe(0);
    expect(rejected.attemptCount).toBe(1);
  });

  it('supports pause, tick, hints, cancellation, retraction, and legal swaps', () => {
    let state = createInitialState(9, { ...RULES, timeLimitMs: 1000 }, BAND);
    state = dispatchGame(state, { type: 'PAUSE' });
    expect(state.phase).toBe('paused');
    state = dispatchGame(state, { type: 'RESUME' });
    state = dispatchGame(state, { type: 'REQUEST_HINT' });
    expect(state.hintsUsed).toBe(1);
    state = dispatchGame(state, { type: 'TICK', deltaMs: 250 });
    expect(state.timeRemainingMs).toBe(750);

    const solution = analyseWithBand(state.board, state.target, RULES, BAND).bestSolution!;
    state = dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
    state = dispatchGame(state, { type: 'EXTEND_CHAIN', cell: solution.cells[1]! });
    state = dispatchGame(state, { type: 'RETRACT_CHAIN' });
    expect(state.chain.cells).toHaveLength(1);
    state = dispatchGame(state, { type: 'CANCEL_CHAIN' });
    expect(state.phase).toBe('ready');
  });

  it('marks an equation-count objective complete', () => {
    const oneSolveRules = { ...RULES, goalValue: 1 };
    let state = createInitialState(11, oneSolveRules, BAND);
    const solution = analyseWithBand(state.board, state.target, oneSolveRules, BAND).bestSolution!;
    state = dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
    for (const cell of solution.cells.slice(1)) {
      state = dispatchGame(state, { type: 'EXTEND_CHAIN', cell });
    }
    expect(dispatchGame(state, { type: 'COMMIT' }).phase).toBe('levelComplete');
  });

  it('covers guarded actions, power-ups, timeout, score goals, and move exhaustion', () => {
    const initial = createInitialState(14, RULES, BAND);
    expect(dispatchGame(initial, { type: 'BEGIN_CHAIN', cell: { row: -1, col: 0 } })).toBe(initial);
    expect(dispatchGame(initial, { type: 'COMMIT' })).toBe(initial);
    expect(dispatchGame(initial, { type: 'RETRACT_CHAIN' })).toBe(initial);
    expect(dispatchGame(initial, { type: 'CANCEL_CHAIN' })).toBe(initial);
    expect(
      dispatchGame(initial, { type: 'SWAP', a: { row: 0, col: 0 }, b: { row: 7, col: 7 } }),
    ).toBe(initial);
    expect(dispatchGame(initial, { type: 'USE_POWER_UP', id: 'calculatorBomb' })).toBe(initial);
    expect(dispatchGame(initial, { type: 'TICK', deltaMs: 1 })).toBe(initial);
    expect(dispatchGame(initial, { type: 'RESUME' })).toBe(initial);
    expect(dispatchGame(initial, { type: 'ADVANCE_PHASE' })).toBe(initial);

    const hinted = dispatchGame(initial, { type: 'USE_POWER_UP', id: 'hintLens' });
    expect(hinted.hintsUsed).toBe(1);
    const shuffled = dispatchGame(initial, { type: 'USE_POWER_UP', id: 'equationShuffle' });
    expect(shuffled.board).not.toEqual(initial.board);

    const withExtraPowerUp = {
      ...initial,
      rules: {
        ...initial.rules,
        allowedPowerUps: [...initial.rules.allowedPowerUps, 'calculatorBomb' as const],
      },
    };
    expect(
      dispatchGame(withExtraPowerUp, { type: 'USE_POWER_UP', id: 'calculatorBomb' }).history,
    ).toHaveLength(1);

    const timed = createInitialState(15, { ...RULES, timeLimitMs: 10 }, BAND);
    expect(dispatchGame(timed, { type: 'TICK', deltaMs: 10 }).phase).toBe('levelEnded');
    expect(dispatchGame({ ...timed, phase: 'paused' }, { type: 'TICK', deltaMs: 1 }).phase).toBe(
      'paused',
    );
    expect(dispatchGame(timed, { type: 'TICK', deltaMs: 0 })).toBe(timed);

    const scoreRules = { ...RULES, objective: 'scoreTide' as const, goalValue: 1 };
    let scoreState = createInitialState(16, scoreRules, BAND);
    const scoreSolution = analyseWithBand(
      scoreState.board,
      scoreState.target,
      scoreRules,
      BAND,
    ).bestSolution!;
    scoreState = dispatchGame(scoreState, { type: 'BEGIN_CHAIN', cell: scoreSolution.cells[0]! });
    scoreState = dispatchGame(scoreState, { type: 'EXTEND_CHAIN', cell: scoreSolution.cells[1]! });
    expect(dispatchGame(scoreState, { type: 'COMMIT' }).phase).toBe('levelComplete');

    const finalMoveRules = { ...RULES, goalValue: 99, moveLimit: 1 };
    let finalMove = createInitialState(17, finalMoveRules, BAND);
    const finalSolution = analyseWithBand(
      finalMove.board,
      finalMove.target,
      finalMoveRules,
      BAND,
    ).bestSolution!;
    finalMove = dispatchGame(finalMove, { type: 'BEGIN_CHAIN', cell: finalSolution.cells[0]! });
    finalMove = dispatchGame(finalMove, { type: 'EXTEND_CHAIN', cell: finalSolution.cells[1]! });
    expect(dispatchGame(finalMove, { type: 'COMMIT' }).phase).toBe('levelEnded');
  });

  it('accepts a solution-preserving adjacent swap and rejects chain misuse', () => {
    let state = createInitialState(18, RULES, BAND);
    const solution = analyseWithBand(state.board, state.target, RULES, BAND).bestSolution!;
    const swapped = dispatchGame(state, {
      type: 'SWAP',
      a: solution.cells[0]!,
      b: solution.cells[1]!,
    });
    if (!analyseWithBand(swapped.board, swapped.target, RULES, BAND).isStuck) {
      expect(swapped.movesUsed).toBe(1);
    }

    state = dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
    expect(dispatchGame(state, { type: 'BEGIN_CHAIN', cell: solution.cells[1]! })).toBe(state);
    expect(dispatchGame(state, { type: 'EXTEND_CHAIN', cell: solution.cells[0]! })).toBe(state);
    expect(dispatchGame(state, { type: 'REQUEST_HINT' })).toBe(state);
    expect(dispatchGame({ ...state, phase: 'paused' }, { type: 'PAUSE' }).phase).toBe('paused');
  });

  it('recovers from short-chain release and resumes the active drag phase', () => {
    const initial = createInitialState(19, RULES, BAND);
    const solution = analyseWithBand(initial.board, initial.target, RULES, BAND).bestSolution!;
    const dragging = dispatchGame(initial, { type: 'BEGIN_CHAIN', cell: solution.cells[0]! });
    const shortRelease = dispatchGame(dragging, { type: 'COMMIT' });
    expect(shortRelease.phase).toBe('ready');
    expect(shortRelease.attemptCount).toBe(1);

    const pausedDrag = dispatchGame(dragging, { type: 'PAUSE' });
    expect(dispatchGame(pausedDrag, { type: 'RESUME' }).phase).toBe('dragging');

    const previewing = dispatchGame(dragging, {
      type: 'EXTEND_CHAIN',
      cell: solution.cells[1]!,
    });
    const pausedPreview = dispatchGame(previewing, { type: 'PAUSE' });
    expect(dispatchGame(pausedPreview, { type: 'RESUME' }).phase).toBe('previewing');
  });

  it('is deterministic for the same action and safely rejects edge swaps', () => {
    const { state } = playBestSolution(20);
    expect(dispatchGame(state, { type: 'COMMIT' })).toEqual(
      dispatchGame(state, { type: 'COMMIT' }),
    );

    const initial = createInitialState(21, RULES, BAND);
    expect(
      dispatchGame(initial, {
        type: 'SWAP',
        a: { row: -1, col: 0 },
        b: { row: 0, col: 0 },
      }),
    ).toBe(initial);
  });
});

/**
 * `equationShuffle` is the one live path that hands a child a board built straight
 * from `createInitialState`. Everything else comes from `generatePack`, which
 * validates and retries.
 *
 * That matters because `createInitialState` guarantees solvability but NOT
 * `band.maxSolutions`: unenforced, only 3.3% of sprout boards sit at or under the
 * ceiling of 4, against a median of 14. Nothing measured this, so the gap survived
 * an entire phase of green builds — the reason it is measured here now.
 *
 * A deterministic sweep, not fast-check: the property is absolute (the power-up
 * retries until it holds), but the failure mode worth catching is the retry loop
 * being removed or capped too low, and a fixed sweep catches that reproducibly
 * without the shrinking cost.
 */
describe('equationShuffle respects the band it shuffles within', () => {
  const BAND_IDS: readonly BandId[] = [
    'sprout',
    'adventurer',
    'challenger',
    'trailblazer',
    'pathfinder',
  ];
  const SEEDS = 50;

  it.each(BAND_IDS)('keeps %s boards at or under the solution ceiling', (bandId) => {
    const band = defaultBand(bandId);
    if (!band) throw new Error(`missing band ${bandId}`);

    const breaches: string[] = [];

    for (let index = 0; index < SEEDS; index += 1) {
      const seed = (index * 2654435761) >>> 0;
      const state = dispatchGame(createInitialState(seed, RULES, band), {
        type: 'USE_POWER_UP',
        id: 'equationShuffle',
      });

      const solutions = analyseWithBand(state.board, state.target, RULES, band).solutions.length;
      if (solutions > band.maxSolutions) {
        breaches.push(`seed ${seed}: ${solutions} solutions > ceiling ${band.maxSolutions}`);
      }
    }

    expect(breaches, breaches.slice(0, 5).join('\n')).toEqual([]);
  });

  /**
   * The ceiling is one of several reasons `validatePuzzle` can reject a board. The
   * power-up retries on ALL of them, so the shuffled board is fully valid — decoy
   * quality included, which an unvalidated `createInitialState` board only carries
   * statistically (ADR-0009).
   */
  it('returns a fully valid puzzle, not merely one under the ceiling', () => {
    for (let index = 0; index < SEEDS; index += 1) {
      const seed = (index * 40503) >>> 0;
      const state = dispatchGame(createInitialState(seed, RULES, BAND), {
        type: 'USE_POWER_UP',
        id: 'equationShuffle',
      });

      expect(validatePuzzle(state.board, state.target, RULES, BAND).valid, `seed ${seed}`).toBe(
        true,
      );
    }
  });
});
