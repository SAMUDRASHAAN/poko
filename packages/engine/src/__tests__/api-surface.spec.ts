import { describe, expect, it } from 'vitest';

import * as engine from '../index.js';

describe('frozen public API [INV-15]', () => {
  it('changes only through a reviewed snapshot diff', () => {
    expect(Object.keys(engine).sort()).toEqual([
      'NotImplementedError',
      'ONE',
      'ZERO',
      'add',
      'analyse',
      'createLevel',
      'createRng',
      'dispatch',
      'div',
      'eq',
      'fmt',
      'frac',
      'generatePack',
      'int',
      'isInt',
      'mul',
      'restore',
      'serialise',
      'sub',
      'updateMastery',
    ]);
  });
});
