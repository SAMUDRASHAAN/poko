import { colour, outline, radius, space } from './tokens.js';
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from './variant-preferences.js';

export type LayoutPrimitive = 'Stack' | 'Inline' | 'Box' | 'SafeArea';
export type LayoutDirection = 'column' | 'row' | 'row-reverse';
export type LayoutAlignment = 'start' | 'center' | 'end' | 'stretch';
export type LayoutJustification = 'start' | 'center' | 'end' | 'between';

export type LayoutAppearanceOptions = {
  readonly gap?: number;
  readonly padding?: number;
  readonly align?: LayoutAlignment;
  readonly justify?: LayoutJustification;
  readonly mirrorForHandedness?: boolean;
  readonly preferences?: AccessibilityPreferences;
};

export type LayoutAppearance = {
  readonly display: 'flex';
  readonly direction: LayoutDirection;
  readonly gap: number;
  readonly padding: number;
  readonly align: LayoutAlignment;
  readonly justify: LayoutJustification;
};

function spacingToken(value: number, property: string): number {
  if (!(space as readonly number[]).includes(value)) {
    throw new Error(`${property} must be a spacing token`);
  }
  return value;
}

/** Resolve layout without embedding platform-specific flex property names. */
export function resolveLayoutAppearance(
  primitive: LayoutPrimitive,
  options: LayoutAppearanceOptions = {},
): LayoutAppearance {
  const preferences = options.preferences ?? DEFAULT_ACCESSIBILITY_PREFERENCES;
  const defaultGap = primitive === 'Stack' || primitive === 'Inline' ? space[4] : space[0];
  const defaultPadding = primitive === 'SafeArea' ? space[4] : space[0];
  const mirrors =
    primitive === 'Inline' &&
    options.mirrorForHandedness === true &&
    preferences.handedness === 'left';

  return {
    display: 'flex',
    direction: primitive === 'Inline' ? (mirrors ? 'row-reverse' : 'row') : 'column',
    gap: spacingToken(options.gap ?? defaultGap, 'gap'),
    padding: spacingToken(options.padding ?? defaultPadding, 'padding'),
    align: options.align ?? 'stretch',
    justify: options.justify ?? 'start',
  };
}

export type SurfacePrimitive = 'Card' | 'Sheet' | 'Dialog' | 'Banner';
export type SurfaceZone = 'child' | 'parent';

export type SurfaceAppearanceOptions = {
  readonly zone?: SurfaceZone;
  readonly preferences?: AccessibilityPreferences;
};

export type SurfaceAppearance = {
  readonly backgroundColour: string;
  readonly borderColour: string;
  readonly borderWidth: number;
  readonly borderRadius: number;
  readonly padding: number;
};

const SURFACE_GEOMETRY: Readonly<
  Record<SurfacePrimitive, Pick<SurfaceAppearance, 'borderRadius' | 'padding'>>
> = {
  Card: { borderRadius: radius.card, padding: space[4] },
  Sheet: { borderRadius: radius.sheet, padding: space[5] },
  Dialog: { borderRadius: radius.sheet, padding: space[5] },
  Banner: { borderRadius: radius.card, padding: space[4] },
};

export function resolveSurfaceAppearance(
  primitive: SurfacePrimitive,
  options: SurfaceAppearanceOptions = {},
): SurfaceAppearance {
  const preferences = options.preferences ?? DEFAULT_ACCESSIBILITY_PREFERENCES;
  const parent = options.zone === 'parent';
  const childBackground =
    primitive === 'Sheet' || primitive === 'Banner' ? colour.foam : colour.sand;

  return {
    ...SURFACE_GEOMETRY[primitive],
    backgroundColour: parent ? colour.parentMist : childBackground,
    borderColour: parent ? colour.parentSlate : colour.deep,
    borderWidth:
      preferences.highContrast || preferences.colourVision ? outline.strong : outline.standard,
  };
}

export type ProgressRange = {
  readonly min: number;
  readonly now: number;
  readonly max: number;
};

export type ProgressAppearance = {
  readonly fraction: number;
  readonly trackColour: string;
  readonly fillColour: string;
  readonly borderColour: string;
  readonly borderWidth: number;
  readonly height: number;
  readonly borderRadius: number;
};

export function resolveProgressAppearance(
  range: ProgressRange,
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): ProgressAppearance {
  if (range.max <= range.min || range.now < range.min || range.now > range.max) {
    throw new Error('Progress value must be inside a non-empty range');
  }

  return {
    fraction: (range.now - range.min) / (range.max - range.min),
    trackColour: colour.foam,
    fillColour: colour.tide,
    borderColour: colour.deep,
    borderWidth:
      preferences.highContrast || preferences.colourVision ? outline.strong : outline.standard,
    height: space[3],
    borderRadius: radius.pill,
  };
}

export type SpinnerAppearance = {
  readonly size: number;
  readonly strokeWidth: number;
  readonly colour: string;
  readonly durationMs: number;
};

export function resolveSpinnerAppearance(
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): SpinnerAppearance {
  return {
    size: space[6],
    strokeWidth: preferences.highContrast ? outline.strong : outline.standard,
    colour: colour.tide,
    durationMs: preferences.transitionDurationMs,
  };
}

export type BadgeAppearance = {
  readonly minHeight: number;
  readonly paddingHorizontal: number;
  readonly borderRadius: number;
  readonly backgroundColour: string;
  readonly foregroundColour: string;
};

export function resolveBadgeAppearance(): BadgeAppearance {
  return {
    minHeight: space[6],
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    backgroundColour: colour.foam,
    foregroundColour: colour.deep,
  };
}

export type ToastAppearance = {
  readonly backgroundColour: string;
  readonly foregroundColour: string;
  readonly padding: number;
  readonly borderRadius: number;
  readonly durationMs: number;
};

export function resolveToastAppearance(
  preferences: AccessibilityPreferences = DEFAULT_ACCESSIBILITY_PREFERENCES,
): ToastAppearance {
  return {
    backgroundColour: colour.deep,
    foregroundColour: colour.sand,
    padding: space[4],
    borderRadius: radius.card,
    durationMs: preferences.transitionDurationMs,
  };
}
