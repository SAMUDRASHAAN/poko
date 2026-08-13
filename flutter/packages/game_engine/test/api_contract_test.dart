import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:test/test.dart';

void main() {
  test('foundation exposes typed action and value contracts', () {
    const action = BeginChain(Cell(row: 2, col: 3));
    expect(action.cell.row, 2);
    expect(Operation.values.map((value) => value.name), <String>[
      'add',
      'sub',
      'mul',
      'div',
      'wild',
    ]);
  });

  test('implementation entry points remain visibly pending', () {
    expect(
      () => restore('{}'),
      throwsA(
        isA<UnimplementedError>().having(
          (error) => error.message,
          'message',
          contains('Phase 1F engine'),
        ),
      ),
    );
  });
}
