import 'package:poko_content/poko_content.dart';
import 'package:test/test.dart';

void main() {
  test('foundation content is versioned and intentionally empty', () {
    expect(emptyFoundationContent.version, 1);
    expect(emptyFoundationContent.puzzles, isEmpty);
  });
}
