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

  test('implemented entry points reject malformed state', () {
    expect(() => restore('{}'), throwsA(isA<TypeError>()));
  });
}
