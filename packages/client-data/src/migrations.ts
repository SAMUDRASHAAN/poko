/**
 * Forward-only, versioned migrations.
 *
 * Every table is declared `STRICT`. That is not stylistic: SQLite's default type
 * affinity happily stores the string `'2019-05-04'` in an `INTEGER` column, which
 * would make INV-11 a convention rather than a constraint. Under `STRICT`, the
 * write is rejected by the database.
 */
import type { SqliteDriver } from './driver.js';

export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

/**
 * Schema v1.
 *
 * Two invariants are enforced structurally here rather than by discipline:
 *
 * - **INV-11 — no child's full date of birth, birth year only.** `child_profile`
 *   has a `birth_year INTEGER` column and no date column at all. STRICT rejects a
 *   date string, and the CHECK rejects anything that is not a plausible year. To
 *   store a date of birth you would have to alter the schema, which is a reviewed
 *   diff.
 *
 * - **INV-10 — no child data before a valid consent record.** `child_profile.
 *   consent_id` is NOT NULL and REFERENCES `consent_record`, so with foreign keys
 *   enabled a child row cannot exist without one. Everything child-scoped cascades
 *   from `child_profile`, so erasing consent erases the child's data with it.
 *
 * - **`consent_record` is append-only** (`.claude/rules/backend.md`). A trigger
 *   rejects every UPDATE, so a consent grant cannot be quietly rewritten after the
 *   fact — revocation is a new row, and the audit trail is the table itself.
 *   Deletion is deliberately still permitted, and only through `eraseConsent`:
 *   append-only protects the record's integrity, but a data-erasure request must
 *   actually erase.
 *
 * The server remains the authority for INV-10 (`ARCHITECTURE.md` §8.3); this is
 * defence in depth on the device, not a substitute.
 */
const V1_INITIAL = `
CREATE TABLE consent_record (
  id           TEXT    NOT NULL PRIMARY KEY,
  parent_id    TEXT    NOT NULL,
  granted_at   TEXT    NOT NULL,
  revoked_at   TEXT,
  policy_version TEXT  NOT NULL,
  -- Set when this row revokes or replaces an earlier grant.
  supersedes   TEXT    REFERENCES consent_record(id)
) STRICT;

-- Append-only: rewriting a consent grant would destroy the evidence that it was
-- given. Revocation appends a superseding row instead.
CREATE TRIGGER consent_record_is_append_only
BEFORE UPDATE ON consent_record
BEGIN
  SELECT RAISE(ABORT, 'consent_record is append-only');
END;

CREATE TABLE child_profile (
  id           TEXT    NOT NULL PRIMARY KEY,
  display_name TEXT    NOT NULL,
  -- INV-11: birth YEAR only. There is deliberately no date-of-birth column.
  birth_year   INTEGER NOT NULL CHECK (birth_year BETWEEN 1900 AND 2200),
  band         TEXT    NOT NULL,
  -- INV-10: a child cannot exist without a consent record.
  consent_id   TEXT    NOT NULL REFERENCES consent_record(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
) STRICT;

CREATE TABLE level_state (
  child_id   TEXT NOT NULL PRIMARY KEY REFERENCES child_profile(id) ON DELETE CASCADE,
  -- engine.serialise() output. Opaque here: client-data stores, it never parses
  -- game state. [INV-7]
  blob       TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE mastery (
  child_id    TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
  skill_id    TEXT NOT NULL,
  mastery     REAL NOT NULL,
  attempts    INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  avg_time_ms INTEGER NOT NULL,
  hints_used  INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (child_id, skill_id)
) STRICT;

CREATE TABLE progress (
  child_id     TEXT NOT NULL PRIMARY KEY REFERENCES child_profile(id) ON DELETE CASCADE,
  stars        INTEGER NOT NULL DEFAULT 0,
  coins        INTEGER NOT NULL DEFAULT 0,
  streak_days  INTEGER NOT NULL DEFAULT 0,
  best_position INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL
) STRICT;

CREATE TABLE settings (
  child_id   TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, key)
) STRICT;

CREATE TABLE outbox (
  uuid       TEXT NOT NULL PRIMARY KEY,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  payload    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at  TEXT
) STRICT;

CREATE INDEX outbox_pending ON outbox (synced_at, updated_at);
`;

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'initial schema', sql: V1_INITIAL },
];

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER NOT NULL PRIMARY KEY,
  name       TEXT    NOT NULL,
  applied_at TEXT    NOT NULL
) STRICT;
`;

export function currentVersion(driver: SqliteDriver): number {
  driver.exec(MIGRATIONS_TABLE);
  const rows = driver.all<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  return rows[0]?.version ?? 0;
}

/**
 * Applies every migration newer than the recorded version.
 *
 * Idempotent: running it twice is a no-op. Each migration and its version row
 * commit together, so a failure part-way cannot leave the database claiming a
 * version it does not have.
 */
export function migrate(
  driver: SqliteDriver,
  now: () => string = () => new Date().toISOString(),
): number {
  driver.exec(MIGRATIONS_TABLE);
  const from = currentVersion(driver);

  const pending = [...MIGRATIONS]
    .filter((migration) => migration.version > from)
    .sort((left, right) => left.version - right.version);

  for (const migration of pending) {
    driver.transaction(() => {
      driver.exec(migration.sql);
      driver.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        now(),
      ]);
    });
  }

  return currentVersion(driver);
}
