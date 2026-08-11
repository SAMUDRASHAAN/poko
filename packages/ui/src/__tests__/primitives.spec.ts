import { describe, expect, it } from 'vitest';

import { ACCESSIBILITY_VARIANTS, checkVariantCoverage } from '../accessibility.js';
import {
  PRIMITIVE_CATALOG,
  buildPrimitiveRenderPlan,
  getPrimitiveDefinition,
  type PrimitiveCategory,
  type PrimitiveName,
} from '../primitives.js';
import { touch } from '../tokens.js';

const EXPECTED: Readonly<Record<PrimitiveCategory, readonly PrimitiveName[]>> = {
  layout: ['Stack', 'Inline', 'Box', 'SafeArea'],
  typography: ['Text', 'Heading', 'NumberDisplay'],
  actions: ['Button', 'IconButton', 'AudioButton', 'Toggle'],
  containers: ['Card', 'Sheet', 'Dialog', 'Banner'],
  feedback: ['ProgressBar', 'Spinner', 'Badge', 'Toast'],
  identity: ['Avatar', 'Icon', 'OperationMark'],
  accessibility: ['SpokenLabel', 'FocusRing', 'HitTarget'],
};

describe('Phase 2 primitive catalog', () => {
  it('contains exactly the §1.5 component inventory', () => {
    for (const [category, names] of Object.entries(EXPECTED)) {
      expect(
        PRIMITIVE_CATALOG.filter((definition) => definition.category === category).map(
          (definition) => definition.name,
        ),
        category,
      ).toEqual(names);
    }
    expect(PRIMITIVE_CATALOG).toHaveLength(25);
  });

  it('has no duplicate primitive names', () => {
    const names = PRIMITIVE_CATALOG.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every child-zone interactive primitive the INV-14 minimum', () => {
    const interactive = PRIMITIVE_CATALOG.filter((definition) => definition.interactive);
    expect(interactive.map((definition) => definition.name)).toEqual([
      'Button',
      'IconButton',
      'AudioButton',
      'Toggle',
      'HitTarget',
    ]);
    for (const definition of interactive) {
      expect(definition.minimumHitSize, definition.name).toBe(touch.min);
    }
  });

  it('requires explicit labels for icon-only and audio-led controls', () => {
    expect(getPrimitiveDefinition('IconButton').accessibleName).toBe('required-prop');
    expect(getPrimitiveDefinition('AudioButton').accessibleName).toBe('required-prop');
    expect(getPrimitiveDefinition('Icon').accessibleName).toBe('decorative-by-default');
  });
});

describe('variant render plans', () => {
  it('renders every primitive through the complete canonical matrix', () => {
    for (const definition of PRIMITIVE_CATALOG) {
      const plan = buildPrimitiveRenderPlan(definition.name);
      expect(plan).toHaveLength(ACCESSIBILITY_VARIANTS.length);
      expect(
        checkVariantCoverage(plan.map((fixture) => fixture.variant)).complete,
        definition.name,
      ).toBe(true);
    }
  });

  it('carries resolved preferences into each fixture', () => {
    const plan = buildPrimitiveRenderPlan('OperationMark');
    const colourVision = plan.find((fixture) => fixture.variant === 'colour-vision');
    const largeText = plan.find((fixture) => fixture.variant === 'large-text-1.6x');

    expect(colourVision?.preferences.colourVision).toBe(true);
    expect(largeText?.preferences.textScale).toBeGreaterThan(1);
  });

  it('uses the canonical intent text as the fixture description', () => {
    const reducedMotion = buildPrimitiveRenderPlan('Spinner').find(
      (fixture) => fixture.variant === 'reduced-motion',
    );
    expect(reducedMotion?.intent).toMatch(/never removed|still present/i);
  });
});
