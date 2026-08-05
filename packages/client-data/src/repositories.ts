/**
 * Repositories — the only sanctioned path to persisted data.
 *
 * `ARCHITECTURE.md` §6: "Reading or writing persisted data → `packages/client-data/`
 * repositories", never components, screens or services.
 *
 * SQLite on the device is the source of truth [INV-9]; the server is a sync
 * target. So every write here is authoritative locally and enqueues an outbox row
 * rather than waiting on a network call.
 */
import type { LevelState } from '@poko/engine';
import { restore, serialise } from '@poko/engine';

import { one, type SqliteDriver } from './driver.js';
import { enqueue } from './outbox.js';

export type Clock = () => string;

const isoNow: Clock = () => new Date().toISOString();

export type ConsentRecord = {
  readonly id: string;
  readonly parentId: string;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
  readonly policyVersion: string;
  /** Set when this row supersedes an earlier grant. */
  readonly supersedes?: string | null;
};

export type ChildProfile = {
  readonly id: string;
  readonly displayName: string;
  /** INV-11: birth YEAR only. There is no date-of-birth field, by design. */
  readonly birthYear: number;
  readonly band: string;
  readonly consentId: string;
};

export type MasteryRow = {
  readonly childId: string;
  readonly skillId: string;
  readonly mastery: number;
  readonly attempts: number;
  readonly correct: number;
  readonly avgTimeMs: number;
  readonly hintsUsed: number;
  readonly updatedAt: string;
};

export type ProgressRow = {
  readonly childId: string;
  readonly stars: number;
  readonly coins: number;
  readonly streakDays: number;
  readonly bestPosition: number;
  readonly updatedAt: string;
};

/* ------------------------------------------------------------------ consent */

/**
 * Appends a consent record.
 *
 * `.claude/rules/backend.md`: consent is APPEND ONLY. This is a plain INSERT, and
 * a database trigger rejects any UPDATE — so a grant cannot be rewritten after the
 * fact, and re-appending the same id raises rather than silently overwriting.
 * Revocation appends a superseding row via `revokeConsent`.
 */
export function appendConsent(driver: SqliteDriver, record: ConsentRecord): void {
  driver.run(
    `INSERT INTO consent_record
       (id, parent_id, granted_at, revoked_at, policy_version, supersedes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.parentId,
      record.grantedAt,
      record.revokedAt,
      record.policyVersion,
      record.supersedes ?? null,
    ],
  );
}

/** Records a revocation as a new row. The original grant is left untouched. */
export function revokeConsent(
  driver: SqliteDriver,
  original: ConsentRecord,
  revocationId: string,
  now: Clock = isoNow,
): void {
  const timestamp = now();
  appendConsent(driver, {
    id: revocationId,
    parentId: original.parentId,
    grantedAt: original.grantedAt,
    revokedAt: timestamp,
    policyVersion: original.policyVersion,
    supersedes: original.id,
  });
}

export function getConsent(driver: SqliteDriver, id: string): ConsentRecord | null {
  const row = one<{
    id: string;
    parent_id: string;
    granted_at: string;
    revoked_at: string | null;
    policy_version: string;
    supersedes: string | null;
  }>(driver, 'SELECT * FROM consent_record WHERE id = ?', [id]);

  return row
    ? {
        id: row.id,
        parentId: row.parent_id,
        grantedAt: row.granted_at,
        revokedAt: row.revoked_at,
        policyVersion: row.policy_version,
        supersedes: row.supersedes,
      }
    : null;
}

/**
 * Erases a consent record and, by cascade, every row belonging to its children.
 *
 * This is the local half of a data-erasure request. Because every child-scoped
 * table cascades from `child_profile`, which cascades from `consent_record`,
 * erasure cannot miss a table someone forgot to list.
 */
export function eraseConsent(driver: SqliteDriver, consentId: string): void {
  driver.run('DELETE FROM consent_record WHERE id = ?', [consentId]);
}

/* ------------------------------------------------------------------ profiles */

/**
 * Creates a child profile.
 *
 * The `consentId` foreign key is what enforces INV-10 locally: with foreign keys
 * enabled, passing an id with no consent row raises rather than writing.
 */
export function createChildProfile(
  driver: SqliteDriver,
  profile: ChildProfile,
  now: Clock = isoNow,
): void {
  const timestamp = now();
  driver.transaction(() => {
    driver.run(
      `INSERT INTO child_profile
         (id, display_name, birth_year, band, consent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.displayName,
        profile.birthYear,
        profile.band,
        profile.consentId,
        timestamp,
        timestamp,
      ],
    );
    enqueue(driver, {
      entity: 'child_profile',
      entityId: profile.id,
      payload: JSON.stringify(profile),
      updatedAt: timestamp,
    });
  });
}

export function getChildProfile(driver: SqliteDriver, id: string): ChildProfile | null {
  const row = one<{
    id: string;
    display_name: string;
    birth_year: number;
    band: string;
    consent_id: string;
  }>(driver, 'SELECT * FROM child_profile WHERE id = ?', [id]);

  return row
    ? {
        id: row.id,
        displayName: row.display_name,
        birthYear: row.birth_year,
        band: row.band,
        consentId: row.consent_id,
      }
    : null;
}

/* --------------------------------------------------------------- level state */

/**
 * Persists engine state. Called on every return to `READY` [ARCHITECTURE §8.1].
 *
 * The blob is `engine.serialise()` output and is stored opaquely — client-data
 * never parses game state, because that would put rules outside the engine [INV-2].
 */
export function saveLevelState(
  driver: SqliteDriver,
  childId: string,
  state: LevelState,
  now: Clock = isoNow,
): void {
  const timestamp = now();
  const blob = serialise(state);

  driver.transaction(() => {
    driver.run(
      `INSERT INTO level_state (child_id, blob, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(child_id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at`,
      [childId, blob, timestamp],
    );
    enqueue(driver, {
      entity: 'level_state',
      entityId: childId,
      payload: blob,
      updatedAt: timestamp,
    });
  });
}

/** Restores engine state, or null when the child has no saved session. */
export function loadLevelState(driver: SqliteDriver, childId: string): LevelState | null {
  const row = one<{ blob: string }>(driver, 'SELECT blob FROM level_state WHERE child_id = ?', [
    childId,
  ]);
  return row ? restore(row.blob) : null;
}

/* ------------------------------------------------------------------ mastery */

export function upsertMastery(driver: SqliteDriver, row: MasteryRow): void {
  driver.transaction(() => {
    driver.run(
      `INSERT INTO mastery
         (child_id, skill_id, mastery, attempts, correct, avg_time_ms, hints_used, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(child_id, skill_id) DO UPDATE SET
         mastery = excluded.mastery,
         attempts = excluded.attempts,
         correct = excluded.correct,
         avg_time_ms = excluded.avg_time_ms,
         hints_used = excluded.hints_used,
         updated_at = excluded.updated_at`,
      [
        row.childId,
        row.skillId,
        row.mastery,
        row.attempts,
        row.correct,
        row.avgTimeMs,
        row.hintsUsed,
        row.updatedAt,
      ],
    );
    enqueue(driver, {
      entity: 'mastery',
      entityId: `${row.childId}:${row.skillId}`,
      payload: JSON.stringify(row),
      updatedAt: row.updatedAt,
    });
  });
}

export function listMastery(driver: SqliteDriver, childId: string): MasteryRow[] {
  return driver
    .all<{
      child_id: string;
      skill_id: string;
      mastery: number;
      attempts: number;
      correct: number;
      avg_time_ms: number;
      hints_used: number;
      updated_at: string;
    }>('SELECT * FROM mastery WHERE child_id = ? ORDER BY skill_id', [childId])
    .map((row) => ({
      childId: row.child_id,
      skillId: row.skill_id,
      mastery: row.mastery,
      attempts: row.attempts,
      correct: row.correct,
      avgTimeMs: row.avg_time_ms,
      hintsUsed: row.hints_used,
      updatedAt: row.updated_at,
    }));
}

/* ----------------------------------------------------------------- progress */

/**
 * Merges progress with "best wins" [ARCHITECTURE §8.2].
 *
 * Progress is monotonic from the child's point of view: a stale sync payload, or
 * a replayed one, must never reduce stars, coins, streak or furthest position.
 * Unlike the rest of sync, this is deliberately NOT last-write-wins.
 */
export function mergeProgress(driver: SqliteDriver, next: ProgressRow): ProgressRow {
  return driver.transaction(() => {
    const existing = getProgress(driver, next.childId);
    const merged: ProgressRow = existing
      ? {
          childId: next.childId,
          stars: Math.max(existing.stars, next.stars),
          coins: Math.max(existing.coins, next.coins),
          streakDays: Math.max(existing.streakDays, next.streakDays),
          bestPosition: Math.max(existing.bestPosition, next.bestPosition),
          updatedAt: next.updatedAt > existing.updatedAt ? next.updatedAt : existing.updatedAt,
        }
      : next;

    driver.run(
      `INSERT INTO progress (child_id, stars, coins, streak_days, best_position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(child_id) DO UPDATE SET
         stars = excluded.stars,
         coins = excluded.coins,
         streak_days = excluded.streak_days,
         best_position = excluded.best_position,
         updated_at = excluded.updated_at`,
      [
        merged.childId,
        merged.stars,
        merged.coins,
        merged.streakDays,
        merged.bestPosition,
        merged.updatedAt,
      ],
    );
    enqueue(driver, {
      entity: 'progress',
      entityId: merged.childId,
      payload: JSON.stringify(merged),
      updatedAt: merged.updatedAt,
    });
    return merged;
  });
}

export function getProgress(driver: SqliteDriver, childId: string): ProgressRow | null {
  const row = one<{
    child_id: string;
    stars: number;
    coins: number;
    streak_days: number;
    best_position: number;
    updated_at: string;
  }>(driver, 'SELECT * FROM progress WHERE child_id = ?', [childId]);

  return row
    ? {
        childId: row.child_id,
        stars: row.stars,
        coins: row.coins,
        streakDays: row.streak_days,
        bestPosition: row.best_position,
        updatedAt: row.updated_at,
      }
    : null;
}

/* ----------------------------------------------------------------- settings */

export function putSetting(
  driver: SqliteDriver,
  childId: string,
  key: string,
  value: string,
  now: Clock = isoNow,
): void {
  driver.run(
    `INSERT INTO settings (child_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(child_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [childId, key, value, now()],
  );
}

export function getSetting(driver: SqliteDriver, childId: string, key: string): string | null {
  const row = one<{ value: string }>(
    driver,
    'SELECT value FROM settings WHERE child_id = ? AND key = ?',
    [childId, key],
  );
  return row?.value ?? null;
}
