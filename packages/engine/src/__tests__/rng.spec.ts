import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';

describe('rng — determinism is load-bearing [INV-3]', () => {
  it('same seed produces the identical sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 100 }, () => a.int(0, 999));
    const seqB = Array.from({ length: 100 }, () => b.int(0, 999));
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.int(0, 1e6)).not.toBe(b.int(0, 1e6));
  });

  it('survives a zero seed', () => {
    const r = createRng(0);
    expect(Number.isFinite(r.next())).toBe(true);
  });

  it('int() stays in range, inclusive', () => {
    const r = createRng(7);
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('int() rejects an inverted range', () => {
    expect(() => createRng(7).int(9, 3)).toThrow(RangeError);
  });

  it('shuffle is a permutation and does not mutate the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = createRng(99).shuffle(input);
    expect([...out].sort((x, y) => x - y)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('GOLDEN SEED: this sequence must never change without an ADR', () => {
    // If this test fails you have changed board generation for every existing
    // level. That is a breaking change, not a fix. See ARCHITECTURE.md section 11.
    const r = createRng(12345);
    expect(Array.from({ length: 8 }, () => r.int(1, 10))).toEqual([8, 4, 7, 5, 2, 8, 10, 9]);
  });

  it('pick() throws on an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it('exposes resumable deterministic state', () => {
    const rng = createRng(123);
    const initial = rng.state();
    rng.next();
    expect(rng.state()).not.toBe(initial);
  });
});
