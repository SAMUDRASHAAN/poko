/**
 * Privacy invariants, written as attacks that must fail.
 *
 * `04-release-readiness.md` §3 asks for "a schema constraint making a full date of
 * birth unstorable, not merely unwritten". These tests try to store one, and try
 * to create a child with no consent. Both must be refused by the database, not by
 * a convention somebody can forget.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createNodeSqliteDriver } from '../node-driver.js';
import { migrate } from '../migrations.js';
import {
  createChildProfile,
  eraseConsent,
  getChildProfile,
  listMastery,
  loadLevelState,
  appendConsent,
  getConsent,
  revokeConsent,
  upsertMastery,
} from '../repositories.js';
import type { SqliteDriver } from '../driver.js';

const CONSENT = {
  id: 'consent-1',
  parentId: 'parent-1',
  grantedAt: '2026-08-01T00:00:00.000Z',
  revokedAt: null,
  policyVersion: 'v1',
};

const CHILD = {
  id: 'child-1',
  displayName: 'Tester',
  birthYear: 2019,
  band: 'sprout',
  consentId: CONSENT.id,
};

describe('INV-11 — birth year only, never a date of birth', () => {
  let driver: SqliteDriver;

  beforeEach(() => {
    driver = createNodeSqliteDriver();
    migrate(driver);
    appendConsent(driver, CONSENT);
  });

  it('has no column that could hold a date of birth', () => {
    const columns = driver
      .all<{ name: string; type: string }>('PRAGMA table_info(child_profile)')
      .map((column) => column.name);

    expect(columns).toContain('birth_year');
    for (const column of columns) {
      expect(column).not.toMatch(/dob|date_of_birth|birth_date|birthdate/i);
    }
  });

  it('refuses to store a date string where the year belongs', () => {
    expect(() =>
      driver.run(
        `INSERT INTO child_profile
           (id, display_name, birth_year, band, consent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['x', 'Tester', '2019-05-04', 'sprout', CONSENT.id, 'now', 'now'],
      ),
    ).toThrow(/INTEGER|STRICT|cannot store/i);
  });

  it('refuses a birth year that is not a plausible year', () => {
    for (const bogus of [19, 0, 99999]) {
      expect(() =>
        createChildProfile(driver, { ...CHILD, id: `x${bogus}`, birthYear: bogus }),
      ).toThrow(/CHECK/i);
    }
  });

  it('accepts a legitimate birth year', () => {
    createChildProfile(driver, CHILD);
    expect(getChildProfile(driver, CHILD.id)?.birthYear).toBe(2019);
  });
});

describe('consent is append-only [.claude/rules/backend.md]', () => {
  let driver: SqliteDriver;

  beforeEach(() => {
    driver = createNodeSqliteDriver();
    migrate(driver);
    appendConsent(driver, CONSENT);
  });

  it('refuses to update a consent row', () => {
    expect(() =>
      driver.run('UPDATE consent_record SET revoked_at = ? WHERE id = ?', ['now', CONSENT.id]),
    ).toThrow(/append-only/i);
  });

  it('refuses to rewrite a grant by re-appending the same id', () => {
    expect(() => appendConsent(driver, { ...CONSENT, policyVersion: 'v2' })).toThrow(
      /UNIQUE|PRIMARY KEY|constraint/i,
    );
    expect(getConsent(driver, CONSENT.id)?.policyVersion).toBe('v1');
  });

  it('records revocation as a new row, leaving the grant intact', () => {
    revokeConsent(driver, CONSENT, 'consent-1-revoked', () => '2026-09-01T00:00:00.000Z');

    const original = getConsent(driver, CONSENT.id);
    expect(original?.revokedAt).toBeNull();

    const revocation = getConsent(driver, 'consent-1-revoked');
    expect(revocation?.revokedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(revocation?.supersedes).toBe(CONSENT.id);
  });
});

describe('INV-10 — no child data without a consent record', () => {
  let driver: SqliteDriver;

  beforeEach(() => {
    driver = createNodeSqliteDriver();
    migrate(driver);
  });

  it('refuses to create a child whose consent does not exist', () => {
    expect(() => createChildProfile(driver, CHILD)).toThrow(/FOREIGN KEY/i);
    expect(getChildProfile(driver, CHILD.id)).toBeNull();
  });

  it('allows the child once consent is recorded', () => {
    appendConsent(driver, CONSENT);
    createChildProfile(driver, CHILD);
    expect(getChildProfile(driver, CHILD.id)).not.toBeNull();
  });

  /**
   * Erasure must not depend on remembering to list every table. Because all
   * child-scoped tables cascade from `child_profile`, which cascades from
   * `consent_record`, a table added later is covered automatically.
   */
  it('erasing consent erases every trace of the child', () => {
    appendConsent(driver, CONSENT);
    createChildProfile(driver, CHILD);
    upsertMastery(driver, {
      childId: CHILD.id,
      skillId: 'sprout.addition',
      mastery: 0.5,
      attempts: 4,
      correct: 3,
      avgTimeMs: 5000,
      hintsUsed: 1,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(listMastery(driver, CHILD.id)).toHaveLength(1);

    eraseConsent(driver, CONSENT.id);

    expect(getChildProfile(driver, CHILD.id)).toBeNull();
    expect(listMastery(driver, CHILD.id)).toHaveLength(0);
    expect(loadLevelState(driver, CHILD.id)).toBeNull();

    // Nothing child-scoped survives anywhere in the schema.
    const childScoped = ['child_profile', 'level_state', 'mastery', 'progress', 'settings'];
    for (const table of childScoped) {
      const rows = driver.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect(rows[0]?.n, `${table} still holds rows`).toBe(0);
    }
  });
});
