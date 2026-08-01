/**
 * Black-box contract suite — wt/verify's entry point.
 *
 * Everything here imports from the package ROOT (`@poko/engine`), never a deep
 * path, so this suite exercises exactly the surface a consumer gets. [INV-15]
 *
 * Assertions are limited to facts that hold both while the engine is stubbed and
 * after Phase 1 implements it. Nothing in this file should need deleting at
 * Gate 1 — behaviour of the stubbed functions is deliberately NOT asserted here.
 */
import { describe, expect, it } from 'vitest';
import {
  ONE,
  ZERO,
  add,
  analyse,
  createLevel,
  createRng,
  dispatch,
  div,
  eq,
  fmt,
  frac,
  generatePack,
  int,
  isInt,
  mul,
  restore,
  serialise,
  sub,
  updateMastery,
} from '@poko/engine';

describe('frozen public surface [INV-15]', () => {
  it('exposes every documented entry point as a function', () => {
    const surface = {
      createLevel,
      dispatch,
      serialise,
      restore,
      analyse,
      generatePack,
      updateMastery,
      createRng,
    };
    for (const [name, fn] of Object.entries(surface)) {
      expect(typeof fn, `${name} must be exported from the package root`).toBe('function');
    }
  });

  it('exposes the Num constructors and helpers', () => {
    for (const fn of [int, frac, add, sub, mul, div, eq, isInt, fmt]) {
      expect(typeof fn).toBe('function');
    }
    expect(ZERO).toEqual({ n: 0, d: 1 });
    expect(ONE).toEqual({ n: 1, d: 1 });
  });
});

describe('Num is exact, not floating point [INV-4]', () => {
  it('adds tenths without float drift', () => {
    // The canonical float failure: 0.1 + 0.2 !== 0.3.
    expect(eq(add(frac(1, 10), frac(2, 10)), frac(3, 10))).toBe(true);
  });

  it('always reduces, carrying the sign on the numerator', () => {
    expect(frac(2, 4)).toEqual({ n: 1, d: 2 });
    expect(frac(1, -2)).toEqual({ n: -1, d: 2 });
  });

  it('round-trips integers through fmt', () => {
    expect(fmt(int(7))).toBe('7');
    expect(fmt(frac(3, 4))).toBe('3/4');
    expect(isInt(int(7))).toBe(true);
    expect(isInt(frac(3, 4))).toBe(false);
  });
});

describe('Rng is deterministic in its seed [INV-3]', () => {
  it('produces an identical sequence for an identical seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 32 }, () => a.int(0, 999));
    const seqB = Array.from({ length: 32 }, () => b.int(0, 999));
    expect(seqA).toEqual(seqB);
  });

  it('diverges for different seeds', () => {
    // The generator must be constructed once and then drawn from; building a new
    // one per draw would only ever yield that seed's first value.
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 32 }, () => a.int(0, 999));
    const seqB = Array.from({ length: 32 }, () => b.int(0, 999));
    expect(seqA).not.toEqual(seqB);
  });

  it('shuffle returns a new array and never mutates its input', () => {
    const source = Object.freeze([1, 2, 3, 4, 5]);
    const shuffled = createRng(99).shuffle(source);
    expect(shuffled).not.toBe(source);
    expect([...shuffled].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });
});
