import { resolveOperationAppearance, type Operation } from './operation-appearance.js';
import {
  resolveInteractionAppearance,
  type StateIndicator,
  type VisualState,
} from './primitive-appearance.js';
import { colour, icon, outline, radius, touch } from './tokens.js';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from './variant-preferences.js';

export type AvatarAppearance = {
  readonly width: number;
  readonly height: number;
  readonly borderRadius: number;
  readonly backgroundColour: string;
  readonly borderColour: string;
  readonly borderWidth: number;
  readonly indicator: StateIndicator;
};

export function resolveAvatarAppearance(
  state: Extract<VisualState, 'default' | 'focused' | 'selected' | 'disabled'> = 'default',
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): AvatarAppearance {
  const interaction = resolveInteractionAppearance(state, preferences);
  return {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.pill,
    backgroundColour: colour.foam,
    borderColour: colour.deep,
    borderWidth: interaction.outlineWidth,
    indicator: interaction.indicator,
  };
}

export type IconSize = keyof typeof icon;

export type IconAppearance = {
  readonly size: number;
  readonly colour: string;
};

export function resolveIconAppearance(size: IconSize = 'medium'): IconAppearance {
  return { size: icon[size], colour: colour.deep };
}

export type OperationMarkAppearance = ReturnType<typeof resolveOperationAppearance> & {
  readonly size: number;
};

export function resolveOperationMarkAppearance(
  operation: Operation,
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): OperationMarkAppearance {
  return {
    size: icon.large,
    ...resolveOperationAppearance(operation, preferences),
  };
}

export type FocusRingAppearance = {
  readonly borderWidth: number;
  readonly borderColour: string;
  readonly borderRadius: number;
};

export function resolveFocusRingAppearance(
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): FocusRingAppearance {
  return {
    borderWidth: preferences.highContrast ? outline.strong : outline.focus,
    borderColour: colour.deep,
    borderRadius: radius.card,
  };
}

export type HitTargetAppearance = {
  readonly minWidth: number;
  readonly minHeight: number;
};

export function resolveHitTargetAppearance(): HitTargetAppearance {
  return { minWidth: touch.min, minHeight: touch.min };
}
