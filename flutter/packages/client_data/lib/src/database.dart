import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

const pokoDatabaseName = 'poko';
final pokoSqlite3WasmUri = Uri.parse('sqlite3.wasm');
final pokoDriftWorkerUri = Uri.parse('drift_worker.js');

/// Platform-aware SQLite connection for the future generated Drift schema.
///
/// Phase 3 owns the schema and migrations; the foundation deliberately opens no
/// database and performs no I/O merely by importing this package.
DatabaseConnection openPokoDatabase() => driftDatabase(
  name: pokoDatabaseName,
  web: DriftWebOptions(
    sqlite3Wasm: pokoSqlite3WasmUri,
    driftWorker: pokoDriftWorkerUri,
  ),
);
