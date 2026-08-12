import { describe, expect, it } from 'vitest';

import { resolveOperationAppearance, type Operation } from '../operation-appearance.js';
import { resolveVariantPreferences } from '../variant-preferences.js';
import {
  operationColour,
  operationGlyph,
  operationPattern,
  operationShape,
  outline,
} from '../tokens.js';

const OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul', 'div', 'wild'];

describe('operation appearance', () => {
  it('uses the frozen redundant colour, shape and glyph tokens', () => {
    for (const operation of OPERATIONS) {
      expect(resolveOperationAppearance(operation)).toMatchObject({
        operation,
        colour: operationColour[operation],
        shape: operationShape[operation],
        glyph: operationGlyph[operation],
      });
    }
  });

  it('uses the standard outline and no pattern at baseline', () => {
    for (const operation of OPERATIONS) {
      expect(resolveOperationAppearance(operation)).toMatchObject({
        pattern: null,
        outlineWidth: outline.standard,
      });
    }
  });

  it('adds a unique pattern and strong outline in colour-vision mode', () => {
    const preferences = resolveVariantPreferences('colour-vision');
    const appearances = OPERATIONS.map((operation) =>
      resolveOperationAppearance(operation, preferences),
    );

    expect(appearances.map((appearance) => appearance.pattern)).toEqual(
      OPERATIONS.map((operation) => operationPattern[operation]),
    );
    expect(new Set(appearances.map((appearance) => appearance.pattern)).size).toBe(
      OPERATIONS.length,
    );
    for (const appearance of appearances) {
      expect(appearance.outlineWidth).toBe(outline.strong);
    }
  });

  it('uses a strong outline without inventing a pattern in high-contrast mode', () => {
    const appearance = resolveOperationAppearance(
      'add',
      resolveVariantPreferences('high-contrast'),
    );
    expect(appearance.outlineWidth).toBe(outline.strong);
    expect(appearance.pattern).toBeNull();
  });
});
