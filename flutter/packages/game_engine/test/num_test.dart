import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:test/test.dart';

void main() {
  group('Num', () {
    test('reduces fractions and keeps the sign on the numerator', () {
      expect(Num(6, -8), Num(-3, 4));
      expect(Num(0, -9), Num.zero);
    });

    test('performs exact rational arithmetic', () {
      expect(Num(1, 3) + Num(1, 6), Num(1, 2));
      expect(Num(3, 4) - Num(1, 2), Num(1, 4));
      expect(Num(2, 3) * Num(9, 4), Num(3, 2));
      expect(Num(3, 5) / Num(9, 10), Num(2, 3));
    });

    test('rejects zero denominators and zero divisors', () {
      expect(() => Num(1, 0), throwsA(isA<DivisionByZeroError>()));
      expect(() => Num.one / Num.zero, throwsA(isA<DivisionByZeroError>()));
    });

    test('compares without floating-point conversion', () {
      expect(Num(2, 3) < Num(3, 4), isTrue);
      expect(Num(6, 9) == Num(2, 3), isTrue);
      expect(Num(12).dividesExactlyBy(Num(3)), isTrue);
      expect(Num(5).dividesExactlyBy(Num(2)), isFalse);
    });

    test('formats integers and fractions for display only', () {
      expect(Num(8).toString(), '8');
      expect(Num(7, 3).toString(), '7/3');
    });
  });
}
