import {
  getPrimitiveDefinition,
  type LiveRegion,
  type PrimitiveName,
  type SemanticRole,
} from './primitives.js';

export type NativeAccessibilityRole =
  'none' | 'text' | 'header' | 'button' | 'switch' | 'alert' | 'progressbar' | 'image';

export type NativeAccessibilityState = {
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly checked?: boolean | 'mixed';
  readonly busy?: boolean;
  readonly expanded?: boolean;
};

export type NativeAccessibilityValue = {
  readonly min: number;
  readonly now: number;
  readonly max: number;
  readonly text?: string;
};

export type NativeAccessibilityOptions = {
  readonly label?: string;
  readonly content?: string;
  readonly hint?: string;
  readonly state?: NativeAccessibilityState;
  readonly value?: NativeAccessibilityValue;
};

export type NativeAccessibilityProps = {
  readonly accessible: boolean;
  readonly accessibilityRole: NativeAccessibilityRole;
  readonly accessibilityLiveRegion: 'none' | 'polite' | 'assertive';
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityState?: NativeAccessibilityState;
  readonly accessibilityValue?: NativeAccessibilityValue;
  readonly accessibilityViewIsModal?: boolean;
  readonly accessibilityElementsHidden?: boolean;
  readonly importantForAccessibility?: 'no-hide-descendants';
};

const ROLE_MAP: Readonly<Record<SemanticRole, NativeAccessibilityRole>> = {
  none: 'none',
  text: 'text',
  heading: 'header',
  button: 'button',
  switch: 'switch',
  dialog: 'none',
  status: 'text',
  alert: 'alert',
  progress: 'progressbar',
  image: 'image',
};

const LIVE_REGION_MAP: Readonly<
  Record<LiveRegion, NativeAccessibilityProps['accessibilityLiveRegion']>
> = {
  off: 'none',
  polite: 'polite',
  assertive: 'assertive',
};

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function resolveLabel(
  name: PrimitiveName,
  policy: ReturnType<typeof getPrimitiveDefinition>['accessibleName'],
  options: NativeAccessibilityOptions,
): string | undefined {
  const explicit = nonBlank(options.label);
  const content = nonBlank(options.content);

  if (policy === 'required-prop' && explicit === undefined) {
    throw new Error(`${name} requires a non-empty accessibility label`);
  }
  if (policy === 'content' && explicit === undefined && content === undefined) {
    throw new Error(`${name} requires accessible content or an explicit label`);
  }
  return explicit ?? content;
}

function validateValue(value: NativeAccessibilityValue | undefined): NativeAccessibilityValue {
  if (value === undefined) {
    throw new Error('ProgressBar requires an accessibility value');
  }
  const { min, now, max } = value;
  if (![min, now, max].every(Number.isInteger) || min > now || now > max) {
    throw new Error('ProgressBar accessibility value must be an ordered integer range');
  }
  return value;
}

/**
 * Converts the renderer-neutral primitive contract into React Native 0.85
 * accessibility props. No React Native import is required, so the mapping stays
 * testable before the native dependency batch is authorized.
 */
export function buildNativeAccessibility(
  name: PrimitiveName,
  options: NativeAccessibilityOptions = {},
): NativeAccessibilityProps {
  const definition = getPrimitiveDefinition(name);
  const label = resolveLabel(name, definition.accessibleName, options);
  const hint = nonBlank(options.hint);
  const decorative = definition.accessibleName === 'decorative-by-default' && label === undefined;

  if (name === 'Toggle' && typeof options.state?.checked !== 'boolean') {
    throw new Error('Toggle requires a boolean accessibility checked state');
  }

  const state = name === 'Spinner' ? { busy: true, ...options.state } : options.state;
  const value = name === 'ProgressBar' ? validateValue(options.value) : options.value;
  const accessible =
    !decorative &&
    (definition.accessibleName === 'required-prop' ||
      definition.accessibleName === 'content' ||
      (definition.accessibleName === 'decorative-by-default' && label !== undefined));
  const role = decorative ? 'none' : ROLE_MAP[definition.semanticRole];

  return {
    accessible,
    accessibilityRole: role,
    accessibilityLiveRegion: LIVE_REGION_MAP[definition.liveRegion],
    ...(label === undefined ? {} : { accessibilityLabel: label }),
    ...(hint === undefined ? {} : { accessibilityHint: hint }),
    ...(state === undefined ? {} : { accessibilityState: state }),
    ...(value === undefined ? {} : { accessibilityValue: value }),
    ...(definition.semanticRole === 'dialog' ? { accessibilityViewIsModal: true } : {}),
    ...(decorative
      ? {
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        }
      : {}),
  };
}
