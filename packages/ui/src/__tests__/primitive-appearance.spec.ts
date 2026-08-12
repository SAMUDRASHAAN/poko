import { describe, expect, it } from 'vitest';

import {
  resolveActionAppearance,
  resolveInteractionAppearance,
  resolveTypographyAppearance,
  type VisualState,
} from '../primitive-appearance.js';
import { resolveVariantPreferences } from '../variant-preferences.js';
import { font, motion, opacity, outline, radius, space, touch, type } from '../tokens.js';

const VISUAL_STATES: readonly VisualState[] = [
  'default',
  'focused',
  'selected',
  'disabled',
  'loading',
  'offline',
  'error',
];

describe('interaction appearances', () => {
  it('gives every required state a unique non-colour indicator', () => {
    const indicators = VISUAL_STATES.map((state) => resolveInteractionAppearance(state).indicator);
    expect(new Set(indicators).size).toBe(VISUAL_STATES.length);
  });

  it('uses tokenized outlines and opacity', () => {
    expect(resolveInteractionAppearance('default')).toMatchObject({
      outlineWidth: outline.standard,
      opacity: opacity.full,
    });
    expect(resolveInteractionAppearance('focused').outlineWidth).toBe(outline.focus);
    expect(resolveInteractionAppearance('selected').outlineWidth).toBe(outline.strong);
    expect(resolveInteractionAppearance('disabled').opacity).toBe(opacity.disabled);
  });

  it('shortens but preserves feedback in reduced-motion mode', () => {
    const appearance = resolveInteractionAppearance(
      'loading',
      resolveVariantPreferences('reduced-motion'),
    );
    expect(appearance.transitionDurationMs).toBe(motion.reduced);
    expect(appearance.transitionDurationMs).toBeGreaterThan(0);
    expect(appearance.indicator).toBe('spinner');
  });
});

describe('action appearances', () => {
  it('keeps every action at the child-zone touch minimum', () => {
    for (const tone of ['primary', 'secondary', 'quiet'] as const) {
      expect(resolveActionAppearance(tone)).toMatchObject({
        minWidth: touch.min,
        minHeight: touch.min,
        paddingHorizontal: space[4],
        borderRadius: radius.pill,
      });
    }
  });

  it('carries interaction state into the action model', () => {
    expect(resolveActionAppearance('primary', 'loading')).toMatchObject({
      indicator: 'spinner',
      transitionDurationMs: motion.base,
    });
    expect(resolveActionAppearance('secondary', 'disabled')).toMatchObject({
      opacity: opacity.disabled,
      indicator: 'disabled-slash',
    });
  });
});

describe('typography appearances', () => {
  it('uses the canonical component sizes and keeps target largest', () => {
    expect(resolveTypographyAppearance('Text').fontSize).toBe(type.body);
    expect(resolveTypographyAppearance('Heading').fontSize).toBe(type.h1);
    expect(resolveTypographyAppearance('NumberDisplay', { numberSize: 'preview' }).fontSize).toBe(
      type.preview,
    );
    expect(resolveTypographyAppearance('NumberDisplay', { numberSize: 'target' }).fontSize).toBe(
      type.target,
    );
    expect(type.target).toBeGreaterThan(Math.max(type.tile, type.preview, type.h1));
  });

  it('applies large-text scaling without changing the source tokens', () => {
    const appearance = resolveTypographyAppearance('Text', {
      preferences: resolveVariantPreferences('large-text-1.6x'),
    });
    expect(appearance.fontSize).toBe(type.body * 1.6);
    expect(type.body).toBe(17);
  });

  it('substitutes Lexend for every text-bearing primitive in dyslexia mode', () => {
    const preferences = resolveVariantPreferences('dyslexia-font');
    for (const component of ['Text', 'Heading', 'NumberDisplay'] as const) {
      expect(resolveTypographyAppearance(component, { preferences }).fontFamily).toBe(
        font.dyslexic,
      );
    }
  });
});
