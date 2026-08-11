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

export type PrimitiveDefinition = {
  readonly name: PrimitiveName;
  readonly category: PrimitiveCategory;
  readonly interactive: boolean;
  readonly accessibleName: AccessibleNamePolicy;
  readonly minimumHitSize?: number;
};

const passive = (
  name: PrimitiveName,
  category: PrimitiveCategory,
  accessibleName: AccessibleNamePolicy,
): PrimitiveDefinition => ({ name, category, interactive: false, accessibleName });

const interactive = (
  name: PrimitiveName,
  category: PrimitiveCategory,
  accessibleName: AccessibleNamePolicy,
): PrimitiveDefinition => ({
  name,
  category,
  interactive: true,
  accessibleName,
  minimumHitSize: touch.min,
});

/** The exact reusable, game-agnostic inventory from build plan §1.5. */
export const PRIMITIVE_CATALOG: readonly PrimitiveDefinition[] = [
  passive('Stack', 'layout', 'container'),
  passive('Inline', 'layout', 'container'),
  passive('Box', 'layout', 'container'),
  passive('SafeArea', 'layout', 'container'),
  passive('Text', 'typography', 'content'),
  passive('Heading', 'typography', 'content'),
  passive('NumberDisplay', 'typography', 'content'),
  interactive('Button', 'actions', 'content'),
  interactive('IconButton', 'actions', 'required-prop'),
  interactive('AudioButton', 'actions', 'required-prop'),
  interactive('Toggle', 'actions', 'required-prop'),
  passive('Card', 'containers', 'container'),
  passive('Sheet', 'containers', 'container'),
  passive('Dialog', 'containers', 'required-prop'),
  passive('Banner', 'containers', 'content'),
  passive('ProgressBar', 'feedback', 'required-prop'),
  passive('Spinner', 'feedback', 'required-prop'),
  passive('Badge', 'feedback', 'content'),
  passive('Toast', 'feedback', 'content'),
  passive('Avatar', 'identity', 'required-prop'),
  passive('Icon', 'identity', 'decorative-by-default'),
  passive('OperationMark', 'identity', 'required-prop'),
  passive('SpokenLabel', 'accessibility', 'content'),
  passive('FocusRing', 'accessibility', 'decorative-by-default'),
  interactive('HitTarget', 'accessibility', 'required-prop'),
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
