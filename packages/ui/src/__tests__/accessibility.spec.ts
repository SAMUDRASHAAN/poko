/**
 * Accessibility variant matrix tests.
 *
 * These guard the list itself and the coverage rule. Rendering a component under
 * each variant is a separate, later concern — see the note in `accessibility.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  ACCESSIBILITY_VARIANTS,
  VARIANT_INTENT,
  checkVariantCoverage,
  describeMissingVariants,
} from '../accessibility.js';

describe('the matrix matches the experience spec', () => {
  /**
   * `01-experience-spec.md` §5 lists eight families; two of them expand into
   * multiple variants (text at 1.3x and 1.6x, four audio combinations). If this
   * count changes, the accessibility contract changed and the spec should have
   * changed with it.
   */
  it('covers every family in spec §5', () => {
    for (const required of [
      'large-text-1.3x',
      'large-text-1.6x',
      'reduced-motion',
      'high-contrast',
      'colour-vision',
      'left-handed',
      'dyslexia-font',
      'screen-reader',
      'audio-mute',
      'audio-music-only',
      'audio-effects-only',
      'audio-spoken-output-off',
    ]) {
      expect(ACCESSIBILITY_VARIANTS).toContain(required);
    }
  });

  it('includes a baseline so the default is verified too', () => {
    expect(ACCESSIBILITY_VARIANTS).toContain('baseline');
  });

  it('has no duplicates', () => {
    expect(new Set(ACCESSIBILITY_VARIANTS).size).toBe(ACCESSIBILITY_VARIANTS.length);
  });

  /** Every variant carries its intent, so an implementer never has to guess. */
  it('documents what each variant means', () => {
    for (const variant of ACCESSIBILITY_VARIANTS) {
      expect(VARIANT_INTENT[variant], variant).toBeTruthy();
      expect(VARIANT_INTENT[variant].length, variant).toBeGreaterThan(10);
    }
  });

  /** Spec §5: reduced motion shortens transitions, it does not remove feedback. */
  it('records that reduced motion keeps state feedback', () => {
    expect(VARIANT_INTENT['reduced-motion']).toMatch(/never removed|still present/i);
  });
});

describe('coverage checking', () => {
  it('reports full coverage when everything is declared', () => {
    const coverage = checkVariantCoverage([...ACCESSIBILITY_VARIANTS]);
    expect(coverage.complete).toBe(true);
    expect(coverage.missing).toEqual([]);
  });

  it('names what is missing', () => {
    const coverage = checkVariantCoverage(['baseline', 'reduced-motion']);
    expect(coverage.complete).toBe(false);
    expect(coverage.covered).toEqual(['baseline', 'reduced-motion']);
    expect(coverage.missing).toContain('high-contrast');
    expect(coverage.missing).toContain('screen-reader');
  });

  /**
   * A misspelled variant must not count. Otherwise a typo reads as coverage that
   * was never written, which is worse than an obvious gap.
   */
  it('does not credit an unknown variant name', () => {
    const coverage = checkVariantCoverage(['high-contrats', 'baseline']);
    expect(coverage.covered).toEqual(['baseline']);
    expect(coverage.missing).toContain('high-contrast');
  });

  it('treats nothing declared as nothing covered', () => {
    const coverage = checkVariantCoverage([]);
    expect(coverage.covered).toEqual([]);
    expect(coverage.missing).toHaveLength(ACCESSIBILITY_VARIANTS.length);
  });
});

describe('failure messages', () => {
  it('is empty when coverage is complete', () => {
    expect(describeMissingVariants(checkVariantCoverage([...ACCESSIBILITY_VARIANTS]))).toBe('');
  });

  it('names each gap with its intent', () => {
    const message = describeMissingVariants(checkVariantCoverage(['baseline']));
    expect(message).toMatch(/01-experience-spec §5/);
    expect(message).toMatch(/screen-reader — labels present/);
  });
});
