import 'package:flutter_test/flutter_test.dart';
import 'package:poko_client_data/poko_client_data.dart';
import 'package:poko_mobile/main.dart';
import 'package:rive/rive.dart' as rive;

void main() {
  testWidgets('offline foundation shell starts with accessible status', (
    tester,
  ) async {
    await tester.pumpWidget(const PokoApp());

    expect(find.bySemanticsLabel('Poko foundation ready'), findsOneWidget);
    expect(riveRuntimeWidgetType, rive.RiveWidget);
    expect(persistenceBoundaryType, ProgressStore);
  });
}
