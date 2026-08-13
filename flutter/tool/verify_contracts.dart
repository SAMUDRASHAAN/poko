import 'dart:convert';
import 'dart:io';

Future<void> main() async {
  final manifestFile = File('../contracts/fixtures/v1/manifest.json');
  final schemaFile = File('../contracts/schema/v1/parity-fixture.schema.json');

  final manifest = jsonDecode(await manifestFile.readAsString());
  final schema = jsonDecode(await schemaFile.readAsString());
  if (manifest is! Map<String, Object?> || schema is! Map<String, Object?>) {
    _fail('Contract documents must be JSON objects.');
  }

  if (manifest['schemaVersion'] != 1 || manifest['cases'] is! List<Object?>) {
    _fail('Fixture manifest does not satisfy the version 1 envelope.');
  }
  final oracle = manifest['oracle'];
  if (oracle is! Map<String, Object?> ||
      oracle['implementation'] != 'typescript' ||
      !RegExp(r'^[0-9a-f]{40}$').hasMatch(oracle['commit'] as String? ?? '')) {
    _fail('Fixture manifest must pin an exact TypeScript oracle commit.');
  }
  if (schema[r'$schema'] != 'https://json-schema.org/draft/2020-12/schema') {
    _fail('Parity schema must use JSON Schema draft 2020-12.');
  }

  stdout.writeln('Version 1 contract envelope is valid.');
}

Never _fail(String message) {
  stderr.writeln(message);
  exit(1);
}
