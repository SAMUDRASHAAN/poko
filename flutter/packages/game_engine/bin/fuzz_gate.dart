import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/generator.dart';

const int _runs = int.fromEnvironment('FUZZ_RUNS', defaultValue: 100000);
const int _analyseP95BudgetMicros = 5000;
const int _seedStride = 2654435761;

void main() {
  final bands = <BandConfig>[
    defaultBand(BandId.sprout),
    defaultBand(BandId.adventurer),
  ];
  final failures = <String>[];
  final analysisMicros = <int>[];
  final total = Stopwatch()..start();

  for (var index = 0; index < _runs; index += 1) {
    final band = bands[index % bands.length];
    final seed = index * _seedStride;
    try {
      final pack = generatePack(band.id, 1, seed);
      if (pack.isEmpty) {
        failures.add('seed=$seed band=${band.id.name}: empty pack');
        continue;
      }
      final puzzle = pack.first;
      final state = createLevel(puzzle.seed, puzzle.rules, band);
      final stopwatch = Stopwatch()..start();
      final analysis = analyse(state.board, state.target, state.rules);
      stopwatch.stop();
      analysisMicros.add(stopwatch.elapsedMicroseconds);
      if (analysis.solutions.isEmpty || analysis.isStuck) {
        failures.add('seed=$seed band=${band.id.name}: unsolvable');
      }
    } on Object catch (error) {
      failures.add('seed=$seed band=${band.id.name}: threw $error');
    }

    if (index > 0 && index % 10000 == 0) {
      // This is a command-line gate, so progress belongs on its standard output.
      // ignore: avoid_print
      print('$index/$_runs');
    }
  }

  total.stop();
  analysisMicros.sort();
  final percentileIndex = ((analysisMicros.length * 95 + 99) ~/ 100) - 1;
  final p95 = analysisMicros.isEmpty
      ? _analyseP95BudgetMicros + 1
      : analysisMicros[percentileIndex];
  if (failures.isNotEmpty) {
    throw StateError(
      '${failures.length} fuzz failures:\n${failures.take(10).join('\n')}',
    );
  }
  if (p95 >= _analyseP95BudgetMicros) {
    throw StateError('analyse P95 ${p95 / 1000}ms exceeds 5ms');
  }

  // This is the retained machine-readable gate summary for local and CI runs.
  // ignore: avoid_print
  print(
    'PASS runs=$_runs failures=0 '
    'analyse_p95_ms=${(p95 / 1000).toStringAsFixed(3)} '
    'elapsed_s=${(total.elapsedMilliseconds / 1000).toStringAsFixed(1)}',
  );
}
