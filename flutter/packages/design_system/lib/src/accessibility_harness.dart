import 'package:flutter/material.dart';
import 'package:poko_design_system/src/tokens.dart';

/// The complete child-component verification matrix from the experience spec.
enum PokoAccessibilityVariant {
  baseline,
  largeText13,
  largeText16,
  reducedMotion,
  highContrast,
  colourVision,
  leftHanded,
  dyslexiaFont,
  screenReader,
  audioMute,
  audioMusicOnly,
  audioEffectsOnly,
  audioSpokenOutputOff,
}

enum PokoHandedness { left, right }

@immutable
final class PokoAudioPreferences {
  const PokoAudioPreferences({
    required this.music,
    required this.effects,
    required this.spokenOutput,
  });

  final bool music;
  final bool effects;
  final bool spokenOutput;
}

/// Renderer inputs resolved from one canonical accessibility variant.
@immutable
final class PokoAccessibilityPreferences {
  const PokoAccessibilityPreferences({
    required this.textScale,
    required this.transitionDuration,
    required this.highContrast,
    required this.colourVisionSupport,
    required this.handedness,
    required this.bodyFont,
    required this.screenReader,
    required this.audio,
  });

  final double textScale;
  final Duration transitionDuration;
  final bool highContrast;
  final bool colourVisionSupport;
  final PokoHandedness handedness;
  final String bodyFont;
  final bool screenReader;
  final PokoAudioPreferences audio;
}

const _defaultAudio = PokoAudioPreferences(
  music: true,
  effects: true,
  spokenOutput: true,
);

const pokoDefaultAccessibilityPreferences = PokoAccessibilityPreferences(
  textScale: 1,
  transitionDuration: PokoMotion.base,
  highContrast: false,
  colourVisionSupport: false,
  handedness: PokoHandedness.right,
  bodyFont: PokoFont.body,
  screenReader: false,
  audio: _defaultAudio,
);

/// Converts a matrix entry into concrete settings without reinterpretation.
PokoAccessibilityPreferences pokoAccessibilityPreferencesFor(
  PokoAccessibilityVariant variant,
) {
  const baseline = pokoDefaultAccessibilityPreferences;
  return switch (variant) {
    PokoAccessibilityVariant.baseline => baseline,
    PokoAccessibilityVariant.largeText13 => _copy(baseline, textScale: 1.3),
    PokoAccessibilityVariant.largeText16 => _copy(baseline, textScale: 1.6),
    PokoAccessibilityVariant.reducedMotion => _copy(
      baseline,
      transitionDuration: PokoMotion.reduced,
    ),
    PokoAccessibilityVariant.highContrast => _copy(
      baseline,
      highContrast: true,
    ),
    PokoAccessibilityVariant.colourVision => _copy(
      baseline,
      colourVisionSupport: true,
    ),
    PokoAccessibilityVariant.leftHanded => _copy(
      baseline,
      handedness: PokoHandedness.left,
    ),
    PokoAccessibilityVariant.dyslexiaFont => _copy(
      baseline,
      bodyFont: PokoFont.dyslexic,
    ),
    PokoAccessibilityVariant.screenReader => _copy(
      baseline,
      screenReader: true,
    ),
    PokoAccessibilityVariant.audioMute => _copy(
      baseline,
      audio: const PokoAudioPreferences(
        music: false,
        effects: false,
        spokenOutput: false,
      ),
    ),
    PokoAccessibilityVariant.audioMusicOnly => _copy(
      baseline,
      audio: const PokoAudioPreferences(
        music: true,
        effects: false,
        spokenOutput: false,
      ),
    ),
    PokoAccessibilityVariant.audioEffectsOnly => _copy(
      baseline,
      audio: const PokoAudioPreferences(
        music: false,
        effects: true,
        spokenOutput: false,
      ),
    ),
    PokoAccessibilityVariant.audioSpokenOutputOff => _copy(
      baseline,
      audio: const PokoAudioPreferences(
        music: true,
        effects: true,
        spokenOutput: false,
      ),
    ),
  };
}

/// Supplies non-platform preferences such as handedness and audio to a subject.
final class PokoAccessibilityScope extends InheritedWidget {
  const PokoAccessibilityScope({
    required this.preferences,
    required super.child,
    super.key,
  });

  final PokoAccessibilityPreferences preferences;

  static PokoAccessibilityPreferences of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<PokoAccessibilityScope>()
          ?.preferences ??
      pokoDefaultAccessibilityPreferences;

  @override
  bool updateShouldNotify(PokoAccessibilityScope oldWidget) =>
      preferences != oldWidget.preferences;
}

/// Applies one variant to a rendered widget under test.
///
/// Tests walk [PokoAccessibilityVariant.values] with this widget. Platform
/// settings are expressed through [MediaQuery] and [Theme]; Poko-only settings
/// are available from [PokoAccessibilityScope].
final class PokoAccessibilityVariantFrame extends StatelessWidget {
  const PokoAccessibilityVariantFrame({
    required this.variant,
    required this.child,
    super.key,
  });

  final PokoAccessibilityVariant variant;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final preferences = pokoAccessibilityPreferencesFor(variant);
    final media = MediaQuery.maybeOf(context) ?? const MediaQueryData();
    final theme = Theme.of(context);
    final textTheme = theme.textTheme.apply(fontFamily: preferences.bodyFont);
    final primaryTextTheme = theme.primaryTextTheme.apply(
      fontFamily: preferences.bodyFont,
    );

    return PokoAccessibilityScope(
      preferences: preferences,
      child: MediaQuery(
        data: media.copyWith(
          accessibleNavigation: preferences.screenReader,
          disableAnimations: variant == PokoAccessibilityVariant.reducedMotion,
          highContrast: preferences.highContrast,
          textScaler: TextScaler.linear(preferences.textScale),
        ),
        child: Theme(
          data: theme.copyWith(
            textTheme: textTheme,
            primaryTextTheme: primaryTextTheme,
          ),
          child: child,
        ),
      ),
    );
  }
}

PokoAccessibilityPreferences _copy(
  PokoAccessibilityPreferences source, {
  double? textScale,
  Duration? transitionDuration,
  bool? highContrast,
  bool? colourVisionSupport,
  PokoHandedness? handedness,
  String? bodyFont,
  bool? screenReader,
  PokoAudioPreferences? audio,
}) => PokoAccessibilityPreferences(
  textScale: textScale ?? source.textScale,
  transitionDuration: transitionDuration ?? source.transitionDuration,
  highContrast: highContrast ?? source.highContrast,
  colourVisionSupport: colourVisionSupport ?? source.colourVisionSupport,
  handedness: handedness ?? source.handedness,
  bodyFont: bodyFont ?? source.bodyFont,
  screenReader: screenReader ?? source.screenReader,
  audio: audio ?? source.audio,
);
