import 'dart:io';

const _allowedPackages = <String, Set<String>>{
  'poko_mobile': <String>{
    'flame',
    'flutter',
    'poko_client_data',
    'poko_content',
    'poko_design_system',
    'poko_game_engine',
    'poko_mobile',
    'rive',
  },
  'poko_game_engine': <String>{'poko_game_engine'},
  'poko_content': <String>{'poko_content', 'poko_game_engine'},
  'poko_design_system': <String>{'flutter', 'poko_design_system'},
  'poko_client_data': <String>{
    'drift',
    'drift_flutter',
    'flutter',
    'poko_client_data',
    'poko_game_engine',
  },
};

const _testPackages = <String, Set<String>>{
  'poko_mobile': <String>{'flutter_test'},
  'poko_game_engine': <String>{'test'},
  'poko_content': <String>{'test'},
  'poko_design_system': <String>{'flutter_test'},
  'poko_client_data': <String>{'flutter_test'},
};

const _forbiddenDirectDependencies = <String>{
  'amplitude_flutter',
  'appsflyer_sdk',
  'branch_sdk',
  'dio',
  'firebase_analytics',
  'firebase_core',
  'flutter_facebook_sdk',
  'google_mobile_ads',
  'mixpanel_flutter',
  'sentry_flutter',
  'supabase_flutter',
};

final _directivePattern = RegExp(
  r'''^\s*(?:import|export)\s+['"]([^'"]+)['"]''',
  multiLine: true,
);

Future<void> main() async {
  final workspace = Directory.current;
  final violations = <String>[];

  await for (final entity in workspace.list(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) {
      continue;
    }
    final relativePath = entity.path.substring(workspace.path.length + 1);
    if (relativePath.contains('/.dart_tool/') ||
        relativePath.contains('/build/')) {
      continue;
    }
    if (!relativePath.startsWith('apps/') &&
        !relativePath.startsWith('packages/')) {
      continue;
    }

    final packageName = _packageFor(relativePath);
    final allowedPackages = <String>{
      ..._allowedPackages[packageName]!,
      if (relativePath.contains('/test/')) ..._testPackages[packageName]!,
    };
    final source = await entity.readAsString();
    for (final match in _directivePattern.allMatches(source)) {
      final uri = match.group(1)!;
      if (uri.startsWith('dart:')) {
        if (packageName == 'poko_game_engine') {
          violations.add('$relativePath: engine imports $uri');
        }
        continue;
      }
      if (!uri.startsWith('package:')) {
        violations.add('$relativePath: use a package import, found $uri');
        continue;
      }

      final imported = uri.substring('package:'.length).split('/').first;
      if (!allowedPackages.contains(imported)) {
        violations.add('$relativePath: $packageName may not import $imported');
      }
      if (imported.startsWith('poko_') &&
          imported != packageName &&
          uri != 'package:$imported/$imported.dart') {
        violations.add(
          '$relativePath: deep import across package boundary: $uri',
        );
      }
    }

    if (packageName == 'poko_game_engine') {
      for (final symbol in <String>['DateTime', 'Random', 'Timer']) {
        if (RegExp('\\b$symbol\\b').hasMatch(source)) {
          violations.add('$relativePath: engine uses nondeterministic $symbol');
        }
      }
    }
  }

  await for (final entity in workspace.list(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('pubspec.yaml')) {
      continue;
    }
    final source = await entity.readAsString();
    for (final dependency in _forbiddenDirectDependencies) {
      if (RegExp('^  $dependency:', multiLine: true).hasMatch(source)) {
        violations.add(
          '${entity.path}: forbidden direct dependency $dependency',
        );
      }
    }
  }

  final lockfile = await File('pubspec.lock').readAsString();
  for (final dependency in _forbiddenDirectDependencies) {
    if (RegExp('^  $dependency:', multiLine: true).hasMatch(lockfile)) {
      violations.add(
        'pubspec.lock: forbidden transitive dependency $dependency',
      );
    }
  }

  if (violations.isNotEmpty) {
    stderr.writeln('Flutter boundary audit failed:');
    for (final violation in violations) {
      stderr.writeln('  - $violation');
    }
    exitCode = 1;
    return;
  }

  stdout.writeln('Flutter import and dependency boundaries are clean.');
}

String _packageFor(String path) {
  if (path.startsWith('apps/mobile/')) {
    return 'poko_mobile';
  }
  for (final package in _allowedPackages.keys.where(
    (name) => name != 'poko_mobile',
  )) {
    final directory = package.substring('poko_'.length);
    if (path.startsWith('packages/$directory/')) {
      return package;
    }
  }
  throw StateError('Dart file is outside a governed package: $path');
}
