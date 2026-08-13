import 'package:flutter_test/flutter_test.dart';
import 'package:poko_design_system/poko_design_system.dart';

void main() {
  test('each operation has unique colour, shape, and glyph coding', () {
    expect(PokoOperationToken.colours.keys, PokoOperationToken.shapes.keys);
    expect(PokoOperationToken.colours.keys, PokoOperationToken.glyphs.keys);
    expect(PokoOperationToken.colours.values.toSet(), hasLength(5));
    expect(PokoOperationToken.shapes.values.toSet(), hasLength(5));
    expect(PokoOperationToken.glyphs.values.toSet(), hasLength(5));
  });

  test('child hit targets and reduced motion preserve safety floors', () {
    expect(PokoTouch.min, greaterThanOrEqualTo(64));
    expect(
      PokoMotion.reduced.inMilliseconds,
      lessThanOrEqualTo(PokoMotion.maxInputBlock.inMilliseconds),
    );
  });

  test('frozen palette matches the accepted TypeScript oracle', () {
    expect(PokoColour.coral.toARGB32(), 0xFFFF6B5B);
    expect(PokoColour.parentMist.toARGB32(), 0xFFF1F5F9);
    expect(PokoSpace.values, <double>[0, 4, 8, 12, 16, 24, 32, 48, 64]);
  });
}
