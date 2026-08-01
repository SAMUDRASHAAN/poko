/**
 * Seeded, deterministic pseudo-randomness.
 *
 * INV-3: every random choice in the system flows through here with an explicit
 * seed. `Math.random()` is banned by ESLint. Determinism is what makes a level a
 * 12-byte seed, makes bugs reproducible, and makes scores server-verifiable.
 *
 * WARNING: changing the algorithm, or the ORDER in which values are consumed,
 * silently changes every existing level. Golden-seed snapshot tests guard this.
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Uniform element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates. Returns a new array; never mutates the input. */
  shuffle<T>(items: readonly T[]): T[];
  /** Current internal state, so generation can be resumed or inspected. */
  state(): number;
};

/** xorshift32 — small, fast, adequate for puzzle generation. Not cryptographic. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // xorshift is degenerate at 0

  const step = (): number => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };

  const next = (): number => step() / 0x100000000;

  const int = (min: number, max: number): number => {
    if (max < min) throw new RangeError(`int(${min}, ${max}): max must be >= min`);
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick() on an empty array');
    return items[int(0, items.length - 1)] as T;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
    }
    return out;
  };

  return { next, int, pick, shuffle, state: () => s };
}
