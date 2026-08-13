import { describe, expect, it } from 'vitest';

import { ACCESSIBILITY_VARIANTS } from '../accessibility.js';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  resolveVariantPreferences,
} from '../variant-preferences.js';
import { accessibility, font, motion } from '../tokens.js';

describe('accessibility variant preferences', () => {
  it('resolves every variant in the canonical matrix', () => {
    for (const variant of ACCESSIBILITY_VARIANTS) {
      expect(resolveVariantPreferences(variant), variant).toBeDefined();
    }
  });

  it('keeps the baseline tied to tokens', () => {
    expect(DEFAULT_ACCESSIBILITY_PREFERENCES).toEqual({
      textScale: accessibility.textScale.base,
      transitionDurationMs: motion.base,
      highContrast: false,
      colourVision: false,
      handedness: 'right',
      bodyFont: font.body,
      screenReader: false,
      audio: { music: true, effects: true, spokenOutput: true },
    });
  });

  it('applies both specified large-text scales', () => {
    expect(resolveVariantPreferences('large-text-1.3x').textScale).toBe(
      accessibility.textScale.large,
    );
    expect(resolveVariantPreferences('large-text-1.6x').textScale).toBe(
      accessibility.textScale.extraLarge,
    );
  });

  it('shortens reduced motion without removing transition feedback', () => {
    expect(resolveVariantPreferences('reduced-motion').transitionDurationMs).toBe(motion.reduced);
    expect(motion.reduced).toBeGreaterThan(0);
  });

  it('selects the contrast, colour-vision, handedness, font and reader flags independently', () => {
    expect(resolveVariantPreferences('high-contrast')).toMatchObject({
      highContrast: true,
      colourVision: false,
    });
    expect(resolveVariantPreferences('colour-vision')).toMatchObject({
      highContrast: false,
      colourVision: true,
    });
    expect(resolveVariantPreferences('left-handed').handedness).toBe('left');
    expect(resolveVariantPreferences('dyslexia-font').bodyFont).toBe(font.dyslexic);
    expect(resolveVariantPreferences('screen-reader').screenReader).toBe(true);
  });

  it('maps each audio fixture to the intended channels', () => {
    expect(resolveVariantPreferences('audio-mute').audio).toEqual({
      music: false,
      effects: false,
      spokenOutput: false,
    });
    expect(resolveVariantPreferences('audio-music-only').audio).toEqual({
      music: true,
      effects: false,
      spokenOutput: false,
    });
    expect(resolveVariantPreferences('audio-effects-only').audio).toEqual({
      music: false,
      effects: true,
      spokenOutput: false,
    });
    expect(resolveVariantPreferences('audio-spoken-output-off').audio).toEqual({
      music: true,
      effects: true,
      spokenOutput: false,
    });
  });

  it('does not mutate the shared baseline while resolving a variant', () => {
    resolveVariantPreferences('audio-mute');
    expect(DEFAULT_ACCESSIBILITY_PREFERENCES.audio).toEqual({
      music: true,
      effects: true,
      spokenOutput: true,
    });
  });
});
