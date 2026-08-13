import { describe, expect, it } from 'vitest';

import {
  resolveBadgeAppearance,
  resolveLayoutAppearance,
  resolveProgressAppearance,
  resolveSpinnerAppearance,
  resolveSurfaceAppearance,
  resolveToastAppearance,
} from '../surface-appearance.js';
import { resolveVariantPreferences } from '../variant-preferences.js';
import { colour, motion, outline, radius, space } from '../tokens.js';

describe('layout appearances', () => {
  it('maps Stack, Inline, Box and SafeArea to token-backed flex layouts', () => {
    expect(resolveLayoutAppearance('Stack')).toMatchObject({
      direction: 'column',
      gap: space[4],
      padding: space[0],
    });
    expect(resolveLayoutAppearance('Inline')).toMatchObject({
      direction: 'row',
      gap: space[4],
    });
    expect(resolveLayoutAppearance('Box')).toMatchObject({
      direction: 'column',
      gap: space[0],
      padding: space[0],
    });
    expect(resolveLayoutAppearance('SafeArea')).toMatchObject({
      direction: 'column',
      padding: space[4],
    });
  });

  it('accepts only values from the spacing scale', () => {
    expect(resolveLayoutAppearance('Stack', { gap: space[5], padding: space[3] })).toMatchObject({
      gap: space[5],
      padding: space[3],
    });
    expect(() => resolveLayoutAppearance('Stack', { gap: 13 })).toThrow(/spacing token/i);
  });

  it('mirrors only opt-in inline affordances for left-handed reach', () => {
    const preferences = resolveVariantPreferences('left-handed');
    expect(resolveLayoutAppearance('Inline', { preferences }).direction).toBe('row');
    expect(
      resolveLayoutAppearance('Inline', { preferences, mirrorForHandedness: true }).direction,
    ).toBe('row-reverse');
    expect(
      resolveLayoutAppearance('Stack', { preferences, mirrorForHandedness: true }).direction,
    ).toBe('column');
  });
});

describe('container appearances', () => {
  it('uses the canonical card and sheet geometry', () => {
    expect(resolveSurfaceAppearance('Card')).toMatchObject({
      backgroundColour: colour.sand,
      borderRadius: radius.card,
      padding: space[4],
    });
    expect(resolveSurfaceAppearance('Sheet')).toMatchObject({
      backgroundColour: colour.foam,
      borderRadius: radius.sheet,
      padding: space[5],
    });
    expect(resolveSurfaceAppearance('Dialog').borderRadius).toBe(radius.sheet);
    expect(resolveSurfaceAppearance('Banner').borderRadius).toBe(radius.card);
  });

  it('keeps parent surfaces visually distinct', () => {
    expect(resolveSurfaceAppearance('Card', { zone: 'parent' })).toMatchObject({
      backgroundColour: colour.parentMist,
      borderColour: colour.parentSlate,
    });
  });

  it('strengthens borders in high-contrast mode', () => {
    expect(
      resolveSurfaceAppearance('Card', {
        preferences: resolveVariantPreferences('high-contrast'),
      }).borderWidth,
    ).toBe(outline.strong);
  });
});

describe('feedback appearances', () => {
  it('normalises progress and preserves an explicit structural fill', () => {
    expect(resolveProgressAppearance({ min: 0, now: 3, max: 5 })).toMatchObject({
      fraction: 0.6,
      trackColour: colour.foam,
      fillColour: colour.tide,
      borderWidth: outline.standard,
      height: space[3],
    });
  });

  it('rejects invalid progress ranges', () => {
    expect(() => resolveProgressAppearance({ min: 5, now: 5, max: 5 })).toThrow(/range/i);
    expect(() => resolveProgressAppearance({ min: 0, now: 6, max: 5 })).toThrow(/range/i);
  });

  it('keeps spinner feedback under reduced motion', () => {
    const appearance = resolveSpinnerAppearance(resolveVariantPreferences('reduced-motion'));
    expect(appearance.durationMs).toBe(motion.reduced);
    expect(appearance.durationMs).toBeGreaterThan(0);
    expect(appearance.size).toBe(space[6]);
  });

  it('uses token-backed badge and toast surfaces', () => {
    expect(resolveBadgeAppearance()).toMatchObject({
      minHeight: space[6],
      paddingHorizontal: space[2],
      borderRadius: radius.pill,
    });
    expect(resolveToastAppearance()).toMatchObject({
      backgroundColour: colour.deep,
      foregroundColour: colour.sand,
      padding: space[4],
      borderRadius: radius.card,
      durationMs: motion.base,
    });
  });
});
