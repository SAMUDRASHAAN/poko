import { colour, font, opacity, outline, radius, space, touch, type } from './tokens.js';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from './variant-preferences.js';

export type VisualState =
  'default' | 'focused' | 'selected' | 'disabled' | 'loading' | 'offline' | 'error';

export type StateIndicator =
  | 'none'
  | 'focus-ring'
  | 'selection-mark'
  | 'disabled-slash'
  | 'spinner'
  | 'offline-badge'
  | 'error-mark';

export type InteractionAppearance = {
  readonly outlineWidth: number;
  readonly opacity: number;
  readonly indicator: StateIndicator;
  readonly transitionDurationMs: number;
};

const STATE_APPEARANCE: Readonly<
  Record<VisualState, Omit<InteractionAppearance, 'transitionDurationMs'>>
> = {
  default: { outlineWidth: outline.standard, opacity: opacity.full, indicator: 'none' },
  focused: { outlineWidth: outline.focus, opacity: opacity.full, indicator: 'focus-ring' },
  selected: {
    outlineWidth: outline.strong,
    opacity: opacity.full,
    indicator: 'selection-mark',
  },
  disabled: {
    outlineWidth: outline.standard,
    opacity: opacity.disabled,
    indicator: 'disabled-slash',
  },
  loading: { outlineWidth: outline.standard, opacity: opacity.full, indicator: 'spinner' },
  offline: {
    outlineWidth: outline.strong,
    opacity: opacity.full,
    indicator: 'offline-badge',
  },
  error: { outlineWidth: outline.strong, opacity: opacity.full, indicator: 'error-mark' },
};

/** Every interaction state carries a structural signal independent of colour. */
export function resolveInteractionAppearance(
  state: VisualState,
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): InteractionAppearance {
  const appearance = STATE_APPEARANCE[state];
  const needsStrongOutline = preferences.highContrast || preferences.colourVision;
  return {
    ...appearance,
    outlineWidth: needsStrongOutline
      ? Math.max(appearance.outlineWidth, outline.strong)
      : appearance.outlineWidth,
    transitionDurationMs: preferences.transitionDurationMs,
  };
}

export type ActionTone = 'primary' | 'secondary' | 'quiet';

export type ActionAppearance = InteractionAppearance & {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly paddingHorizontal: number;
  readonly borderRadius: number;
  readonly borderColour: string;
  readonly backgroundColour: string;
  readonly foregroundColour: string;
};

const ACTION_COLOUR: Readonly<
  Record<ActionTone, Pick<ActionAppearance, 'backgroundColour' | 'foregroundColour'>>
> = {
  primary: { backgroundColour: colour.tide, foregroundColour: colour.sand },
  secondary: { backgroundColour: colour.foam, foregroundColour: colour.deep },
  quiet: { backgroundColour: colour.sand, foregroundColour: colour.deep },
};

export function resolveActionAppearance(
  tone: ActionTone,
  state: VisualState = 'default',
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): ActionAppearance {
  return {
    ...ACTION_COLOUR[tone],
    ...resolveInteractionAppearance(state, preferences),
    minWidth: touch.min,
    minHeight: touch.min,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderColour: colour.deep,
  };
}

export type TypographyComponent = 'Text' | 'Heading' | 'NumberDisplay';
export type NumberSize = 'target' | 'tile' | 'preview';

export type TypographyAppearanceOptions = {
  readonly preferences?: AccessibilityPreferences;
  readonly numberSize?: NumberSize;
};

export type TypographyAppearance = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly colour: string;
};

function baseTypeSize(component: TypographyComponent, numberSize: NumberSize): number {
  if (component === 'Text') return type.body;
  if (component === 'Heading') return type.h1;
  return type[numberSize];
}

export function resolveTypographyAppearance(
  component: TypographyComponent,
  options: TypographyAppearanceOptions = {},
): TypographyAppearance {
  const preferences = options.preferences ?? DEFAULT_ACCESSIBILITY_PREFERENCES;
  const baseFont = component === 'Text' ? font.body : font.display;
  return {
    fontFamily: preferences.bodyFont === font.dyslexic ? font.dyslexic : baseFont,
    fontSize: baseTypeSize(component, options.numberSize ?? 'preview') * preferences.textScale,
    colour: colour.deep,
  };
}
