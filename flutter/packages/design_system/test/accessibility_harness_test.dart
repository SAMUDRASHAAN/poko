import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poko_design_system/poko_design_system.dart';

void main() {
  test('matrix includes every experience-spec variant exactly once', () {
    expect(PokoAccessibilityVariant.values, hasLength(13));
    expect(PokoAccessibilityVariant.values.toSet(), hasLength(13));
  });

  test('variant settings preserve the specified accessibility intent', () {
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.largeText13,
      ).textScale,
      1.3,
    );
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.largeText16,
      ).textScale,
      1.6,
    );
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.reducedMotion,
      ).transitionDuration,
      PokoMotion.reduced,
    );
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.colourVision,
      ).colourVisionSupport,
      isTrue,
    );
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.leftHanded,
      ).handedness,
      PokoHandedness.left,
    );
    expect(
      pokoAccessibilityPreferencesFor(
        PokoAccessibilityVariant.dyslexiaFont,
      ).bodyFont,
      PokoFont.dyslexic,
    );
  });

  testWidgets('renderer pumps the primitive in every supported variant', (
    tester,
  ) async {
    final rendered = <PokoAccessibilityVariant>[];

    for (final variant in PokoAccessibilityVariant.values) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PokoAccessibilityVariantFrame(
              variant: variant,
              child: Builder(
                builder: (context) {
                  final preferences = PokoAccessibilityScope.of(context);
                  return Text(
                    variant.name,
                    key: const ValueKey('subject'),
                    textDirection: preferences.handedness == PokoHandedness.left
                        ? TextDirection.rtl
                        : TextDirection.ltr,
                  );
                },
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      rendered.add(variant);
      expect(
        tester.takeException(),
        isNull,
        reason: '${variant.name} must render without a Flutter exception',
      );
      final context = tester.element(find.byKey(const ValueKey('subject')));
      final media = MediaQuery.of(context);
      final preferences = PokoAccessibilityScope.of(context);

      expect(media.textScaler.scale(10) / 10, preferences.textScale);
      expect(media.highContrast, preferences.highContrast);
      expect(media.accessibleNavigation, preferences.screenReader);
      expect(
        media.disableAnimations,
        variant == PokoAccessibilityVariant.reducedMotion,
      );
    }

    expect(rendered, PokoAccessibilityVariant.values);
  });

  testWidgets('audio variants map to the four specified combinations', (
    tester,
  ) async {
    const expected = {
      PokoAccessibilityVariant.audioMute: [false, false, false],
      PokoAccessibilityVariant.audioMusicOnly: [true, false, false],
      PokoAccessibilityVariant.audioEffectsOnly: [false, true, false],
      PokoAccessibilityVariant.audioSpokenOutputOff: [true, true, false],
    };

    for (final entry in expected.entries) {
      final audio = pokoAccessibilityPreferencesFor(entry.key).audio;
      expect(
        [audio.music, audio.effects, audio.spokenOutput],
        entry.value,
        reason: entry.key.name,
      );
    }
  });
}
