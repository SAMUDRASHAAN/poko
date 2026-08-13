import { describe, expect, it } from 'vitest';

import { buildNativeAccessibility } from '../native-accessibility.js';

describe('React Native accessibility adapter', () => {
  it('maps content and semantic roles to stable native props', () => {
    expect(buildNativeAccessibility('Button', { content: 'Continue' })).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Continue',
      accessibilityRole: 'button',
      accessibilityLiveRegion: 'none',
    });
    expect(buildNativeAccessibility('Heading', { content: 'Choose a level' })).toMatchObject({
      accessibilityLabel: 'Choose a level',
      accessibilityRole: 'header',
    });
  });

  it('requires explicit labels for icon-only and audio-led actions', () => {
    expect(() => buildNativeAccessibility('IconButton')).toThrow(/IconButton.*label/i);
    expect(() => buildNativeAccessibility('AudioButton', { label: '  ' })).toThrow(
      /AudioButton.*label/i,
    );
    expect(
      buildNativeAccessibility('AudioButton', { label: 'Hear the instruction' }),
    ).toMatchObject({
      accessibilityLabel: 'Hear the instruction',
      accessibilityRole: 'button',
    });
  });

  it('hides decorative images from both native accessibility trees', () => {
    expect(buildNativeAccessibility('Icon')).toEqual({
      accessible: false,
      accessibilityRole: 'none',
      accessibilityLiveRegion: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('promotes a decorative-by-default image when it receives a label', () => {
    expect(buildNativeAccessibility('Icon', { label: 'Treasure chest' })).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Treasure chest',
      accessibilityRole: 'image',
    });
  });

  it('marks sheets and dialogs modal without collapsing their descendants', () => {
    expect(buildNativeAccessibility('Sheet')).toMatchObject({
      accessible: false,
      accessibilityRole: 'none',
      accessibilityViewIsModal: true,
    });
    expect(buildNativeAccessibility('Dialog', { label: 'Pause menu' })).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Pause menu',
      accessibilityViewIsModal: true,
    });
  });

  it('maps polite and assertive live regions', () => {
    expect(buildNativeAccessibility('Banner', { content: 'Saved' }).accessibilityLiveRegion).toBe(
      'polite',
    );
    expect(buildNativeAccessibility('Toast', { content: 'Try that path again' })).toMatchObject({
      accessibilityRole: 'alert',
      accessibilityLiveRegion: 'assertive',
    });
  });

  it('requires and forwards the checked state for toggles', () => {
    expect(() => buildNativeAccessibility('Toggle', { label: 'Music' })).toThrow(/checked/i);
    expect(
      buildNativeAccessibility('Toggle', { label: 'Music', state: { checked: false } }),
    ).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityState: { checked: false },
    });
  });

  it('forwards disabled, selected, busy and expanded state', () => {
    expect(
      buildNativeAccessibility('Button', {
        content: 'Continue',
        state: { disabled: true, selected: true, busy: true, expanded: false },
      }).accessibilityState,
    ).toEqual({ disabled: true, selected: true, busy: true, expanded: false });
  });

  it('requires a valid range value for progress bars', () => {
    expect(() => buildNativeAccessibility('ProgressBar', { label: 'Level progress' })).toThrow(
      /value/i,
    );
    expect(() =>
      buildNativeAccessibility('ProgressBar', {
        label: 'Level progress',
        value: { min: 0, now: 6, max: 5 },
      }),
    ).toThrow(/range/i);

    expect(
      buildNativeAccessibility('ProgressBar', {
        label: 'Level progress',
        value: { min: 0, now: 3, max: 5, text: '3 of 5' },
      }),
    ).toMatchObject({
      accessibilityRole: 'progressbar',
      accessibilityValue: { min: 0, now: 3, max: 5, text: '3 of 5' },
    });
  });

  it('keeps non-semantic layout containers out of the focus order', () => {
    expect(buildNativeAccessibility('Stack')).toEqual({
      accessible: false,
      accessibilityRole: 'none',
      accessibilityLiveRegion: 'none',
    });
  });
});
