import 'package:poko_game_engine/src/json_codec.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/types.dart';

String serialiseState(LevelState state) => encodeJson(_stateToJson(state));

LevelState restoreState(String blob) {
  final decoded = decodeJson(blob);
  try {
    return _stateFromJson(_map(decoded));
  } on FormatException {
    rethrow;
  } on Object {
    throw TypeError();
  }
}

Map<String, Object?> _stateToJson(LevelState state) => <String, Object?>{
  'phase': state.phase.name,
  'board': _boardToJson(state.board),
  'target': _numToJson(state.target),
  'chain': _chainToJson(state.chain),
  'preview': state.preview == null ? null : _equationToJson(state.preview!),
  'score': state.score,
  'combo': state.combo,
  'movesUsed': state.movesUsed,
  'movesRemaining': state.movesRemaining,
  'timeRemainingMs': state.timeRemainingMs,
  'solvedCount': state.solvedCount,
  'attemptCount': state.attemptCount,
  'hintsUsed': state.hintsUsed,
  'rules': _rulesToJson(state.rules),
  'band': _bandToJson(state.band),
  'rngState': state.rngState,
  'history': state.history.map(_actionToJson).toList(),
};

Map<String, Object?> _numToJson(Num value) => <String, Object?>{
  'n': value.numerator,
  'd': value.denominator,
};

Map<String, Object?> _cellToJson(Cell cell) => <String, Object?>{
  'row': cell.row,
  'col': cell.col,
};

Map<String, Object?> _tileToJson(Tile tile) => <String, Object?>{
  'id': tile.id,
  'value': _numToJson(tile.value),
  'colour': tile.colour.name,
  'operation': tile.operation.name,
  if (tile.ownOperator != null) 'ownOperator': tile.ownOperator!.name,
  if (tile.obstacle != null) 'obstacle': tile.obstacle!.name,
  if (tile.powerUp != null) 'powerUp': tile.powerUp!.name,
};

Map<String, Object?> _boardToJson(Board board) => <String, Object?>{
  'width': board.width,
  'height': board.height,
  'tiles': board.tiles
      .map(
        (row) =>
            row.map((tile) => tile == null ? null : _tileToJson(tile)).toList(),
      )
      .toList(),
  'seed': board.seed,
};

Map<String, Object?> _chainToJson(Chain chain) => <String, Object?>{
  'cells': chain.cells.map(_cellToJson).toList(),
};

Map<String, Object?> _equationToJson(Equation equation) => <String, Object?>{
  'tiles': equation.tiles.map(_tileToJson).toList(),
  'operation': equation.operation.name,
  'result': _numToJson(equation.result),
  'display': equation.display,
  'isValid': equation.isValid,
  if (equation.invalidReason != null)
    'invalidReason': equation.invalidReason!.name,
};

Map<String, Object?> _rulesToJson(LevelRules rules) => <String, Object?>{
  'objective': rules.objective.name,
  'goalValue': rules.goalValue,
  if (rules.moveLimit != null) 'moveLimit': rules.moveLimit,
  if (rules.timeLimitMs != null) 'timeLimitMs': rules.timeLimitMs,
  'obstacles': rules.obstacles
      .map(
        (obstacle) => <String, Object?>{
          'kind': obstacle.kind.name,
          'count': obstacle.count,
        },
      )
      .toList(),
  'allowedPowerUps': rules.allowedPowerUps.map((value) => value.name).toList(),
  'targetSkills': List<String>.of(rules.targetSkills),
};

Map<String, Object?> _bandToJson(BandConfig band) => <String, Object?>{
  'id': band.id.name,
  'numberRange': <Object?>[band.numberRange.min, band.numberRange.max],
  'allowedOperations': band.allowedOperations
      .map((value) => value.name)
      .toList(),
  'allowedColours': band.allowedColours.map((value) => value.name).toList(),
  'minChain': band.minChain,
  'maxChain': band.maxChain,
  'maxTarget': band.maxTarget,
  'allowNegatives': band.allowNegatives,
  'allowDiagonals': band.allowDiagonals,
  'minSolutions': band.minSolutions,
  'maxSolutions': band.maxSolutions,
};

Map<String, Object?> _actionToJson(GameAction action) => switch (action) {
  BeginChain(:final cell) => <String, Object?>{
    'type': 'BEGIN_CHAIN',
    'cell': _cellToJson(cell),
  },
  ExtendChain(:final cell) => <String, Object?>{
    'type': 'EXTEND_CHAIN',
    'cell': _cellToJson(cell),
  },
  RetractChain() => <String, Object?>{'type': 'RETRACT_CHAIN'},
  CancelChain() => <String, Object?>{'type': 'CANCEL_CHAIN'},
  Commit() => <String, Object?>{'type': 'COMMIT'},
  Swap(:final a, :final b) => <String, Object?>{
    'type': 'SWAP',
    'a': _cellToJson(a),
    'b': _cellToJson(b),
  },
  RequestHint() => <String, Object?>{'type': 'REQUEST_HINT'},
  UsePowerUp(:final id, :final cell) => <String, Object?>{
    'type': 'USE_POWER_UP',
    'id': id.name,
    if (cell != null) 'cell': _cellToJson(cell),
  },
  Tick(:final deltaMs) => <String, Object?>{'type': 'TICK', 'deltaMs': deltaMs},
  Pause() => <String, Object?>{'type': 'PAUSE'},
  Resume() => <String, Object?>{'type': 'RESUME'},
  AdvancePhase() => <String, Object?>{'type': 'ADVANCE_PHASE'},
};

LevelState _stateFromJson(Map<String, Object?> json) => LevelState(
  phase: Phase.values.byName(_string(json['phase'])),
  board: _boardFromJson(_map(json['board'])),
  target: _numFromJson(_map(json['target'])),
  chain: _chainFromJson(_map(json['chain'])),
  preview: json['preview'] == null
      ? null
      : _equationFromJson(_map(json['preview'])),
  score: _int(json['score']),
  combo: _int(json['combo']),
  movesUsed: _int(json['movesUsed']),
  movesRemaining: _nullableInt(json['movesRemaining']),
  timeRemainingMs: _nullableInt(json['timeRemainingMs']),
  solvedCount: _int(json['solvedCount']),
  attemptCount: _int(json['attemptCount']),
  hintsUsed: _int(json['hintsUsed']),
  rules: _rulesFromJson(_map(json['rules'])),
  band: _bandFromJson(_map(json['band'])),
  rngState: _int(json['rngState']),
  history: _list(
    json['history'],
  ).map((value) => _actionFromJson(_map(value))).toList(),
);

Num _numFromJson(Map<String, Object?> json) =>
    Num(_int(json['n']), _int(json['d']));

Cell _cellFromJson(Map<String, Object?> json) =>
    Cell(row: _int(json['row']), col: _int(json['col']));

Tile _tileFromJson(Map<String, Object?> json) => Tile(
  id: _string(json['id']),
  value: _numFromJson(_map(json['value'])),
  colour: TileColour.values.byName(_string(json['colour'])),
  operation: Operation.values.byName(_string(json['operation'])),
  ownOperator: json['ownOperator'] == null
      ? null
      : Operation.values.byName(_string(json['ownOperator'])),
  obstacle: json['obstacle'] == null
      ? null
      : ObstacleKind.values.byName(_string(json['obstacle'])),
  powerUp: json['powerUp'] == null
      ? null
      : PowerUpId.values.byName(_string(json['powerUp'])),
);

Board _boardFromJson(Map<String, Object?> json) => Board(
  width: _int(json['width']),
  height: _int(json['height']),
  tiles: _list(json['tiles'])
      .map(
        (row) => _list(row)
            .map((tile) => tile == null ? null : _tileFromJson(_map(tile)))
            .toList(),
      )
      .toList(),
  seed: _int(json['seed']),
);

Chain _chainFromJson(Map<String, Object?> json) => Chain(
  cells: _list(json['cells']).map((cell) => _cellFromJson(_map(cell))).toList(),
);

Equation _equationFromJson(Map<String, Object?> json) => Equation(
  tiles: _list(json['tiles']).map((tile) => _tileFromJson(_map(tile))).toList(),
  operation: Operation.values.byName(_string(json['operation'])),
  result: _numFromJson(_map(json['result'])),
  display: _string(json['display']),
  isValid: _bool(json['isValid']),
  invalidReason: json['invalidReason'] == null
      ? null
      : InvalidReason.values.byName(_string(json['invalidReason'])),
);

LevelRules _rulesFromJson(Map<String, Object?> json) => LevelRules(
  objective: ObjectiveType.values.byName(_string(json['objective'])),
  goalValue: _int(json['goalValue']),
  moveLimit: json.containsKey('moveLimit')
      ? _nullableInt(json['moveLimit'])
      : null,
  timeLimitMs: json.containsKey('timeLimitMs')
      ? _nullableInt(json['timeLimitMs'])
      : null,
  obstacles: _list(json['obstacles']).map((value) {
    final obstacle = _map(value);
    return ObstacleCount(
      kind: ObstacleKind.values.byName(_string(obstacle['kind'])),
      count: _int(obstacle['count']),
    );
  }).toList(),
  allowedPowerUps: _list(
    json['allowedPowerUps'],
  ).map((value) => PowerUpId.values.byName(_string(value))).toList(),
  targetSkills: _list(json['targetSkills']).map(_string).toList(),
);

BandConfig _bandFromJson(Map<String, Object?> json) {
  final range = _list(json['numberRange']);
  return BandConfig(
    id: BandId.values.byName(_string(json['id'])),
    numberRange: IntRange(_int(range[0]), _int(range[1])),
    allowedOperations: _list(
      json['allowedOperations'],
    ).map((value) => Operation.values.byName(_string(value))).toList(),
    allowedColours: _list(
      json['allowedColours'],
    ).map((value) => TileColour.values.byName(_string(value))).toList(),
    minChain: _int(json['minChain']),
    maxChain: _int(json['maxChain']),
    maxTarget: _int(json['maxTarget']),
    allowNegatives: _bool(json['allowNegatives']),
    allowDiagonals: _bool(json['allowDiagonals']),
    minSolutions: _int(json['minSolutions']),
    maxSolutions: _int(json['maxSolutions']),
  );
}

GameAction _actionFromJson(Map<String, Object?> json) =>
    switch (_string(json['type'])) {
      'BEGIN_CHAIN' => BeginChain(_cellFromJson(_map(json['cell']))),
      'EXTEND_CHAIN' => ExtendChain(_cellFromJson(_map(json['cell']))),
      'RETRACT_CHAIN' => const RetractChain(),
      'CANCEL_CHAIN' => const CancelChain(),
      'COMMIT' => const Commit(),
      'SWAP' => Swap(
        a: _cellFromJson(_map(json['a'])),
        b: _cellFromJson(_map(json['b'])),
      ),
      'REQUEST_HINT' => const RequestHint(),
      'USE_POWER_UP' => UsePowerUp(
        id: PowerUpId.values.byName(_string(json['id'])),
        cell: json['cell'] == null ? null : _cellFromJson(_map(json['cell'])),
      ),
      'TICK' => Tick(_int(json['deltaMs'])),
      'PAUSE' => const Pause(),
      'RESUME' => const Resume(),
      'ADVANCE_PHASE' => const AdvancePhase(),
      _ => throw TypeError(),
    };

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) {
    return value;
  }
  throw TypeError();
}

List<Object?> _list(Object? value) {
  if (value is List<Object?>) {
    return value;
  }
  throw TypeError();
}

String _string(Object? value) {
  if (value is String) {
    return value;
  }
  throw TypeError();
}

int _int(Object? value) {
  if (value is int) {
    return value;
  }
  throw TypeError();
}

int? _nullableInt(Object? value) {
  if (value == null || value is int) {
    return value as int?;
  }
  throw TypeError();
}

bool _bool(Object? value) {
  if (value is bool) {
    return value;
  }
  throw TypeError();
}
