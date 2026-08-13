import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poko_client_data/poko_client_data.dart';

void main() {
  test('exposes a lazy platform database factory', () {
    expect(pokoDatabaseName, 'poko');
    expect(pokoSqlite3WasmUri.path, 'sqlite3.wasm');
    expect(pokoDriftWorkerUri.path, 'drift_worker.js');
    expect(openPokoDatabase, isA<DatabaseConnection Function()>());
  });
}
