import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  DivisionByZeroError,
  add,
  div,
  dividesExactly,
  eq,
  fmt,
  frac,
  gt,
  gte,
  int,
  isInt,
  isNegative,
  isZero,
  lt,
  lte,
  mul,
  sub,
  toNumber,
} from '../num.js';

describe('num — the reason this project does not use floats', () => {
  it('0.1 + 0.2 === 0.3 exactly (the whole point of INV-4)', () => {
    const a = frac(1, 10);
    const b = frac(2, 10);
    expect(eq(add(a, b), frac(3, 10))).toBe(true);
    // For contrast, the reason we do not use `number`:
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('always reduces to lowest terms', () => {
    expect(frac(6, 8)).toEqual({ n: 3, d: 4 });
    expect(frac(-6, -8)).toEqual({ n: 3, d: 4 });
  });

  it('carries sign on the numerator', () => {
    expect(frac(1, -2)).toEqual({ n: -1, d: 2 });
  });

  it('rejects division by zero', () => {
    expect(() => div(int(1), int(0))).toThrow(DivisionByZeroError);
    expect(() => frac(1, 0)).toThrow(DivisionByZeroError);
  });

  it('detects exact division for bands 1-4', () => {
    expect(dividesExactly(int(12), int(4))).toBe(true);
    expect(dividesExactly(int(12), int(5))).toBe(false);
    expect(dividesExactly(int(12), int(0))).toBe(false);
  });

  it('formats for display only', () => {
    expect(fmt(int(13))).toBe('13');
    expect(fmt(frac(3, 4))).toBe('3/4');
  });

  it('compares exact rationals without converting to floats', () => {
    const oneThird = frac(1, 3);
    const oneHalf = frac(1, 2);

    expect(lt(oneThird, oneHalf)).toBe(true);
    expect(lte(oneThird, oneThird)).toBe(true);
    expect(gt(oneHalf, oneThird)).toBe(true);
    expect(gte(oneHalf, oneHalf)).toBe(true);
    expect(isNegative(frac(-1, 2))).toBe(true);
    expect(isZero(frac(0, 9))).toBe(true);
  });

  it('converts to a native number only for rendering and layout', () => {
    expect(toNumber(frac(3, 4))).toBe(0.75);
  });

  it('property: integer arithmetic matches native for safe ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        (a, b) => {
          expect(add(int(a), int(b))).toEqual(int(a + b));
          expect(sub(int(a), int(b))).toEqual(int(a - b));
          expect(mul(int(a), int(b))).toEqual(int(a * b));
        },
      ),
    );
  });

  it('property: a/b*b === a for non-zero b', () => {
    fc.assert(
      fc.property(fc.integer({ min: -200, max: 200 }), fc.integer({ min: 1, max: 200 }), (a, b) => {
        expect(eq(mul(div(int(a), int(b)), int(b)), int(a))).toBe(true);
      }),
    );
  });

  it('property: results are always integers when inputs are', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (a, b) => {
          expect(isInt(add(int(a), int(b)))).toBe(true);
        },
      ),
    );
  });
});
