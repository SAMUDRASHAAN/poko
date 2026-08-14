import 'package:poko_game_engine/src/board.dart';
import 'package:poko_game_engine/src/equation.dart';
import 'package:poko_game_engine/src/generator.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/refill.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:poko_game_engine/src/types.dart';
import 'package:poko_game_engine/src/validator.dart';

const _inputPhases = <Phase>{Phase.ready, Phase.dragging, Phase.previewing};

List<GameAction> _appendHistory(LevelState state, GameAction action) =>
    <GameAction>[...state.history, action];

bool _objectiveComplete(LevelState state, int score, int solvedCount) =>
    state.rules.objective == ObjectiveType.scoreTide
    ? score >= state.rules.goalValue
    : solvedCount >= state.rules.goalValue;

LevelState _copyState(
  LevelState state, {
  Phase? phase,
  Board? board,
  Num? target,
  Chain? chain,
  ({Equation? value})? preview,
  int? score,
  int? combo,
  int? movesUsed,
  ({int? value})? movesRemaining,
  ({int? value})? timeRemainingMs,
  int? solvedCount,
  int? attemptCount,
  int? hintsUsed,
  LevelRules? rules,
  BandConfig? band,
  int? rngState,
  List<GameAction>? history,
}) => LevelState(
  phase: phase ?? state.phase,
  board: board ?? state.board,
  target: target ?? state.target,
  chain: chain ?? state.chain,
  preview: preview == null ? state.preview : preview.value,
  score: score ?? state.score,
  combo: combo ?? state.combo,
  movesUsed: movesUsed ?? state.movesUsed,
  movesRemaining: movesRemaining == null
      ? state.movesRemaining
      : movesRemaining.value,
  timeRemainingMs: timeRemainingMs == null
      ? state.timeRemainingMs
      : timeRemainingMs.value,
  solvedCount: solvedCount ?? state.solvedCount,
  attemptCount: attemptCount ?? state.attemptCount,
  hintsUsed: hintsUsed ?? state.hintsUsed,
  rules: rules ?? state.rules,
  band: band ?? state.band,
  rngState: rngState ?? state.rngState,
  history: history ?? state.history,
);

LevelState _resetChain(
  LevelState state,
  GameAction action, {
  int? attemptCount,
  int? combo,
}) => _copyState(
  state,
  phase: Phase.ready,
  chain: const Chain(cells: <Cell>[]),
  preview: (value: null),
  attemptCount: attemptCount,
  combo: combo,
  history: _appendHistory(state, action),
);

LevelState _beginChain(LevelState state, BeginChain action) {
  if (state.phase != Phase.ready || getTile(state.board, action.cell) == null) {
    return state;
  }
  return _copyState(
    state,
    phase: Phase.dragging,
    chain: Chain(cells: <Cell>[action.cell]),
    preview: (value: null),
    history: _appendHistory(state, action),
  );
}

LevelState _extendChain(LevelState state, ExtendChain action) {
  if (state.phase != Phase.dragging && state.phase != Phase.previewing) {
    return state;
  }
  final cells = state.chain.cells;
  final previous = cells.isEmpty ? null : cells.last;
  final firstTile = cells.isEmpty ? null : getTile(state.board, cells.first);
  final nextTile = getTile(state.board, action.cell);
  if (previous == null ||
      firstTile == null ||
      nextTile == null ||
      nextTile.colour != firstTile.colour ||
      cells.any(
        (cell) => cell.row == action.cell.row && cell.col == action.cell.col,
      ) ||
      !areAdjacent(
        previous,
        action.cell,
        allowDiagonals: state.band.allowDiagonals,
      ) ||
      cells.length >= state.band.maxChain) {
    return state;
  }
  final nextCells = <Cell>[...cells, action.cell];
  final preview = nextCells.length >= state.band.minChain
      ? evaluateChain(state.board, nextCells, state.band)
      : null;
  return _copyState(
    state,
    phase: preview == null ? Phase.dragging : Phase.previewing,
    chain: Chain(cells: nextCells),
    preview: (value: preview),
    history: _appendHistory(state, action),
  );
}

LevelState _retractChain(LevelState state, RetractChain action) {
  if ((state.phase != Phase.dragging && state.phase != Phase.previewing) ||
      state.chain.cells.length <= 1) {
    return state;
  }
  final cells = state.chain.cells.sublist(0, state.chain.cells.length - 1);
  final preview = cells.length >= state.band.minChain
      ? evaluateChain(state.board, cells, state.band)
      : null;
  return _copyState(
    state,
    phase: preview == null ? Phase.dragging : Phase.previewing,
    chain: Chain(cells: cells),
    preview: (value: preview),
    history: _appendHistory(state, action),
  );
}

LevelState _commit(LevelState state, Commit action) {
  if (state.phase == Phase.dragging) {
    return _resetChain(
      state,
      action,
      attemptCount: state.attemptCount + 1,
      combo: 0,
    );
  }
  final preview = state.preview;
  if (state.phase != Phase.previewing || preview == null) {
    return state;
  }
  final attemptCount = state.attemptCount + 1;
  if (!preview.isValid || preview.result != state.target) {
    return _resetChain(state, action, attemptCount: attemptCount, combo: 0);
  }

  final refilled = refillAfterRemoval(
    state.board,
    state.chain.cells,
    state.band,
    state.rules,
    state.rngState,
  );
  final combo = state.combo + 1;
  final score = state.score + state.chain.cells.length * 10 * combo;
  final solvedCount = state.solvedCount + 1;
  final movesUsed = state.movesUsed + 1;
  final movesRemaining = state.movesRemaining == null
      ? null
      : _max(0, state.movesRemaining! - 1);
  final phase = _objectiveComplete(state, score, solvedCount)
      ? Phase.levelComplete
      : movesRemaining == 0
      ? Phase.levelEnded
      : Phase.ready;
  return _copyState(
    state,
    phase: phase,
    board: refilled.board,
    target: refilled.target,
    chain: const Chain(cells: <Cell>[]),
    preview: (value: null),
    score: score,
    combo: combo,
    movesUsed: movesUsed,
    movesRemaining: (value: movesRemaining),
    solvedCount: solvedCount,
    attemptCount: attemptCount,
    rngState: refilled.rngState,
    history: _appendHistory(state, action),
  );
}

LevelState _swap(LevelState state, Swap action) {
  if (state.phase != Phase.ready ||
      getTile(state.board, action.a) == null ||
      getTile(state.board, action.b) == null ||
      !areAdjacent(
        action.a,
        action.b,
        allowDiagonals: state.band.allowDiagonals,
      )) {
    return state;
  }
  final board = swapTiles(state.board, action.a, action.b);
  if (analyseWithBand(board, state.target, state.rules, state.band).isStuck) {
    return state;
  }
  final movesRemaining = state.movesRemaining == null
      ? null
      : _max(0, state.movesRemaining! - 1);
  return _copyState(
    state,
    phase: movesRemaining == 0 ? Phase.levelEnded : Phase.ready,
    board: board,
    movesUsed: state.movesUsed + 1,
    movesRemaining: (value: movesRemaining),
    history: _appendHistory(state, action),
  );
}

const int _shuffleAttempts = 512;

LevelState _shuffledLevel(LevelState state) {
  var candidate = createInitialState(state.rngState, state.rules, state.band);
  for (var attempt = 1; attempt < _shuffleAttempts; attempt += 1) {
    if (validatePuzzle(
      candidate.board,
      candidate.target,
      state.rules,
      state.band,
    ).valid) {
      break;
    }
    candidate = createInitialState(candidate.rngState, state.rules, state.band);
  }
  return candidate;
}

LevelState _usePowerUp(LevelState state, UsePowerUp action) {
  if (state.phase != Phase.ready ||
      !state.rules.allowedPowerUps.contains(action.id)) {
    return state;
  }
  if (action.id == PowerUpId.hintLens || action.id == PowerUpId.numberLine) {
    return _copyState(
      state,
      hintsUsed: state.hintsUsed + 1,
      history: _appendHistory(state, action),
    );
  }
  if (action.id == PowerUpId.equationShuffle) {
    final fresh = _shuffledLevel(state);
    return _copyState(
      state,
      board: fresh.board,
      target: fresh.target,
      rngState: fresh.rngState,
      history: _appendHistory(state, action),
    );
  }
  return _copyState(state, history: _appendHistory(state, action));
}

LevelState dispatchGame(LevelState state, GameAction action) =>
    switch (action) {
      BeginChain() => _beginChain(state, action),
      ExtendChain() => _extendChain(state, action),
      RetractChain() => _retractChain(state, action),
      CancelChain() =>
        state.phase == Phase.dragging || state.phase == Phase.previewing
            ? _resetChain(state, action)
            : state,
      Commit() => _commit(state, action),
      Swap() => _swap(state, action),
      RequestHint() =>
        state.phase == Phase.ready
            ? _copyState(
                state,
                hintsUsed: state.hintsUsed + 1,
                history: _appendHistory(state, action),
              )
            : state,
      UsePowerUp() => _usePowerUp(state, action),
      Tick(:final deltaMs) =>
        !_inputPhases.contains(state.phase) ||
                state.timeRemainingMs == null ||
                deltaMs <= 0
            ? state
            : _tick(state, action),
      Pause() =>
        _inputPhases.contains(state.phase)
            ? _copyState(
                state,
                phase: Phase.paused,
                history: _appendHistory(state, action),
              )
            : state,
      Resume() =>
        state.phase == Phase.paused
            ? _copyState(
                state,
                phase: state.preview != null
                    ? Phase.previewing
                    : state.chain.cells.isNotEmpty
                    ? Phase.dragging
                    : Phase.ready,
                history: _appendHistory(state, action),
              )
            : state,
      AdvancePhase() => state,
    };

LevelState _tick(LevelState state, Tick action) {
  final timeRemainingMs = _max(0, state.timeRemainingMs! - action.deltaMs);
  return _copyState(
    state,
    phase: timeRemainingMs == 0 ? Phase.levelEnded : state.phase,
    timeRemainingMs: (value: timeRemainingMs),
    history: _appendHistory(state, action),
  );
}

int _max(int left, int right) => left > right ? left : right;
