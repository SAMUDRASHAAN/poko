import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createInitialState } from '../generator.js';
import { updateMasteryModel } from '../mastery.js';
import { restoreState, serialiseState } from '../serialisation.js';
import type { Mastery } from '../types.js';
import { BAND, RULES } from './fixtures.js';

describe('serialisation [INV-7]', () => {
  it('is lossless for arbitrary generated states', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const state = createInitialState(seed, RULES, BAND);
        expect(restoreState(serialiseState(state))).toEqual(state);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects malformed blobs', () => {
    expect(() => restoreState('not-json')).toThrow();
    expect(() => restoreState('{}')).toThrow();
  });
});

describe('mastery update', () => {
  const mastery: Mastery = {
    skillId: 'addition',
    mastery: 0.5,
    attempts: 4,
    correct: 3,
    avgTimeMs: 4000,
    hintsUsed: 1,
    nextReviewInDays: 2,
  };

  it('rewards correct fluent attempts and accounts for hints', () => {
    const fluent = updateMasteryModel(mastery, {
      skillId: 'addition',
      correct: true,
      timeMs: 2000,
      expectedTimeMs: 4000,
      hintUsed: false,
    });
    const hinted = updateMasteryModel(mastery, {
      skillId: 'addition',
      correct: true,
      timeMs: 2000,
      expectedTimeMs: 4000,
      hintUsed: true,
    });
    expect(fluent.mastery).toBeGreaterThan(mastery.mastery);
    expect(hinted.mastery).toBeLessThan(fluent.mastery);
    expect(fluent.attempts).toBe(5);
    expect(fluent.correct).toBe(4);
  });

  it('rejects attempts for another skill', () => {
    expect(() =>
      updateMasteryModel(mastery, {
        skillId: 'subtraction',
        correct: false,
        timeMs: 1,
        expectedTimeMs: 1,
        hintUsed: false,
      }),
    ).toThrow();
  });

  it('handles incorrect and zero-duration evidence across review bands', () => {
    const weak = updateMasteryModel(
      { ...mastery, mastery: 0.2 },
      {
        skillId: 'addition',
        correct: false,
        timeMs: 0,
        expectedTimeMs: 0,
        hintUsed: false,
      },
    );
    expect(weak.correct).toBe(mastery.correct);
    expect(weak.nextReviewInDays).toBe(1);
    expect(
      updateMasteryModel(
        { ...mastery, mastery: 0.9 },
        {
          skillId: 'addition',
          correct: true,
          timeMs: 1,
          expectedTimeMs: 10,
          hintUsed: false,
        },
      ).nextReviewInDays,
    ).toBe(7);
  });
});
