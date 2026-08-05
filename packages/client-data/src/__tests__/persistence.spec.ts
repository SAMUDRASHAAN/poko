/**
 * Migrations, engine-state round-trip, and the sync outbox.
 *
 * The outbox tests are written against the convergence rules in
 * `ARCHITECTURE.md` §8.2 — idempotent application, last-write-wins on
 * `updated_at`, and progress resolving "best wins" — because those rules are what
 * make an offline session [INV-8] safe to replay.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createLevel, dispatch } from '@poko/engine';

import { createNodeSqliteDriver } from '../node-driver.js';
import { MIGRATIONS, currentVersion, migrate } from '../migrations.js';
import { enqueue, markSynced, pending, pruneSynced } from '../outbox.js';
import {
  createChildProfile,
  getConsent,
  getProgress,
  getSetting,
  putSetting,
  loadLevelState,
  mergeProgress,
  appendConsent,
  saveLevelState,
} from '../repositories.js';
import type { SqliteDriver } from '../driver.js';
import { SPROUT } from './fixtures.js';

const CONSENT = {
  id: 'consent-1',
  parentId: 'parent-1',
  grantedAt: '2026-08-01T00:00:00.000Z',
  revokedAt: null,
  policyVersion: 'v1',
};
const CHILD_ID = 'child-1';

function freshDatabase(): SqliteDriver {
  const driver = createNodeSqliteDriver();
  migrate(driver);
  appendConsent(driver, CONSENT);
  createChildProfile(driver, {
    id: CHILD_ID,
    displayName: 'Tester',
    birthYear: 2019,
    band: 'sprout',
    consentId: CONSENT.id,
  });
  return driver;
}

describe('migrations', () => {
  it('applies every migration and records the version', () => {
    const driver = createNodeSqliteDriver();
    expect(currentVersion(driver)).toBe(0);
    const version = migrate(driver);
    expect(version).toBe(Math.max(...MIGRATIONS.map((m) => m.version)));
  });

  it('is idempotent', () => {
    const driver = createNodeSqliteDriver();
    const first = migrate(driver);
    expect(migrate(driver)).toBe(first);
    const applied = driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations');
    expect(applied[0]?.n).toBe(MIGRATIONS.length);
  });

  it('rolls back a failing migration rather than recording it', () => {
    const driver = createNodeSqliteDriver();
    migrate(driver);
    const before = currentVersion(driver);

    expect(() =>
      driver.transaction(() => {
        driver.exec('CREATE TABLE scratch (a TEXT) STRICT');
        throw new Error('migration blew up');
      }),
    ).toThrow('migration blew up');

    expect(currentVersion(driver)).toBe(before);
    expect(() => driver.all('SELECT * FROM scratch')).toThrow();
  });
});

describe('level state round-trip [INV-7, INV-9]', () => {
  it('restores engine state exactly as it was saved', () => {
    const driver = freshDatabase();
    let state = createLevel(4242, SPROUT.rules, SPROUT.config);
    state = dispatch(state, { type: 'PAUSE' });

    saveLevelState(driver, CHILD_ID, state);
    expect(loadLevelState(driver, CHILD_ID)).toEqual(state);
  });

  it('keeps only the latest state per child', () => {
    const driver = freshDatabase();
    const first = createLevel(1, SPROUT.rules, SPROUT.config);
    const second = createLevel(2, SPROUT.rules, SPROUT.config);

    saveLevelState(driver, CHILD_ID, first);
    saveLevelState(driver, CHILD_ID, second);

    expect(loadLevelState(driver, CHILD_ID)).toEqual(second);
    const rows = driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM level_state');
    expect(rows[0]?.n).toBe(1);
  });

  it('returns null for a child with no saved session', () => {
    expect(loadLevelState(freshDatabase(), 'nobody')).toBeNull();
  });
});

describe('sync outbox [ARCHITECTURE §8.2]', () => {
  let driver: SqliteDriver;

  beforeEach(() => {
    driver = freshDatabase();
    driver.run('DELETE FROM outbox');
  });

  it('collapses repeated writes to one pending row per entity', () => {
    for (let index = 0; index < 50; index += 1) {
      enqueue(driver, {
        entity: 'progress',
        entityId: CHILD_ID,
        payload: `{"stars":${index}}`,
        updatedAt: `2026-08-01T00:00:${String(index).padStart(2, '0')}.000Z`,
      });
    }

    const queue = pending(driver);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.payload).toBe('{"stars":49}');
  });

  it('does not let an older write clobber a newer pending one', () => {
    enqueue(driver, {
      entity: 'progress',
      entityId: CHILD_ID,
      payload: 'newer',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
    enqueue(driver, {
      entity: 'progress',
      entityId: CHILD_ID,
      payload: 'older',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(pending(driver)[0]?.payload).toBe('newer');
  });

  it('acknowledges only what was actually sent', () => {
    enqueue(driver, {
      entity: 'progress',
      entityId: CHILD_ID,
      payload: 'sent',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const inFlight = pending(driver);

    // The child plays on while the request is in flight.
    enqueue(driver, {
      entity: 'progress',
      entityId: CHILD_ID,
      payload: 'written while syncing',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });

    const acknowledged = markSynced(driver, inFlight, '2026-08-02T00:00:00.000Z');
    expect(acknowledged).toBe(0);

    const queue = pending(driver);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.payload).toBe('written while syncing');
  });

  it('is idempotent under a replayed acknowledgement', () => {
    enqueue(driver, {
      entity: 'mastery',
      entityId: `${CHILD_ID}:sprout.addition`,
      payload: '{}',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const batch = pending(driver);

    expect(markSynced(driver, batch, '2026-08-02T00:00:00.000Z')).toBe(1);
    expect(markSynced(driver, batch, '2026-08-02T00:00:00.000Z')).toBe(0);
    expect(pending(driver)).toHaveLength(0);
  });

  it('prunes only acknowledged rows', () => {
    enqueue(driver, {
      entity: 'a',
      entityId: '1',
      payload: '{}',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const batch = pending(driver);
    markSynced(driver, batch, '2026-08-01T12:00:00.000Z');

    enqueue(driver, {
      entity: 'b',
      entityId: '2',
      payload: '{}',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    expect(pruneSynced(driver, '2026-08-03T00:00:00.000Z')).toBe(1);
    expect(pending(driver)).toHaveLength(1);
  });
});

describe('progress merges best-wins, not last-write-wins', () => {
  it('never regresses on a stale or replayed payload', () => {
    const driver = freshDatabase();

    mergeProgress(driver, {
      childId: CHILD_ID,
      stars: 40,
      coins: 100,
      streakDays: 7,
      bestPosition: 30,
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    // A stale payload arrives late — offline device, out-of-order delivery.
    const merged = mergeProgress(driver, {
      childId: CHILD_ID,
      stars: 5,
      coins: 10,
      streakDays: 1,
      bestPosition: 2,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(merged).toMatchObject({ stars: 40, coins: 100, streakDays: 7, bestPosition: 30 });
    expect(getProgress(driver, CHILD_ID)).toMatchObject({ stars: 40, bestPosition: 30 });
  });

  it('takes the higher value from each side', () => {
    const driver = freshDatabase();
    mergeProgress(driver, {
      childId: CHILD_ID,
      stars: 40,
      coins: 10,
      streakDays: 2,
      bestPosition: 30,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const merged = mergeProgress(driver, {
      childId: CHILD_ID,
      stars: 20,
      coins: 90,
      streakDays: 9,
      bestPosition: 12,
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    expect(merged).toMatchObject({ stars: 40, coins: 90, streakDays: 9, bestPosition: 30 });
  });
});

describe('settings', () => {
  it('stores, overwrites and reports missing keys', () => {
    const driver = freshDatabase();

    expect(getSetting(driver, CHILD_ID, 'audio.music')).toBeNull();

    putSetting(driver, CHILD_ID, 'audio.music', '0.4');
    expect(getSetting(driver, CHILD_ID, 'audio.music')).toBe('0.4');

    putSetting(driver, CHILD_ID, 'audio.music', '0.9');
    expect(getSetting(driver, CHILD_ID, 'audio.music')).toBe('0.9');

    const rows = driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM settings');
    expect(rows[0]?.n).toBe(1);
  });

  it('scopes settings per child', () => {
    const driver = freshDatabase();
    putSetting(driver, CHILD_ID, 'a11y.reducedMotion', 'true');
    expect(getSetting(driver, 'someone-else', 'a11y.reducedMotion')).toBeNull();
  });
});

describe('driver and lookup edges', () => {
  it('returns null for a consent record that does not exist', () => {
    expect(getConsent(freshDatabase(), 'missing')).toBeNull();
  });

  it('joins an outer transaction rather than nesting BEGIN', () => {
    const driver = freshDatabase();
    const result = driver.transaction(() => driver.transaction(() => 'inner ran'));
    expect(result).toBe('inner ran');
  });

  it('prunes nothing when there is nothing acknowledged', () => {
    expect(pruneSynced(freshDatabase(), '2099-01-01T00:00:00.000Z')).toBe(0);
  });

  it('closes cleanly', () => {
    const driver = createNodeSqliteDriver();
    migrate(driver);
    expect(() => driver.close()).not.toThrow();
  });
});
