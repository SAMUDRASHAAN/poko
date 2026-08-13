import 'package:flutter/material.dart';

/// Existing values mirror `packages/ui/src/tokens.ts` and are frozen.
abstract final class PokoColour {
  static const coral = Color(0xFFFF6B5B);
  static const marine = Color(0xFF2E8FD6);
  static const kelp = Color(0xFF3FBF87);
  static const sunfish = Color(0xFFFFC531);
  static const violet = Color(0xFF9B6BE8);
  static const deep = Color(0xFF12324F);
  static const sand = Color(0xFFFFF6E9);
  static const foam = Color(0xFFE6F4FB);
  static const tide = Color(0xFF0E7C9B);
  static const parentTeal = Color(0xFF0F766E);
  static const parentSlate = Color(0xFF334155);
  static const parentMist = Color(0xFFF1F5F9);
}

abstract final class PokoOperationToken {
  static const colours = <String, Color>{
    'add': PokoColour.coral,
    'sub': PokoColour.marine,
    'mul': PokoColour.kelp,
    'div': PokoColour.sunfish,
    'wild': PokoColour.violet,
  };

  static const shapes = <String, String>{
    'add': 'roundedSquare',
    'sub': 'circle',
    'mul': 'hexagon',
    'div': 'diamond',
    'wild': 'star',
  };

  static const glyphs = <String, String>{
    'add': '+',
    'sub': '−',
    'mul': '×',
    'div': '÷',
    'wild': '✦',
  };
}

abstract final class PokoSpace {
  static const values = <double>[0, 4, 8, 12, 16, 24, 32, 48, 64];
}

abstract final class PokoRadius {
  static const tile = 8.0;
  static const card = 16.0;
  static const sheet = 24.0;
  static const pill = 999.0;
}

abstract final class PokoTypeSize {
  static const target = 56.0;
  static const tile = 34.0;
  static const preview = 28.0;
  static const h1 = 24.0;
  static const body = 17.0;
  static const caption = 14.0;
}

abstract final class PokoFont {
  static const display = 'Baloo2-ExtraBold';
  static const body = 'Nunito-SemiBold';
  static const bodyBold = 'Nunito-ExtraBold';
  static const dyslexic = 'Lexend-Regular';
}

abstract final class PokoTouch {
  /// Hard floor for every interactive child-zone element. [INV-14]
  static const min = 64.0;
}

abstract final class PokoMotion {
  static const fast = Duration(milliseconds: 120);
  static const base = Duration(milliseconds: 260);
  static const slow = Duration(milliseconds: 450);
  static const reduced = Duration(milliseconds: 100);
  static const maxInputBlock = Duration(milliseconds: 300);
}

ThemeData pokoFoundationTheme() => ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: PokoColour.tide,
    surface: PokoColour.sand,
  ),
  scaffoldBackgroundColor: PokoColour.sand,
  textTheme: const TextTheme(
    bodyLarge: TextStyle(color: PokoColour.deep, fontSize: PokoTypeSize.body),
  ),
);
