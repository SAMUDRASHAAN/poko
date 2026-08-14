import 'dart:convert';
import 'dart:io';

import 'package:poko_game_engine/poko_game_engine.dart';

Future<void> main() async {
  final request = _map(jsonDecode(await stdin.transform(utf8.decoder).join()));
  final cases = _list(request['cases']);
  final results = <Map<String, Object?>>[];
  for (final value in cases) {
    final fixture = _map(value);
    results.add(<String, Object?>{
      'id': _string(fixture['id']),
      'actual': _execute(_string(fixture['operation']), _map(fixture['input'])),
    });
  }
  stdout.write(jsonEncode(<String, Object?>{'results': results}));
}

Object? _execute(String operation, Map<String, Object?> input) =>
    switch (operation) {
      'createLevel' => _stateToJson(
        createLevel(
          _integer(input['seed']),
          _rules(input['rules']),
          _band(input['band']),
        ),
      ),
      'dispatch' => _dispatchTrace(input),
      'serialise' => serialise(_state(input['state'])),
      'restore' => _stateToJson(restore(_string(input['blob']))),
      'analyse' => _analysisToJson(
        analyse(
          _board(input['board']),
          _number(input['target']),
          _rules(input['rules']),
        ),
      ),
      'generatePack' => generatePack(
        BandId.values.byName(_string(input['bandId'])),
        _integer(input['count']),
        _integer(input['seed']),
      ).map(_puzzleToJson).toList(),
      'updateMastery' => _masteryToJson(
        updateMastery(_mastery(input['previous']), _attempt(input['attempt'])),
      ),
      _ => throw FormatException('unknown parity operation: $operation'),
    };

List<Object?> _dispatchTrace(Map<String, Object?> input) {
  var state = _state(input['state']);
  final states = <Object?>[];
  for (final action in _list(input['actions'])) {
    state = dispatch(state, _action(action));
    states.add(_stateToJson(state));
  }
  return states;
}

LevelState _state(Object? value) => restore(jsonEncode(value));
Object? _stateToJson(LevelState value) => jsonDecode(serialise(value));

Num _number(Object? value) {
  final json = _map(value);
  return Num(_integer(json['n']), _integer(json['d']));
}

Cell _cell(Object? value) {
  final json = _map(value);
  return Cell(row: _integer(json['row']), col: _integer(json['col']));
}

Tile _tile(Object? value) {
  final json = _map(value);
  return Tile(
    id: _string(json['id']),
    value: _number(json['value']),
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
}

Board _board(Object? value) {
  final json = _map(value);
  return Board(
    width: _integer(json['width']),
    height: _integer(json['height']),
    tiles: _list(json['tiles'])
        .map(
          (row) => _list(
            row,
          ).map((tile) => tile == null ? null : _tile(tile)).toList(),
        )
        .toList(),
    seed: _integer(json['seed']),
  );
}

BandConfig _band(Object? value) {
  final json = _map(value);
  final range = _list(json['numberRange']);
  return BandConfig(
    id: BandId.values.byName(_string(json['id'])),
    numberRange: IntRange(_integer(range[0]), _integer(range[1])),
    allowedOperations: _list(
      json['allowedOperations'],
    ).map((entry) => Operation.values.byName(_string(entry))).toList(),
    allowedColours: _list(
      json['allowedColours'],
    ).map((entry) => TileColour.values.byName(_string(entry))).toList(),
    minChain: _integer(json['minChain']),
    maxChain: _integer(json['maxChain']),
    maxTarget: _integer(json['maxTarget']),
    allowNegatives: _boolean(json['allowNegatives']),
    allowDiagonals: _boolean(json['allowDiagonals']),
    minSolutions: _integer(json['minSolutions']),
    maxSolutions: _integer(json['maxSolutions']),
  );
}

LevelRules _rules(Object? value) {
  final json = _map(value);
  return LevelRules(
    objective: ObjectiveType.values.byName(_string(json['objective'])),
    goalValue: _integer(json['goalValue']),
    moveLimit: json['moveLimit'] == null ? null : _integer(json['moveLimit']),
    timeLimitMs: json['timeLimitMs'] == null
        ? null
        : _integer(json['timeLimitMs']),
    obstacles: _list(json['obstacles']).map((entry) {
      final obstacle = _map(entry);
      return ObstacleCount(
        kind: ObstacleKind.values.byName(_string(obstacle['kind'])),
        count: _integer(obstacle['count']),
      );
    }).toList(),
    allowedPowerUps: _list(
      json['allowedPowerUps'],
    ).map((entry) => PowerUpId.values.byName(_string(entry))).toList(),
    targetSkills: _list(json['targetSkills']).map(_string).toList(),
  );
}

GameAction _action(Object? value) {
  final json = _map(value);
  return switch (_string(json['type'])) {
    'BEGIN_CHAIN' => BeginChain(_cell(json['cell'])),
    'EXTEND_CHAIN' => ExtendChain(_cell(json['cell'])),
    'RETRACT_CHAIN' => const RetractChain(),
    'CANCEL_CHAIN' => const CancelChain(),
    'COMMIT' => const Commit(),
    'SWAP' => Swap(a: _cell(json['a']), b: _cell(json['b'])),
    'REQUEST_HINT' => const RequestHint(),
    'USE_POWER_UP' => UsePowerUp(
      id: PowerUpId.values.byName(_string(json['id'])),
      cell: json['cell'] == null ? null : _cell(json['cell']),
    ),
    'TICK' => Tick(_integer(json['deltaMs'])),
    'PAUSE' => const Pause(),
    'RESUME' => const Resume(),
    'ADVANCE_PHASE' => const AdvancePhase(),
    final type => throw FormatException('unknown action: $type'),
  };
}

Map<String, Object?> _analysisToJson(Analysis value) => <String, Object?>{
  'solutions': value.solutions.map(_solutionToJson).toList(),
  'bestSolution': value.bestSolution == null
      ? null
      : _solutionToJson(value.bestSolution!),
  'hiddenSolutions': value.hiddenSolutions,
  'setupMoves': value.setupMoves,
  'isStuck': value.isStuck,
  'accidentals': value.accidentals.map(_solutionToJson).toList(),
};

Map<String, Object?> _solutionToJson(Solution value) => <String, Object?>{
  'cells': value.cells
      .map((cell) => <String, Object?>{'row': cell.row, 'col': cell.col})
      .toList(),
  'result': <String, Object?>{
    'n': value.result.numerator,
    'd': value.result.denominator,
  },
};

Map<String, Object?> _puzzleToJson(PuzzleSeed value) => <String, Object?>{
  'id': value.id,
  'seed': value.seed,
  'band': value.band.name,
  'rules': <String, Object?>{
    'objective': value.rules.objective.name,
    'goalValue': value.rules.goalValue,
    if (value.rules.moveLimit != null) 'moveLimit': value.rules.moveLimit,
    if (value.rules.timeLimitMs != null) 'timeLimitMs': value.rules.timeLimitMs,
    'obstacles': value.rules.obstacles
        .map(
          (entry) => <String, Object?>{
            'kind': entry.kind.name,
            'count': entry.count,
          },
        )
        .toList(),
    'allowedPowerUps': value.rules.allowedPowerUps
        .map((entry) => entry.name)
        .toList(),
    'targetSkills': value.rules.targetSkills,
  },
  'difficultyScore': value.difficultyScore,
  'validation': <String, Object?>{
    'solvable': value.validation.solvable,
    'solutionCount': value.validation.solutionCount,
    'accidentals': value.validation.accidentals,
  },
};

Mastery _mastery(Object? value) {
  final json = _map(value);
  return Mastery(
    skillId: _string(json['skillId']),
    mastery: _double(json['mastery']),
    attempts: _integer(json['attempts']),
    correct: _integer(json['correct']),
    avgTimeMs: _double(json['avgTimeMs']),
    hintsUsed: _integer(json['hintsUsed']),
    nextReviewInDays: _integer(json['nextReviewInDays']),
  );
}

Attempt _attempt(Object? value) {
  final json = _map(value);
  return Attempt(
    skillId: _string(json['skillId']),
    correct: _boolean(json['correct']),
    timeMs: _integer(json['timeMs']),
    hintUsed: _boolean(json['hintUsed']),
    expectedTimeMs: _integer(json['expectedTimeMs']),
  );
}

Map<String, Object?> _masteryToJson(Mastery value) => <String, Object?>{
  'skillId': value.skillId,
  'mastery': value.mastery,
  'attempts': value.attempts,
  'correct': value.correct,
  'avgTimeMs': value.avgTimeMs,
  'hintsUsed': value.hintsUsed,
  'nextReviewInDays': value.nextReviewInDays,
};

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) return value;
  throw FormatException('expected object, got $value');
}

List<Object?> _list(Object? value) {
  if (value is List<Object?>) return value;
  throw FormatException('expected list, got $value');
}

String _string(Object? value) {
  if (value is String) return value;
  throw FormatException('expected string, got $value');
}

int _integer(Object? value) {
  if (value is int) return value;
  throw FormatException('expected integer, got $value');
}

double _double(Object? value) {
  if (value is num) return value.toDouble();
  throw FormatException('expected number, got $value');
}

bool _boolean(Object? value) {
  if (value is bool) return value;
  throw FormatException('expected boolean, got $value');
}
