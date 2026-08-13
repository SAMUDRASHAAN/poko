import 'package:poko_game_engine/src/num.dart';

enum Operation { add, sub, mul, div, wild }

enum TileColour { coral, marine, kelp, sunfish, violet }

enum TileShape { roundedSquare, circle, hexagon, diamond, star }

enum BandId { sprout, adventurer, challenger, trailblazer, pathfinder }

enum ObstacleKind { ice, cage, weight, drifter }

enum PowerUpId {
  hintLens,
  numberLine,
  equationShuffle,
  calculatorBomb,
  doubler,
  operationChanger,
  wildNumber,
  comboRocket,
}

enum InvalidReason {
  negative,
  inexactDivision,
  exceedsMax,
  notTarget,
  tooShort,
  tooLong,
  notAdjacent,
  colourMismatch,
}

enum ObjectiveType {
  scoreTide,
  equationCount,
  operationFocus,
  timesTableTrial,
  iceMelt,
  rescue,
  collector,
  rapidTide,
  exactlyThree,
  lowTide,
  allWays,
  tideBoss,
}

enum Phase {
  loading,
  ready,
  dragging,
  previewing,
  committing,
  rejecting,
  resolving,
  refilling,
  targetRotating,
  paused,
  levelComplete,
  levelEnded,
}

final class Cell {
  const Cell({required this.row, required this.col});

  final int row;
  final int col;
}

final class Tile {
  const Tile({
    required this.id,
    required this.value,
    required this.colour,
    required this.operation,
    this.ownOperator,
    this.obstacle,
    this.powerUp,
  });

  final String id;
  final Num value;
  final TileColour colour;
  final Operation operation;
  final Operation? ownOperator;
  final ObstacleKind? obstacle;
  final PowerUpId? powerUp;
}

final class Board {
  const Board({
    required this.width,
    required this.height,
    required this.tiles,
    required this.seed,
  });

  final int width;
  final int height;
  final List<List<Tile?>> tiles;
  final int seed;
}

final class Chain {
  const Chain({required this.cells});

  final List<Cell> cells;
}

final class Equation {
  const Equation({
    required this.tiles,
    required this.operation,
    required this.result,
    required this.display,
    required this.isValid,
    this.invalidReason,
  });

  final List<Tile> tiles;
  final Operation operation;
  final Num result;
  final String display;
  final bool isValid;
  final InvalidReason? invalidReason;
}

final class IntRange {
  const IntRange(this.min, this.max);

  final int min;
  final int max;
}

final class BandConfig {
  const BandConfig({
    required this.id,
    required this.numberRange,
    required this.allowedOperations,
    required this.allowedColours,
    required this.minChain,
    required this.maxChain,
    required this.maxTarget,
    required this.allowNegatives,
    required this.allowDiagonals,
    required this.minSolutions,
    required this.maxSolutions,
  });

  final BandId id;
  final IntRange numberRange;
  final List<Operation> allowedOperations;
  final List<TileColour> allowedColours;
  final int minChain;
  final int maxChain;
  final int maxTarget;
  final bool allowNegatives;
  final bool allowDiagonals;
  final int minSolutions;
  final int maxSolutions;
}

final class ObstacleCount {
  const ObstacleCount({required this.kind, required this.count});

  final ObstacleKind kind;
  final int count;
}

final class LevelRules {
  const LevelRules({
    required this.objective,
    required this.goalValue,
    required this.obstacles,
    required this.allowedPowerUps,
    required this.targetSkills,
    this.moveLimit,
    this.timeLimitMs,
  });

  final ObjectiveType objective;
  final int goalValue;
  final int? moveLimit;
  final int? timeLimitMs;
  final List<ObstacleCount> obstacles;
  final List<PowerUpId> allowedPowerUps;
  final List<String> targetSkills;
}

sealed class GameAction {
  const GameAction();
}

final class BeginChain extends GameAction {
  const BeginChain(this.cell);

  final Cell cell;
}

final class ExtendChain extends GameAction {
  const ExtendChain(this.cell);

  final Cell cell;
}

final class RetractChain extends GameAction {
  const RetractChain();
}

final class CancelChain extends GameAction {
  const CancelChain();
}

final class Commit extends GameAction {
  const Commit();
}

final class Swap extends GameAction {
  const Swap({required this.a, required this.b});

  final Cell a;
  final Cell b;
}

final class RequestHint extends GameAction {
  const RequestHint();
}

final class UsePowerUp extends GameAction {
  const UsePowerUp({required this.id, this.cell});

  final PowerUpId id;
  final Cell? cell;
}

final class Tick extends GameAction {
  const Tick(this.deltaMs);

  final int deltaMs;
}

final class Pause extends GameAction {
  const Pause();
}

final class Resume extends GameAction {
  const Resume();
}

final class AdvancePhase extends GameAction {
  const AdvancePhase();
}

final class LevelState {
  const LevelState({
    required this.phase,
    required this.board,
    required this.target,
    required this.chain,
    required this.preview,
    required this.score,
    required this.combo,
    required this.movesUsed,
    required this.movesRemaining,
    required this.timeRemainingMs,
    required this.solvedCount,
    required this.attemptCount,
    required this.hintsUsed,
    required this.rules,
    required this.band,
    required this.rngState,
    required this.history,
  });

  final Phase phase;
  final Board board;
  final Num target;
  final Chain chain;
  final Equation? preview;
  final int score;
  final int combo;
  final int movesUsed;
  final int? movesRemaining;
  final int? timeRemainingMs;
  final int solvedCount;
  final int attemptCount;
  final int hintsUsed;
  final LevelRules rules;
  final BandConfig band;
  final int rngState;
  final List<GameAction> history;
}

final class Solution {
  const Solution({required this.cells, required this.result});

  final List<Cell> cells;
  final Num result;
}

final class Analysis {
  const Analysis({
    required this.solutions,
    required this.bestSolution,
    required this.hiddenSolutions,
    required this.setupMoves,
    required this.isStuck,
    required this.accidentals,
  });

  final List<Solution> solutions;
  final Solution? bestSolution;
  final int hiddenSolutions;
  final int setupMoves;
  final bool isStuck;
  final List<Solution> accidentals;
}

final class PuzzleValidation {
  const PuzzleValidation({
    required this.solutionCount,
    required this.accidentals,
  });

  bool get solvable => true;
  final int solutionCount;
  final int accidentals;
}

final class PuzzleSeed {
  const PuzzleSeed({
    required this.id,
    required this.seed,
    required this.band,
    required this.rules,
    required this.difficultyScore,
    required this.validation,
  });

  final String id;
  final int seed;
  final BandId band;
  final LevelRules rules;
  final int difficultyScore;
  final PuzzleValidation validation;
}

final class Mastery {
  const Mastery({
    required this.skillId,
    required this.mastery,
    required this.attempts,
    required this.correct,
    required this.avgTimeMs,
    required this.hintsUsed,
    required this.nextReviewInDays,
  });

  final String skillId;
  final double mastery;
  final int attempts;
  final int correct;
  final double avgTimeMs;
  final int hintsUsed;
  final int nextReviewInDays;
}

final class Attempt {
  const Attempt({
    required this.skillId,
    required this.correct,
    required this.timeMs,
    required this.hintUsed,
    required this.expectedTimeMs,
  });

  final String skillId;
  final bool correct;
  final int timeMs;
  final bool hintUsed;
  final int expectedTimeMs;
}
