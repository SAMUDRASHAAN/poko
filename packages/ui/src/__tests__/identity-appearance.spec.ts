import { describe, expect, it } from 'vitest';

import {
  resolveAvatarAppearance,
  resolveFocusRingAppearance,
  resolveHitTargetAppearance,
  resolveIconAppearance,
  resolveOperationMarkAppearance,
} from '../identity-appearance.js';
import { resolveVariantPreferences } from '../variant-preferences.js';
import {
  colour,
  icon,
  operationColour,
  operationGlyph,
  operationPattern,
  operationShape,
  outline,
  radius,
  touch,
} from '../tokens.js';

describe('identity appearances', () => {
  it('keeps avatars large enough for a child-zone profile target', () => {
    expect(resolveAvatarAppearance()).toMatchObject({
      width: touch.min,
      height: touch.min,
      borderRadius: radius.pill,
      backgroundColour: colour.foam,
      borderColour: colour.deep,
      borderWidth: outline.standard,
      indicator: 'none',
    });
  });

  it('adds a structural selection marker and strong outline', () => {
    expect(resolveAvatarAppearance('selected')).toMatchObject({
      borderWidth: outline.strong,
      indicator: 'selection-mark',
    });
  });

  it('uses the named icon scale only', () => {
    expect(resolveIconAppearance('small').size).toBe(icon.small);
    expect(resolveIconAppearance('medium').size).toBe(icon.medium);
    expect(resolveIconAppearance('large').size).toBe(icon.large);
  });

  it('resolves an OperationMark through the shared redundant operation coding', () => {
    expect(resolveOperationMarkAppearance('mul')).toMatchObject({
      size: icon.large,
      operation: 'mul',
      colour: operationColour.mul,
      shape: operationShape.mul,
      glyph: operationGlyph.mul,
      pattern: null,
    });
  });

  it('adds the operation pattern in colour-vision mode', () => {
    expect(
      resolveOperationMarkAppearance('div', resolveVariantPreferences('colour-vision')).pattern,
    ).toBe(operationPattern.div);
  });
});

describe('accessibility-helper appearances', () => {
  it('uses the focus token and strengthens it in high contrast', () => {
    expect(resolveFocusRingAppearance()).toMatchObject({
      borderWidth: outline.focus,
      borderColour: colour.deep,
      borderRadius: radius.card,
    });
    expect(resolveFocusRingAppearance(resolveVariantPreferences('high-contrast')).borderWidth).toBe(
      outline.strong,
    );
  });

  it('makes HitTarget enforce the child minimum independently on both axes', () => {
    expect(resolveHitTargetAppearance()).toEqual({
      minWidth: touch.min,
      minHeight: touch.min,
    });
  });
});
