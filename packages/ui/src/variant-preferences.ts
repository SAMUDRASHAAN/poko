import type { AccessibilityVariant } from './accessibility.js';
import { accessibility, font, motion } from './tokens.js';

export type Handedness = 'left' | 'right';

export type AudioPreferences = {
  readonly music: boolean;
  readonly effects: boolean;
  readonly spokenOutput: boolean;
};

/**
 * Renderer-neutral values applied by the native or web primitive adapter.
 *
 * Keeping this resolution outside React makes the accessibility matrix testable
 * while ADR-0001's physical-device contingency remains open. The eventual
 * renderer consumes this object; it does not reinterpret variant slugs itself.
 */
export type AccessibilityPreferences = {
  readonly textScale: number;
  readonly transitionDurationMs: number;
  readonly highContrast: boolean;
  readonly colourVision: boolean;
  readonly handedness: Handedness;
  readonly bodyFont: string;
  readonly screenReader: boolean;
  readonly audio: AudioPreferences;
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  textScale: accessibility.textScale.base,
  transitionDurationMs: motion.base,
  highContrast: false,
  colourVision: false,
  handedness: 'right',
  bodyFont: font.body,
  screenReader: false,
  audio: { music: true, effects: true, spokenOutput: true },
};

function baseline(): AccessibilityPreferences {
  return {
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    audio: { ...DEFAULT_ACCESSIBILITY_PREFERENCES.audio },
  };
}

/** Resolve one canonical fixture without mutating the shared baseline. */
export function resolveVariantPreferences(variant: AccessibilityVariant): AccessibilityPreferences {
  const preferences = baseline();

  switch (variant) {
    case 'baseline':
      return preferences;
    case 'large-text-1.3x':
      return { ...preferences, textScale: accessibility.textScale.large };
    case 'large-text-1.6x':
      return { ...preferences, textScale: accessibility.textScale.extraLarge };
    case 'reduced-motion':
      return { ...preferences, transitionDurationMs: motion.reduced };
    case 'high-contrast':
      return { ...preferences, highContrast: true };
    case 'colour-vision':
      return { ...preferences, colourVision: true };
    case 'left-handed':
      return { ...preferences, handedness: 'left' };
    case 'dyslexia-font':
      return { ...preferences, bodyFont: font.dyslexic };
    case 'screen-reader':
      return { ...preferences, screenReader: true };
    case 'audio-mute':
      return {
        ...preferences,
        audio: { music: false, effects: false, spokenOutput: false },
      };
    case 'audio-music-only':
      return {
        ...preferences,
        audio: { music: true, effects: false, spokenOutput: false },
      };
    case 'audio-effects-only':
      return {
        ...preferences,
        audio: { music: false, effects: true, spokenOutput: false },
      };
    case 'audio-spoken-output-off':
      return {
        ...preferences,
        audio: { music: true, effects: true, spokenOutput: false },
      };
  }
}
