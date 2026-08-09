/**
 * INV-14 helper tests.
 *
 * The interesting cases are the ones where a naive check gets it wrong: hit slop
 * making a small button compliant, and an element that forgets to say which zone
 * it is in.
 */
import { describe, expect, it } from 'vitest';

import {
  describeViolations,
  effectiveSize,
  findHitTargetViolations,
  type MeasuredElement,
} from '../hit-target.js';
import { touch } from '../tokens.js';

describe('INV-14 minimum is the frozen token', () => {
  /**
   * `tokens.ts` is frozen and `touch.min` is what INV-14 means in code. If this
   * ever drops below 64 the invariant has been quietly weakened rather than
   * debated, so the number is pinned here as well as in the token.
   */
  it('is 64px and must not be weakened', () => {
    expect(touch.min).toBe(64);
  });
});

describe('effective size counts the hit area, not the visual box', () => {
  it('adds symmetric numeric slop on every edge', () => {
    expect(effectiveSize({ id: 'a', width: 48, height: 48, hitSlop: 8 })).toEqual({
      width: 64,
      height: 64,
    });
  });

  it('adds per-edge slop', () => {
    expect(
      effectiveSize({ id: 'b', width: 40, height: 60, hitSlop: { left: 12, right: 12, top: 2 } }),
    ).toEqual({ width: 64, height: 62 });
  });

  it('treats a missing hitSlop as zero', () => {
    expect(effectiveSize({ id: 'c', width: 64, height: 64 })).toEqual({ width: 64, height: 64 });
  });
});

describe('finding violations', () => {
  /**
   * The case a visual-box-only check gets wrong. Spec §4 constrains the hit area,
   * so a 48px control with 8px slop is compliant and must not be reported.
   */
  it('accepts a small control whose slop brings it up to the minimum', () => {
    const elements: MeasuredElement[] = [{ id: 'hint-button', width: 48, height: 48, hitSlop: 8 }];
    expect(findHitTargetViolations(elements)).toEqual([]);
  });

  it('rejects a control that only looks big enough', () => {
    const violations = findHitTargetViolations([{ id: 'tile', width: 64, height: 40 }]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ id: 'tile', shortfallX: 0, shortfallY: 24 });
  });

  it('reports every violation at once, not just the first', () => {
    const violations = findHitTargetViolations([
      { id: 'a', width: 10, height: 10 },
      { id: 'b', width: 64, height: 64 },
      { id: 'c', width: 20, height: 80 },
    ]);
    expect(violations.map((violation) => violation.id)).toEqual(['a', 'c']);
  });

  /** INV-14 is a child-zone rule; parent controls follow platform minimums. */
  it('exempts parent-zone elements', () => {
    expect(
      findHitTargetViolations([{ id: 'parent-link', width: 30, height: 20, zone: 'parent' }]),
    ).toEqual([]);
  });

  /**
   * An element that forgets to declare its zone is held to the STRICTER rule.
   * Defaulting the other way would let a missing field silently exempt a child
   * control, which is the failure mode worth designing against.
   */
  it('treats an undeclared zone as child', () => {
    const violations = findHitTargetViolations([{ id: 'unlabelled', width: 20, height: 20 }]);
    expect(violations).toHaveLength(1);
  });

  it('honours an explicit minimum override', () => {
    expect(findHitTargetViolations([{ id: 'x', width: 48, height: 48 }], 44)).toEqual([]);
  });

  it('passes an empty set', () => {
    expect(findHitTargetViolations([])).toEqual([]);
  });
});

describe('failure messages', () => {
  it('is empty when nothing is wrong', () => {
    expect(describeViolations([])).toBe('');
  });

  it('names each element, its size and its shortfall', () => {
    const message = describeViolations(
      findHitTargetViolations([{ id: 'tile', width: 30, height: 40 }]),
    );
    expect(message).toMatch(/INV-14/);
    expect(message).toMatch(/tile: 30×40px/);
    expect(message).toMatch(/short by 34×24/);
  });
});
