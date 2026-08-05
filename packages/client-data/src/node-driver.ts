/**
 * A `SqliteDriver` backed by Node's built-in SQLite.
 *
 * `node:sqlite` is standard library, so this adds no npm dependency and needs no
 * ADR. It exists so the schema, migrations, constraints and repositories are
 * tested against **real SQLite** rather than a hand-written fake — a fake would
 * not enforce STRICT typing or foreign keys, which is precisely where the privacy
 * invariants live.
 *
 * This is for tests and tooling. The on-device driver is a separate adapter.
 */
import { createRequire } from 'node:module';

import type { StatementSync } from 'node:sqlite';

import type { SqlRow, SqlValue, SqliteDriver } from './driver.js';

/** The slice of `node:sqlite` this adapter uses. */
type DatabaseSyncConstructor = new (location: string) => {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
};

// Loaded through `createRequire` rather than a static import: bundlers do not all
// recognise `node:sqlite` as a builtin yet, and some strip the prefix and then try
// to resolve a bare `sqlite` package from node_modules. Resolving at runtime side-
// steps that entirely, and this adapter only ever runs under Node.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: DatabaseSyncConstructor;
};

export function createNodeSqliteDriver(location = ':memory:'): SqliteDriver {
  const db = new DatabaseSync(location);

  // Foreign keys are OFF by default in SQLite and must be enabled per connection.
  // Without this, every REFERENCES clause in the schema is decoration.
  db.exec('PRAGMA foreign_keys = ON');

  let depth = 0;

  return {
    exec(sql) {
      db.exec(sql);
    },

    run(sql, params = []) {
      db.prepare(sql).run(...(params as SqlValue[]));
    },

    all<Row extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []): Row[] {
      // node:sqlite returns null-prototype objects; copy so consumers can treat
      // them as ordinary records.
      return db
        .prepare(sql)
        .all(...(params as SqlValue[]))
        .map((row) => ({ ...row }) as Row);
    },

    transaction<Result>(body: () => Result): Result {
      // Nested calls join the outer transaction rather than failing: repositories
      // compose, and SQLite has no nested BEGIN.
      if (depth > 0) return body();

      depth += 1;
      db.exec('BEGIN');
      try {
        const result = body();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },

    close() {
      db.close();
    },
  };
}
