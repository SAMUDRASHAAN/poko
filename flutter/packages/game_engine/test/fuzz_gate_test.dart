import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/generator.dart';
import 'package:test/test.dart';

const int _runs = int.fromEnvironment('FUZZ_RUNS', defaultValue: 500);
const int _analyseP95BudgetMicros = 5000;
const int _seedStride = 2654435761;

void main() {
  test(
    '$_runs seeded boards have zero failures and analyse P95 below 5ms',
    () {
      final bands = <BandConfig>[
        defaultBand(BandId.sprout),
        defaultBand(BandId.adventurer),
      ];
      final failures = <String>[];
      final analysisMicros = <int>[];

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
      }

      analysisMicros.sort();
      final percentileIndex = ((analysisMicros.length * 95 + 99) ~/ 100) - 1;
      final p95 = analysisMicros.isEmpty
          ? _analyseP95BudgetMicros + 1
          : analysisMicros[percentileIndex];
      expect(failures, isEmpty, reason: failures.take(10).join('\n'));
      expect(
        p95,
        lessThan(_analyseP95BudgetMicros),
        reason: 'analyse P95 was ${p95 / 1000}ms across $_runs boards',
      );
    },
    timeout: const Timeout(Duration(minutes: 10)),
  );
}
