/**
 * The accessibility variant matrix.
 *
 * `01-experience-spec.md` §5: "Every child component and screen is verified
 * under:" — followed by eight families. This file is that list as data, so a
 * component's coverage can be checked mechanically instead of by reading prose
 * and remembering.
 *
 * ## What this is, and what it is not
 *
 * This is the **matrix and the coverage check**. It is not a renderer. Rendering
 * a component under each variant needs React, React Native and the components
 * themselves — none of which exist yet (`packages/ui` currently ships tokens and
 * nothing else, and adding a renderer dependency is an ADR-0001-exposed choice).
 *
 * The split is deliberate and matches `04-release-readiness.md` §3: the
 * measurement lands before the feature. When primitives arrive, the renderer is a
 * thin adapter that walks `ACCESSIBILITY_VARIANTS` and mounts each one; the list
 * it walks, and the rule that the list must be covered exhaustively, are settled
 * here and stay settled whichever renderer wins.
 */

/**
 * The variants every child component must be verified under.
 *
 * Transcribed from `01-experience-spec.md` §5. Changing this list is a change to
 * the accessibility contract, not a refactor.
 */
export const ACCESSIBILITY_VARIANTS = [
  'baseline',
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
] as const;

export type AccessibilityVariant = (typeof ACCESSIBILITY_VARIANTS)[number];

/**
 * What each variant means for a component under test.
 *
 * Kept next to the list so an implementer does not have to infer intent from a
 * slug — `reduced-motion` shortening transitions rather than removing feedback is
 * the sort of thing that gets guessed wrong.
 */
export const VARIANT_INTENT: Readonly<Record<AccessibilityVariant, string>> = {
  baseline: 'default settings, no accessibility option engaged',
  'large-text-1.3x': 'text scaled 1.3x; layout must not clip or overlap',
  'large-text-1.6x': 'text scaled 1.6x; layout must not clip or overlap',
  'reduced-motion':
    'transitions shortened — state feedback is still present, never removed (spec §5)',
  'high-contrast': 'raised contrast; state must not be conveyed by colour alone (spec §4)',
  'colour-vision': 'thicker outlines and pattern fill so hue is never the only signal',
  'left-handed': 'HUD and gesture affordances mirrored for left-handed reach',
  'dyslexia-font': 'Lexend substituted; layout must absorb the metric change',
  'screen-reader': 'labels present and traversal order logical',
  'audio-mute': 'global mute — every audio-led instruction keeps its tap fallback',
  'audio-music-only': 'music on, effects and voice off',
  'audio-effects-only': 'effects on, music and voice off',
  'audio-spoken-output-off': 'spoken output off; instruction still reachable',
};

export type VariantCoverage = {
  readonly covered: readonly AccessibilityVariant[];
  readonly missing: readonly AccessibilityVariant[];
  readonly complete: boolean;
};

/**
 * Compares what a component declares against what the spec requires.
 *
 * Unknown entries are reported as missing coverage rather than ignored: a typo in
 * a variant name would otherwise read as coverage that does not exist.
 */
export function checkVariantCoverage(declared: readonly string[]): VariantCoverage {
  const declaredSet = new Set(declared);
  const covered = ACCESSIBILITY_VARIANTS.filter((variant) => declaredSet.has(variant));
  const missing = ACCESSIBILITY_VARIANTS.filter((variant) => !declaredSet.has(variant));

  return { covered, missing, complete: missing.length === 0 };
}

/** Failure text naming what is missing, for a test's assertion message. */
export function describeMissingVariants(coverage: VariantCoverage): string {
  if (coverage.complete) return '';
  const lines = coverage.missing.map((variant) => `  ${variant} — ${VARIANT_INTENT[variant]}`);
  return `${coverage.missing.length} accessibility variant(s) unverified [01-experience-spec §5]:\n${lines.join('\n')}`;
}
