import 'dart:io';

const _minimumLineCoverage = 90.0;

Future<void> main() async {
  final temporaryDirectory = await Directory.systemTemp.createTemp(
    'poko-engine-coverage-',
  );
  final coverageFile = File('${temporaryDirectory.path}/lcov.info');

  try {
    final process = await Process.start(
      Platform.resolvedExecutable,
      <String>[
        'test',
        '--coverage-path=${coverageFile.path}',
        '--concurrency=1',
      ],
      workingDirectory: 'packages/game_engine',
      mode: ProcessStartMode.inheritStdio,
    );
    final testExitCode = await process.exitCode;
    if (testExitCode != 0) {
      stderr.writeln('game_engine tests failed with exit code $testExitCode.');
      exitCode = testExitCode;
      return;
    }

    if (!coverageFile.existsSync()) {
      stderr.writeln('game_engine tests did not produce an LCOV report.');
      exitCode = 1;
      return;
    }

    var linesFound = 0;
    var linesHit = 0;
    for (final line in await coverageFile.readAsLines()) {
      if (line.startsWith('LF:')) {
        linesFound += int.parse(line.substring(3));
      } else if (line.startsWith('LH:')) {
        linesHit += int.parse(line.substring(3));
      }
    }

    if (linesFound == 0) {
      stderr.writeln('LCOV report contains no executable lines.');
      exitCode = 1;
      return;
    }

    final coverage = linesHit * 100 / linesFound;
    stdout.writeln(
      'game_engine line coverage: ${coverage.toStringAsFixed(2)}% '
      '($linesHit/$linesFound; minimum ${_minimumLineCoverage.toStringAsFixed(0)}%)',
    );
    if (coverage < _minimumLineCoverage) {
      stderr.writeln('game_engine coverage is below the required minimum.');
      exitCode = 1;
    }
  } finally {
    await temporaryDirectory.delete(recursive: true);
  }
}
