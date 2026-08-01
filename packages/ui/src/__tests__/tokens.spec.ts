import { describe, expect, it } from 'vitest';

import {
  motion,
  operationColour,
  operationGlyph,
  operationShape,
  tokens,
  touch,
} from '../tokens.js';

describe('frozen UI tokens', () => {
  it('encodes every operation redundantly with colour, shape, and glyph', () => {
    const operations = ['add', 'sub', 'mul', 'div', 'wild'] as const;

    for (const operation of operations) {
      expect(operationColour[operation]).toBeTruthy();
      expect(operationShape[operation]).toBeTruthy();
      expect(operationGlyph[operation]).toBeTruthy();
    }

    expect(new Set(Object.values(operationColour))).toHaveLength(operations.length);
    expect(new Set(Object.values(operationShape))).toHaveLength(operations.length);
    expect(new Set(Object.values(operationGlyph))).toHaveLength(operations.length);
  });

  it('keeps child touch targets at or above the 64px floor', () => {
    expect(touch.min).toBeGreaterThanOrEqual(64);
  });

  it('keeps reduced motion bounded and exposes the complete token surface', () => {
    expect(motion.reduced).toBeLessThanOrEqual(motion.maxInputBlockMs);
    expect(tokens).toMatchObject({
      touch,
      motion,
      operationColour,
      operationShape,
      operationGlyph,
    });
  });
});
