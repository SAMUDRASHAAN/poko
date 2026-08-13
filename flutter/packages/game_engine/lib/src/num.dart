/// Exact, reduced rational arithmetic for every gameplay value. [INV-4]
final class Num {
  factory Num(int numerator, [int denominator = 1]) {
    if (denominator == 0) {
      throw DivisionByZeroError();
    }

    final sign = denominator < 0 ? -1 : 1;
    final signedNumerator = numerator * sign;
    final positiveDenominator = denominator * sign;
    final divisor = _gcd(signedNumerator, positiveDenominator);
    return Num._(signedNumerator ~/ divisor, positiveDenominator ~/ divisor);
  }

  const Num._(this.numerator, this.denominator);

  static const zero = Num._(0, 1);
  static const one = Num._(1, 1);

  final int numerator;
  final int denominator;

  Num operator +(Num other) => Num(
    numerator * other.denominator + other.numerator * denominator,
    denominator * other.denominator,
  );

  Num operator -(Num other) => Num(
    numerator * other.denominator - other.numerator * denominator,
    denominator * other.denominator,
  );

  Num operator *(Num other) =>
      Num(numerator * other.numerator, denominator * other.denominator);

  Num operator /(Num other) {
    if (other.numerator == 0) {
      throw DivisionByZeroError();
    }
    return Num(numerator * other.denominator, denominator * other.numerator);
  }

  bool operator <(Num other) =>
      numerator * other.denominator < other.numerator * denominator;

  bool operator <=(Num other) =>
      numerator * other.denominator <= other.numerator * denominator;

  bool operator >(Num other) =>
      numerator * other.denominator > other.numerator * denominator;

  bool operator >=(Num other) =>
      numerator * other.denominator >= other.numerator * denominator;

  bool get isInteger => denominator == 1;
  bool get isNegative => numerator < 0;
  bool get isZero => numerator == 0;

  bool dividesExactlyBy(Num divisor) =>
      !divisor.isZero && (this / divisor).isInteger;

  /// Rendering escape hatch only. Never use this result in gameplay rules.
  double toDouble() => numerator / denominator;

  @override
  bool operator ==(Object other) =>
      other is Num &&
      numerator == other.numerator &&
      denominator == other.denominator;

  @override
  int get hashCode => Object.hash(numerator, denominator);

  @override
  String toString() =>
      denominator == 1 ? '$numerator' : '$numerator/$denominator';
}

final class DivisionByZeroError extends Error {
  @override
  String toString() => 'DivisionByZeroError: Division by zero';
}

int _gcd(int a, int b) {
  var x = a.abs();
  var y = b.abs();
  while (y != 0) {
    final remainder = x % y;
    x = y;
    y = remainder;
  }
  return x == 0 ? 1 : x;
}

Num integer(int value) => Num(value);
Num fraction(int numerator, int denominator) => Num(numerator, denominator);
Num add(Num a, Num b) => a + b;
Num subtract(Num a, Num b) => a - b;
Num multiply(Num a, Num b) => a * b;
Num divide(Num a, Num b) => a / b;
bool equal(Num a, Num b) => a == b;
