import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poko_design_system/poko_design_system.dart';

void main() {
  test('INV-14 reports all undersized child-zone measurements', () {
    final violations = findPokoHitTargetViolations(const [
      PokoMeasuredHitTarget(id: 'small', width: 40, height: 64),
      PokoMeasuredHitTarget(id: 'good', width: 64, height: 64),
      PokoMeasuredHitTarget(
        id: 'parent',
        width: 20,
        height: 20,
        isChildZone: false,
      ),
    ]);

    expect(violations, hasLength(1));
    expect(violations.single.id, 'small');
    expect(violations.single.shortfallX, 24);
    expect(describePokoHitTargetViolations(violations), contains('INV-14'));
  });

  testWidgets('semantics helper accepts a 64x64 logical-pixel hit area', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox.square(
            dimension: PokoTouch.min,
            child: Semantics(
              identifier: 'safe-action',
              button: true,
              onTap: () {},
            ),
          ),
        ),
      ),
    );

    await _expectEveryChildHitTarget(tester);
  });

  testWidgets('semantics helper rejects the actual undersized hit area', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox.square(
            dimension: 40,
            child: Semantics(
              identifier: 'unsafe-action',
              button: true,
              onTap: () {},
            ),
          ),
        ),
      ),
    );

    await expectLater(
      () => _expectEveryChildHitTarget(tester),
      throwsA(
        isA<FlutterError>()
            .having(
              (error) => error.message,
              'message',
              contains('unsafe-action'),
            )
            .having((error) => error.message, 'message', contains('40x40')),
      ),
    );
  });
}

Future<void> _expectEveryChildHitTarget(WidgetTester tester) async {
  final semantics = tester.ensureSemantics();
  try {
    await tester.pump();
    final root = tester
        .binding
        .renderViews
        .single
        .owner
        ?.semanticsOwner
        ?.rootSemanticsNode;
    expect(root, isNotNull, reason: 'A rendered semantics tree is required.');
    assertPokoChildHitTargets(
      root!,
      devicePixelRatio: tester.view.devicePixelRatio,
    );
  } finally {
    semantics.dispose();
  }
}
