import 'dart:io';

final class VerificationStep {
  const VerificationStep(
    this.label,
    this.executable,
    this.arguments, {
    this.workingDirectory = '.',
  });

  final String label;
  final String executable;
  final List<String> arguments;
  final String workingDirectory;
}

Future<void> main() async {
  final dart = Platform.resolvedExecutable;
  final steps = <VerificationStep>[
    VerificationStep('format', dart, const <String>[
      'format',
      '--output=none',
      '--set-exit-if-changed',
      '.',
    ]),
    const VerificationStep('analyze', 'flutter', <String>[
      'analyze',
      '--fatal-infos',
      '--fatal-warnings',
    ]),
    VerificationStep('boundaries', dart, const <String>[
      'run',
      'tool/verify_imports.dart',
    ]),
    VerificationStep('contracts', dart, const <String>[
      'run',
      'tool/verify_contracts.dart',
    ]),
    VerificationStep('game_engine tests + coverage', dart, const <String>[
      'run',
      'tool/verify_engine_coverage.dart',
    ]),
    VerificationStep('content tests', dart, const <String>[
      'test',
    ], workingDirectory: 'packages/content'),
    const VerificationStep('design_system tests', 'flutter', <String>[
      'test',
    ], workingDirectory: 'packages/design_system'),
    const VerificationStep('client_data tests', 'flutter', <String>[
      'test',
    ], workingDirectory: 'packages/client_data'),
    const VerificationStep('mobile widget tests', 'flutter', <String>[
      'test',
    ], workingDirectory: 'apps/mobile'),
  ];

  for (final step in steps) {
    stdout.writeln('\n==> ${step.label}');
    final process = await Process.start(
      step.executable,
      step.arguments,
      workingDirectory: step.workingDirectory,
      mode: ProcessStartMode.inheritStdio,
    );
    final code = await process.exitCode;
    if (code != 0) {
      stderr.writeln('${step.label} failed with exit code $code.');
      exitCode = code;
      return;
    }
  }

  stdout.writeln('\nFlutter workspace verification passed.');
}
