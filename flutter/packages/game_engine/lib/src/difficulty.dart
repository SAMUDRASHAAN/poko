import 'package:poko_game_engine/src/types.dart';

int difficultyScore(BandConfig band, LevelRules rules, Analysis analysis) {
  final operationWeight = _max(0, band.allowedOperations.length - 1) * 8;
  final rangeWeight = _max(0, band.numberRange.max - band.numberRange.min);
  final chainWeight = _max(0, band.maxChain - band.minChain) * 4;
  final scarcityWeight = _max(0, 6 - _min(6, analysis.solutions.length)) * 5;
  final pressureWeight =
      (rules.timeLimitMs == null ? 0 : 10) + (rules.moveLimit == null ? 0 : 5);
  return operationWeight +
      rangeWeight +
      chainWeight +
      scarcityWeight +
      pressureWeight;
}

int _max(int left, int right) => left > right ? left : right;
int _min(int left, int right) => left < right ? left : right;
