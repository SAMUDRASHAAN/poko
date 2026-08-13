import {
  ACCESSIBILITY_VARIANTS,
  VARIANT_INTENT,
  type AccessibilityVariant,
} from './accessibility.js';
import { resolveVariantPreferences, type AccessibilityPreferences } from './variant-preferences.js';
import { touch } from './tokens.js';

export type PrimitiveCategory =
  'layout' | 'typography' | 'actions' | 'containers' | 'feedback' | 'identity' | 'accessibility';

export type PrimitiveName =
  | 'Stack'
  | 'Inline'
  | 'Box'
  | 'SafeArea'
  | 'Text'
  | 'Heading'
  | 'NumberDisplay'
  | 'Button'
  | 'IconButton'
  | 'AudioButton'
  | 'Toggle'
  | 'Card'
  | 'Sheet'
  | 'Dialog'
  | 'Banner'
  | 'ProgressBar'
  | 'Spinner'
  | 'Badge'
  | 'Toast'
  | 'Avatar'
  | 'Icon'
  | 'OperationMark'
  | 'SpokenLabel'
  | 'FocusRing'
  | 'HitTarget';

export type AccessibleNamePolicy =
  'content' | 'required-prop' | 'container' | 'decorative-by-default';

export type SemanticRole =
  | 'none'
  | 'text'
  | 'heading'
  | 'button'
  | 'switch'
  | 'dialog'
  | 'status'
  | 'alert'
  | 'progress'
  | 'image';

export type LiveRegion = 'off' | 'polite' | 'assertive';

export type PrimitiveDefinition = {
  readonly name: PrimitiveName;
  readonly category: PrimitiveCategory;
  readonly interactive: boolean;
  readonly accessibleName: AccessibleNamePolicy;
  readonly semanticRole: SemanticRole;
  readonly liveRegion: LiveRegion;
  readonly minimumHitSize?: number;
};

const passive = (
  name: PrimitiveName,
  category: PrimitiveCategory,
  accessibleName: AccessibleNamePolicy,
  semanticRole: SemanticRole = 'none',
  liveRegion: LiveRegion = 'off',
): PrimitiveDefinition => ({
  name,
  category,
  interactive: false,
  accessibleName,
  semanticRole,
  liveRegion,
});

const interactive = (
  name: PrimitiveName,
  category: PrimitiveCategory,
  accessibleName: AccessibleNamePolicy,
  semanticRole: SemanticRole,
): PrimitiveDefinition => ({
  name,
  category,
  interactive: true,
  accessibleName,
  semanticRole,
  liveRegion: 'off',
  minimumHitSize: touch.min,
});

/** The exact reusable, game-agnostic inventory from build plan §1.5. */
export const PRIMITIVE_CATALOG: readonly PrimitiveDefinition[] = [
  passive('Stack', 'layout', 'container'),
  passive('Inline', 'layout', 'container'),
  passive('Box', 'layout', 'container'),
  passive('SafeArea', 'layout', 'container'),
  passive('Text', 'typography', 'content', 'text'),
  passive('Heading', 'typography', 'content', 'heading'),
  passive('NumberDisplay', 'typography', 'content', 'text'),
  interactive('Button', 'actions', 'content', 'button'),
  interactive('IconButton', 'actions', 'required-prop', 'button'),
  interactive('AudioButton', 'actions', 'required-prop', 'button'),
  interactive('Toggle', 'actions', 'required-prop', 'switch'),
  passive('Card', 'containers', 'container'),
  passive('Sheet', 'containers', 'container', 'dialog'),
  passive('Dialog', 'containers', 'required-prop', 'dialog'),
  passive('Banner', 'containers', 'content', 'status', 'polite'),
  passive('ProgressBar', 'feedback', 'required-prop', 'progress', 'polite'),
  passive('Spinner', 'feedback', 'required-prop', 'status', 'polite'),
  passive('Badge', 'feedback', 'content', 'text'),
  passive('Toast', 'feedback', 'content', 'alert', 'assertive'),
  passive('Avatar', 'identity', 'required-prop', 'image'),
  passive('Icon', 'identity', 'decorative-by-default', 'image'),
  passive('OperationMark', 'identity', 'required-prop', 'image'),
  passive('SpokenLabel', 'accessibility', 'content', 'text'),
  passive('FocusRing', 'accessibility', 'decorative-by-default'),
  interactive('HitTarget', 'accessibility', 'required-prop', 'button'),
];

export function getPrimitiveDefinition(name: PrimitiveName): PrimitiveDefinition {
  const definition = PRIMITIVE_CATALOG.find((candidate) => candidate.name === name);
  if (definition === undefined) {
    throw new Error(`Unknown primitive: ${name}`);
  }
  return definition;
}

export type PrimitiveRenderFixture = {
  readonly primitive: PrimitiveName;
  readonly variant: AccessibilityVariant;
  readonly intent: string;
  readonly preferences: AccessibilityPreferences;
};

/**
 * Fixtures the eventual React Native and web adapters must mount. Producing the
 * complete plan here prevents either renderer from quietly skipping a variant.
 */
export function buildPrimitiveRenderPlan(name: PrimitiveName): readonly PrimitiveRenderFixture[] {
  getPrimitiveDefinition(name);
  return ACCESSIBILITY_VARIANTS.map((variant) => ({
    primitive: name,
    variant,
    intent: VARIANT_INTENT[variant],
    preferences: resolveVariantPreferences(variant),
  }));
}
