/**
 * FROZEN CONTRACT — see docs/WORKTREE-PLAN.md section 4.
 *
 * Both agents code against this file. Changing it requires an ADR and a sync
 * point across every active worktree. Additions are cheap; changes are not.
 */
import type { Num } from './num.js';

export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'wild';
export type TileColour = 'coral' | 'marine' | 'kelp' | 'sunfish' | 'violet';
export type TileShape = 'roundedSquare' | 'circle' | 'hexagon' | 'diamond' | 'star';
export type BandId = 'sprout' | 'adventurer' | 'challenger' | 'trailblazer' | 'pathfinder';
export type ObstacleKind = 'ice' | 'cage' | 'weight' | 'drifter';
export type PowerUpId =
  | 'hintLens'
  | 'numberLine'
  | 'equationShuffle'
  | 'calculatorBomb'
  | 'doubler'
  | 'operationChanger'
  | 'wildNumber'
  | 'comboRocket';

export type Cell = { readonly row: number; readonly col: number };

export type Tile = {
  readonly id: string;
  readonly value: Num;
  readonly colour: TileColour;
  readonly operation: Operation;
  /** Violet tiles only: the operator this tile contributes to a mixed chain. */
  readonly ownOperator?: Operation;
  readonly obstacle?: ObstacleKind;
  readonly powerUp?: PowerUpId;
};

export type Board = {
  readonly width: number;
  readonly height: number;
  /** Row-major. `null` means an empty cell mid-refill. */
  readonly tiles: readonly (Tile | null)[][];
  readonly seed: number;
};

export type Chain = { readonly cells: readonly Cell[] };

export type InvalidReason =
  | 'negative'
  | 'inexactDivision'
  | 'exceedsMax'
  | 'notTarget'
  | 'tooShort'
  | 'tooLong'
  | 'notAdjacent'
  | 'colourMismatch';

export type Equation = {
  readonly tiles: readonly Tile[];
  readonly operation: Operation;
  readonly result: Num;
  /** Render-ready, e.g. "6 + 7 = 13". Display only. */
  readonly display: string;
  readonly isValid: boolean;
  readonly invalidReason?: InvalidReason;
};

export type ObjectiveType =
  | 'scoreTide'
  | 'equationCount'
  | 'operationFocus'
  | 'timesTableTrial'
  | 'iceMelt'
  | 'rescue'
  | 'collector'
  | 'rapidTide'
  | 'exactlyThree'
  | 'lowTide'
  | 'allWays'
  | 'tideBoss';

export type BandConfig = {
  readonly id: BandId;
  readonly numberRange: readonly [number, number];
  readonly allowedOperations: readonly Operation[];
  readonly allowedColours: readonly TileColour[];
  readonly minChain: number;
  readonly maxChain: number;
  readonly maxTarget: number;
  readonly allowNegatives: boolean;
  readonly allowDiagonals: boolean;
  readonly minSolutions: number;
  readonly maxSolutions: number;
};

export type LevelRules = {
  readonly objective: ObjectiveType;
  readonly goalValue: number;
  readonly moveLimit?: number;
  readonly timeLimitMs?: number;
  readonly obstacles: readonly { kind: ObstacleKind; count: number }[];
  readonly allowedPowerUps: readonly PowerUpId[];
  readonly targetSkills: readonly string[];
};

/** The strict phase machine. Input is accepted ONLY in ready | dragging | previewing. */
export type Phase =
  | 'loading'
  | 'ready'
  | 'dragging'
  | 'previewing'
  | 'committing'
  | 'rejecting'
  | 'resolving'
  | 'refilling'
  | 'targetRotating'
  | 'paused'
  | 'levelComplete'
  | 'levelEnded';

export type LevelState = {
  readonly phase: Phase;
  readonly board: Board;
  readonly target: Num;
  readonly chain: Chain;
  readonly preview: Equation | null;
  readonly score: number;
  readonly combo: number;
  readonly movesUsed: number;
  readonly movesRemaining: number | null;
  readonly timeRemainingMs: number | null;
  readonly solvedCount: number;
  readonly attemptCount: number;
  readonly hintsUsed: number;
  readonly rules: LevelRules;
  readonly band: BandConfig;
  readonly rngState: number;
  readonly history: readonly GameAction[];
};

export type GameAction =
  | { readonly type: 'BEGIN_CHAIN'; readonly cell: Cell }
  | { readonly type: 'EXTEND_CHAIN'; readonly cell: Cell }
  | { readonly type: 'RETRACT_CHAIN' }
  | { readonly type: 'CANCEL_CHAIN' }
  | { readonly type: 'COMMIT' }
  | { readonly type: 'SWAP'; readonly a: Cell; readonly b: Cell }
  | { readonly type: 'REQUEST_HINT' }
  | { readonly type: 'USE_POWER_UP'; readonly id: PowerUpId; readonly cell?: Cell }
  | { readonly type: 'TICK'; readonly deltaMs: number }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'ADVANCE_PHASE' };

export type Solution = { readonly cells: readonly Cell[]; readonly result: Num };

export type Analysis = {
  readonly solutions: readonly Solution[];
  readonly bestSolution: Solution | null;
  readonly hiddenSolutions: number;
  readonly setupMoves: number;
  readonly isStuck: boolean;
  readonly accidentals: readonly Solution[];
};

export type PuzzleSeed = {
  readonly id: string;
  readonly seed: number;
  readonly band: BandId;
  readonly rules: LevelRules;
  readonly difficultyScore: number;
  readonly validation: {
    readonly solvable: true;
    readonly solutionCount: number;
    readonly accidentals: number;
  };
};

export type Mastery = {
  readonly skillId: string;
  readonly mastery: number;
  readonly attempts: number;
  readonly correct: number;
  readonly avgTimeMs: number;
  readonly hintsUsed: number;
  readonly nextReviewInDays: number;
};

export type Attempt = {
  readonly skillId: string;
  readonly correct: boolean;
  readonly timeMs: number;
  readonly hintUsed: boolean;
  readonly expectedTimeMs: number;
};
