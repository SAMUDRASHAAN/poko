/**
 * Exact rational arithmetic for all gameplay values.
 *
 * INV-4: gameplay values NEVER use raw `number`. Floats would make a maths app
 * mark correct answers wrong (0.1 + 0.2 !== 0.3). v1 only produces integers, but
 * every signature already takes `Num`, so Expert mode's fractions and decimals
 * arrive without touching a single call site.
 *
 * See docs/adr/0003-num-type-not-float.md
 */

export type Num = { readonly n: number; readonly d: number };

export class DivisionByZeroError extends Error {
  constructor() {
    super('Division by zero');
    this.name = 'DivisionByZeroError';
  }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/** Always reduced; the sign is always carried by the numerator. */
function reduce(n: number, d: number): Num {
  if (d === 0) throw new DivisionByZeroError();
  const sign = d < 0 ? -1 : 1;
  const sn = n * sign;
  const sd = d * sign;
  const g = gcd(sn, sd) || 1;
  return { n: sn / g, d: sd / g };
}

export const int = (n: number): Num => ({ n, d: 1 });
export const frac = (n: number, d: number): Num => reduce(n, d);
export const ZERO: Num = { n: 0, d: 1 };
export const ONE: Num = { n: 1, d: 1 };

export const add = (a: Num, b: Num): Num => reduce(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Num, b: Num): Num => reduce(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Num, b: Num): Num => reduce(a.n * b.n, a.d * b.d);
export const div = (a: Num, b: Num): Num => {
  if (b.n === 0) throw new DivisionByZeroError();
  return reduce(a.n * b.d, a.d * b.n);
};

export const eq = (a: Num, b: Num): boolean => a.n * b.d === b.n * a.d;
export const lt = (a: Num, b: Num): boolean => a.n * b.d < b.n * a.d;
export const lte = (a: Num, b: Num): boolean => a.n * b.d <= b.n * a.d;
export const gt = (a: Num, b: Num): boolean => a.n * b.d > b.n * a.d;
export const gte = (a: Num, b: Num): boolean => a.n * b.d >= b.n * a.d;

export const isInt = (a: Num): boolean => a.d === 1;
export const isNegative = (a: Num): boolean => a.n < 0;
export const isZero = (a: Num): boolean => a.n === 0;

/** Exact division only: true when a / b leaves no remainder. Bands 1-4 require this. */
export const dividesExactly = (a: Num, b: Num): boolean => {
  if (b.n === 0) return false;
  return isInt(div(a, b));
};

/** Display only. Never parse this back — keep the Num. */
export const fmt = (a: Num): string => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);

/** Escape hatch for rendering and layout maths only. Never for game rules. */
export const toNumber = (a: Num): number => a.n / a.d;
