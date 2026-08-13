import {
  operationColour,
  operationGlyph,
  operationPattern,
  operationShape,
  outline,
} from './tokens.js';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from './variant-preferences.js';

export type Operation = keyof typeof operationColour;

export type OperationAppearance = {
  readonly operation: Operation;
  readonly colour: (typeof operationColour)[Operation];
  readonly shape: (typeof operationShape)[Operation];
  readonly glyph: (typeof operationGlyph)[Operation];
  readonly pattern: (typeof operationPattern)[Operation] | null;
  readonly outlineWidth: number;
};

/**
 * Resolve the redundant visual code shared by tiles and OperationMark.
 * Colour is never the only signal: shape and glyph are always present, with a
 * fourth pattern channel added for the colour-vision fixture.
 */
export function resolveOperationAppearance(
  operation: Operation,
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): OperationAppearance {
  return {
    operation,
    colour: operationColour[operation],
    shape: operationShape[operation],
    glyph: operationGlyph[operation],
    pattern: preferences.colourVision ? operationPattern[operation] : null,
    outlineWidth:
      preferences.colourVision || preferences.highContrast ? outline.strong : outline.standard,
  };
}
