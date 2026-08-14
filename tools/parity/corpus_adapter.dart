import 'dart:convert';

import 'package:poko_game_engine/poko_game_engine.dart';

const int _seedStride = 2654435761;
final _fnvOffset = BigInt.parse('cbf29ce484222325', radix: 16);
final _fnvPrime = BigInt.parse('100000001b3', radix: 16);
final _mask64 = (BigInt.one << 64) - BigInt.one;

void main(List<String> arguments) {
  final runs = arguments.isEmpty ? 100000 : int.parse(arguments.first);
  final bands = <BandConfig>[_sprout, _adventurer];
  var hash = _fnvOffset;
  var codeUnits = 0;
  var failures = 0;
  final analyseMicros = <int>[];

  for (var index = 0; index < runs; index += 1) {
    final band = bands[index % bands.length];
    final seed = index * _seedStride;
    try {
      final pack = generatePack(band.id, 1, seed);
      if (pack.isEmpty) {
        failures += 1;
        continue;
      }
      final puzzle = pack.first;
      final state = createLevel(puzzle.seed, puzzle.rules, band);
      final analyseWatch = Stopwatch()..start();
      final analysis = analyse(state.board, state.target, state.rules);
      analyseWatch.stop();
      analyseMicros.add(analyseWatch.elapsedMicroseconds);
      if (analysis.solutions.isEmpty || analysis.isStuck) {
        failures += 1;
      }
      final record = jsonEncode(<String, Object?>{
        'puzzle': _puzzle(puzzle),
        'state': jsonDecode(serialise(state)),
        'analysis': _analysis(analysis),
      });
      for (final codeUnit in record.codeUnits) {
        hash = ((hash ^ BigInt.from(codeUnit)) * _fnvPrime) & _mask64;
      }
      hash = ((hash ^ BigInt.from(10)) * _fnvPrime) & _mask64;
      codeUnits += record.length + 1;
    } on Object {
      failures += 1;
    }
  }

  analyseMicros.sort();
  final p95Index = ((analyseMicros.length * 95 + 99) ~/ 100) - 1;
  final analyseP95Micros = analyseMicros.isEmpty ? -1 : analyseMicros[p95Index];

  // ignore: avoid_print
  print(
    jsonEncode(<String, Object?>{
      'runs': runs,
      'failures': failures,
      'codeUnits': codeUnits,
      'fnv64': hash.toRadixString(16).padLeft(16, '0'),
      'analyseP95Micros': analyseP95Micros,
    }),
  );
}

Map<String, Object?> _puzzle(PuzzleSeed value) => <String, Object?>{
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

Map<String, Object?> _analysis(Analysis value) => <String, Object?>{
  'solutions': value.solutions.map(_solution).toList(),
  'bestSolution': value.bestSolution == null
      ? null
      : _solution(value.bestSolution!),
  'hiddenSolutions': value.hiddenSolutions,
  'setupMoves': value.setupMoves,
  'isStuck': value.isStuck,
  'accidentals': value.accidentals.map(_solution).toList(),
};

Map<String, Object?> _solution(Solution value) => <String, Object?>{
  'cells': value.cells
      .map((cell) => <String, Object?>{'row': cell.row, 'col': cell.col})
      .toList(),
  'result': <String, Object?>{
    'n': value.result.numerator,
    'd': value.result.denominator,
  },
};

const _sprout = BandConfig(
  id: BandId.sprout,
  numberRange: IntRange(1, 10),
  allowedOperations: <Operation>[Operation.add, Operation.sub],
  allowedColours: <TileColour>[TileColour.coral, TileColour.marine],
  minChain: 2,
  maxChain: 4,
  maxTarget: 20,
  allowNegatives: false,
  allowDiagonals: false,
  minSolutions: 1,
  maxSolutions: 4,
);

const _adventurer = BandConfig(
  id: BandId.adventurer,
  numberRange: IntRange(1, 12),
  allowedOperations: <Operation>[Operation.add, Operation.sub, Operation.mul],
  allowedColours: <TileColour>[
    TileColour.coral,
    TileColour.marine,
    TileColour.kelp,
  ],
  minChain: 2,
  maxChain: 5,
  maxTarget: 50,
  allowNegatives: false,
  allowDiagonals: false,
  minSolutions: 1,
  maxSolutions: 5,
);
