/**
 * FROZEN CONTRACT — the only source of visual values in the system. [INV-13]
 *
 * ESLint bans hex literals everywhere else. Additions here are allowed;
 * changing an existing token requires an ADR.
 */

export const colour = {
  // Operation colours — luminance-separated so they survive deuteranopia
  // and protanopia before shape coding is even applied.
  coral: '#FF6B5B',
  marine: '#2E8FD6',
  kelp: '#3FBF87',
  sunfish: '#FFC531',
  violet: '#9B6BE8',
  // Surfaces and text
  deep: '#12324F',
  sand: '#FFF6E9',
  foam: '#E6F4FB',
  tide: '#0E7C9B',
  // Parent zone — deliberately a different world. A child glancing at a parent
  // screen should instantly read "not mine".
  parentTeal: '#0F766E',
  parentSlate: '#334155',
  parentMist: '#F1F5F9',
} as const;

/** Colour carries the operation; shape and glyph carry it redundantly. */
export const operationColour = {
  add: colour.coral,
  sub: colour.marine,
  mul: colour.kelp,
  div: colour.sunfish,
  wild: colour.violet,
} as const;

export const operationShape = {
  add: 'roundedSquare',
  sub: 'circle',
  mul: 'hexagon',
  div: 'diamond',
  wild: 'star',
} as const;

export const operationGlyph = {
  add: '+',
  sub: '\u2212',
  mul: '\u00D7',
  div: '\u00F7',
  wild: '\u2726',
} as const;

/** Pattern coding used when colour-vision support is enabled. */
export const operationPattern = {
  add: 'dots',
  sub: 'waves',
  mul: 'crosshatch',
  div: 'diagonal',
  wild: 'burst',
} as const;

export const space = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;

export const radius = { tile: 8, card: 16, sheet: 24, pill: 999 } as const;

export const outline = { standard: 2, strong: 4, focus: 4 } as const;

export const opacity = { full: 1, disabled: 0.48 } as const;

export const icon = { small: 24, medium: 32, large: 48 } as const;

export const type = {
  /** Always the largest type in the app. Never demote it. */
  target: 56,
  tile: 34,
  preview: 28,
  h1: 24,
  body: 17,
  caption: 14,
} as const;

export const font = {
  display: 'Baloo2-ExtraBold',
  body: 'Nunito-SemiBold',
  bodyBold: 'Nunito-ExtraBold',
  dyslexic: 'Lexend-Regular',
} as const;

/** Hard floor for any interactive element in the child zone. [INV-14] */
export const touch = { min: 64 } as const;

export const motion = {
  fast: 120,
  base: 260,
  slow: 450,
  /** Every duration collapses to this when reduced motion is on. */
  reduced: 100,
  /** No animation may block input for longer than this. */
  maxInputBlockMs: 300,
} as const;

/** Text scaling values exercised by the mandatory accessibility fixtures. */
export const accessibility = {
  textScale: {
    base: 1,
    large: 1.3,
    extraLarge: 1.6,
  },
} as const;

export const tokens = {
  colour,
  operationColour,
  operationShape,
  operationGlyph,
  operationPattern,
  space,
  radius,
  outline,
  opacity,
  icon,
  type,
  font,
  touch,
  motion,
  accessibility,
} as const;

export type Tokens = typeof tokens;
