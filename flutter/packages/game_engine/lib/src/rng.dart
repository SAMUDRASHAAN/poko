/// Seeded xorshift32 pseudo-random generator. Changing its consumption order is
/// a breaking content change. [INV-3]
final class Rng {
  Rng(int seed) : _state = seed & _mask {
    if (_state == 0) {
      _state = 0x9e3779b9;
    }
  }

  static const int _mask = 0xffffffff;
  static const int _range = 0x100000000;

  int _state;

  int get state => _state;

  int _step() {
    _state ^= (_state << 13) & _mask;
    _state &= _mask;
    _state ^= _state >> 17;
    _state &= _mask;
    _state ^= (_state << 5) & _mask;
    _state &= _mask;
    return _state;
  }

  double nextUnit() => _step() / _range;

  int nextInt(int min, int max) {
    if (max < min) {
      throw RangeError('nextInt($min, $max): max must be >= min');
    }
    return min + (nextUnit() * (max - min + 1)).floor();
  }

  T pick<T>(List<T> items) {
    if (items.isEmpty) {
      throw RangeError('pick() on an empty list');
    }
    return items[nextInt(0, items.length - 1)];
  }

  List<T> shuffle<T>(List<T> items) {
    final output = List<T>.of(items);
    for (var index = output.length - 1; index > 0; index -= 1) {
      final swapIndex = nextInt(0, index);
      final value = output[index];
      output[index] = output[swapIndex];
      output[swapIndex] = value;
    }
    return output;
  }
}
