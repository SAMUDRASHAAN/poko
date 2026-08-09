import { areAdjacent, getTile, swapTiles } from './board.js';
import { evaluateChain } from './equation.js';
import { createInitialState } from './generator.js';
import { eq } from './num.js';
import { refillAfterRemoval } from './refill.js';
import { analyseWithBand } from './solver.js';
import type { GameAction, LevelState, Phase } from './types.js';
import { validatePuzzle } from './validator.js';

const INPUT_PHASES: readonly Phase[] = ['ready', 'dragging', 'previewing'];

function appendHistory(state: LevelState, action: GameAction): readonly GameAction[] {
  return [...state.history, action];
}

function objectiveComplete(state: LevelState, score: number, solvedCount: number): boolean {
  return state.rules.objective === 'scoreTide'
    ? score >= state.rules.goalValue
    : solvedCount >= state.rules.goalValue;
}

function resetChain(
  state: LevelState,
  action: GameAction,
  extra: Partial<LevelState> = {},
): LevelState {
  return {
    ...state,
    ...extra,
    phase: 'ready',
    chain: { cells: [] },
    preview: null,
    history: appendHistory(state, action),
  };
}

function beginChain(
  state: LevelState,
  action: Extract<GameAction, { type: 'BEGIN_CHAIN' }>,
): LevelState {
  if (state.phase !== 'ready' || !getTile(state.board, action.cell)) return state;
  return {
    ...state,
    phase: 'dragging',
    chain: { cells: [action.cell] },
    preview: null,
    history: appendHistory(state, action),
  };
}

function extendChain(
  state: LevelState,
  action: Extract<GameAction, { type: 'EXTEND_CHAIN' }>,
): LevelState {
  if (state.phase !== 'dragging' && state.phase !== 'previewing') return state;
  const cells = state.chain.cells;
  const previous = cells[cells.length - 1];
  const firstTile = cells[0] ? getTile(state.board, cells[0]) : null;
  const nextTile = getTile(state.board, action.cell);
  if (
    !previous ||
    !firstTile ||
    !nextTile ||
    nextTile.colour !== firstTile.colour ||
    cells.some((cell) => cell.row === action.cell.row && cell.col === action.cell.col) ||
    !areAdjacent(previous, action.cell, state.band.allowDiagonals) ||
    cells.length >= state.band.maxChain
  ) {
    return state;
  }
  const nextCells = [...cells, action.cell];
  const preview =
    nextCells.length >= state.band.minChain
      ? evaluateChain(state.board, nextCells, state.band)
      : null;
  return {
    ...state,
    phase: preview ? 'previewing' : 'dragging',
    chain: { cells: nextCells },
    preview,
    history: appendHistory(state, action),
  };
}

function retractChain(
  state: LevelState,
  action: Extract<GameAction, { type: 'RETRACT_CHAIN' }>,
): LevelState {
  if (
    (state.phase !== 'dragging' && state.phase !== 'previewing') ||
    state.chain.cells.length <= 1
  ) {
    return state;
  }
  const cells = state.chain.cells.slice(0, -1);
  const preview =
    cells.length >= state.band.minChain ? evaluateChain(state.board, cells, state.band) : null;
  return {
    ...state,
    phase: preview ? 'previewing' : 'dragging',
    chain: { cells },
    preview,
    history: appendHistory(state, action),
  };
}

function commit(state: LevelState, action: Extract<GameAction, { type: 'COMMIT' }>): LevelState {
  if (state.phase === 'dragging') {
    return resetChain(state, action, { attemptCount: state.attemptCount + 1, combo: 0 });
  }
  if (state.phase !== 'previewing' || !state.preview) return state;
  const attemptCount = state.attemptCount + 1;
  if (!state.preview.isValid || !eq(state.preview.result, state.target)) {
    return resetChain(state, action, { attemptCount, combo: 0 });
  }

  const refilled = refillAfterRemoval(
    state.board,
    state.chain.cells,
    state.band,
    state.rules,
    state.rngState,
  );
  const combo = state.combo + 1;
  const score = state.score + state.chain.cells.length * 10 * combo;
  const solvedCount = state.solvedCount + 1;
  const movesUsed = state.movesUsed + 1;
  const movesRemaining =
    state.movesRemaining === null ? null : Math.max(0, state.movesRemaining - 1);
  const phase: Phase = objectiveComplete(state, score, solvedCount)
    ? 'levelComplete'
    : movesRemaining === 0
      ? 'levelEnded'
      : 'ready';
  return {
    ...state,
    phase,
    board: refilled.board,
    target: refilled.target,
    chain: { cells: [] },
    preview: null,
    score,
    combo,
    movesUsed,
    movesRemaining,
    solvedCount,
    attemptCount,
    rngState: refilled.rngState,
    history: appendHistory(state, action),
  };
}

function swap(state: LevelState, action: Extract<GameAction, { type: 'SWAP' }>): LevelState {
  if (
    state.phase !== 'ready' ||
    !getTile(state.board, action.a) ||
    !getTile(state.board, action.b) ||
    !areAdjacent(action.a, action.b, state.band.allowDiagonals)
  )
    return state;
  const board = swapTiles(state.board, action.a, action.b);
  if (analyseWithBand(board, state.target, state.rules, state.band).isStuck) return state;
  const movesRemaining =
    state.movesRemaining === null ? null : Math.max(0, state.movesRemaining - 1);
  return {
    ...state,
    phase: movesRemaining === 0 ? 'levelEnded' : 'ready',
    board,
    movesUsed: state.movesUsed + 1,
    movesRemaining,
    history: appendHistory(state, action),
  };
}

/**
 * How many boards `equationShuffle` may draw before it settles for what it has.
 *
 * Same budget `generatePackInternal` uses, for the same reason: generous enough
 * that exhausting it means something is wrong with the band, not with luck.
 * Measured over 400 trials per band, the worst seed needed 203 draws (sprout) and
 * nothing came close to the cap.
 */
const SHUFFLE_ATTEMPTS = 512;

/**
 * A replacement board that respects the band, not just the first one generated.
 *
 * `createInitialState` guarantees a board is SOLVABLE — it plants a solution pair —
 * but it does not enforce `band.maxSolutions`. That ceiling is a difficulty
 * control, and unenforced it runs far over: on sprout only 3.3% of generated
 * boards sit at or under the ceiling of 4, against a median of 14. Handing one of
 * those to a child mid-level makes the puzzle markedly easier than its band
 * intends, which is the whole thing the band is for.
 *
 * Levels reached any other way are already validated — `generatePackInternal`
 * retries until `validatePuzzle` passes — so this power-up was the one live path
 * that skipped the check. Rather than enforce the ceiling inside
 * `createInitialState` (which cannot be done at acceptable cost, and would change
 * rng consumption order and so regenerate every existing level — see ADR-0009),
 * the check lives here, at the call site, exactly as the pack generator does it.
 *
 * Deterministic in `state`, so `dispatch` stays a pure reducer [INV-5]: each
 * rejected board hands its `rngState` to the next draw.
 *
 * Fails OPEN. If the budget runs out this returns the last candidate rather than
 * throwing — a reducer must always return a state, and that board is still
 * solvable by construction. A board that is too easy is a worse level; a thrown
 * exception mid-level is a broken game.
 */
function shuffledLevel(state: LevelState): LevelState {
  let candidate = createInitialState(state.rngState, state.rules, state.band);

  for (let attempt = 1; attempt < SHUFFLE_ATTEMPTS; attempt += 1) {
    if (validatePuzzle(candidate.board, candidate.target, state.rules, state.band).valid) break;
    candidate = createInitialState(candidate.rngState, state.rules, state.band);
  }

  return candidate;
}

function usePowerUp(
  state: LevelState,
  action: Extract<GameAction, { type: 'USE_POWER_UP' }>,
): LevelState {
  if (state.phase !== 'ready' || !state.rules.allowedPowerUps.includes(action.id)) return state;
  if (action.id === 'hintLens' || action.id === 'numberLine') {
    return { ...state, hintsUsed: state.hintsUsed + 1, history: appendHistory(state, action) };
  }
  if (action.id === 'equationShuffle') {
    const fresh = shuffledLevel(state);
    return {
      ...state,
      board: fresh.board,
      target: fresh.target,
      rngState: fresh.rngState,
      history: appendHistory(state, action),
    };
  }
  return { ...state, history: appendHistory(state, action) };
}

export function dispatchGame(state: LevelState, action: GameAction): LevelState {
  switch (action.type) {
    case 'BEGIN_CHAIN':
      return beginChain(state, action);
    case 'EXTEND_CHAIN':
      return extendChain(state, action);
    case 'RETRACT_CHAIN':
      return retractChain(state, action);
    case 'CANCEL_CHAIN':
      return state.phase === 'dragging' || state.phase === 'previewing'
        ? resetChain(state, action)
        : state;
    case 'COMMIT':
      return commit(state, action);
    case 'SWAP':
      return swap(state, action);
    case 'REQUEST_HINT':
      return state.phase === 'ready'
        ? { ...state, hintsUsed: state.hintsUsed + 1, history: appendHistory(state, action) }
        : state;
    case 'USE_POWER_UP':
      return usePowerUp(state, action);
    case 'TICK': {
      if (
        !INPUT_PHASES.includes(state.phase) ||
        state.timeRemainingMs === null ||
        action.deltaMs <= 0
      ) {
        return state;
      }
      const timeRemainingMs = Math.max(0, state.timeRemainingMs - action.deltaMs);
      return {
        ...state,
        timeRemainingMs,
        phase: timeRemainingMs === 0 ? 'levelEnded' : state.phase,
        history: appendHistory(state, action),
      };
    }
    case 'PAUSE':
      return INPUT_PHASES.includes(state.phase)
        ? { ...state, phase: 'paused', history: appendHistory(state, action) }
        : state;
    case 'RESUME':
      return state.phase === 'paused'
        ? {
            ...state,
            phase: state.preview
              ? 'previewing'
              : state.chain.cells.length > 0
                ? 'dragging'
                : 'ready',
            history: appendHistory(state, action),
          }
        : state;
    case 'ADVANCE_PHASE':
      return state;
  }
}
