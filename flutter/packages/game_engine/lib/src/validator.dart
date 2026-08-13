import 'package:poko_game_engine/src/equation.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:poko_game_engine/src/types.dart';

const double decoyNearRatio = 0.6;
const int decoyNearDistance = 3;
const int _minChainableDecoys = 24;
const int _targetCandidates = 12;

const _orthogonalPairs = <(int, int)>[(0, 1), (1, 0)];
const _diagonalPairs = <(int, int)>[(0, 1), (1, 0), (1, 1), (1, -1)];

final class DecoyQuality {
  const DecoyQuality({
    required this.chainable,
    required this.near,
    required this.ratio,
  });

  final int chainable;
  final int near;
  final double ratio;
}

void _forEachChainablePair(
  Board board,
  BandConfig band,
  void Function(Num result) visit,
) {
  final deltas = band.allowDiagonals ? _diagonalPairs : _orthogonalPairs;
  for (var row = 0; row < board.height; row += 1) {
    for (var col = 0; col < board.width; col += 1) {
      for (final delta in deltas) {
        final partner = Cell(row: row + delta.$1, col: col + delta.$2);
        if (partner.row >= board.height ||
            partner.col >= board.width ||
            partner.col < 0) {
          continue;
        }
        final result = chainResult(board, <Cell>[
          Cell(row: row, col: col),
          partner,
        ], band);
        if (result != null) {
          visit(result);
        }
      }
    }
  }
}

DecoyQuality decoyQuality(Board board, Num target, BandConfig band) {
  var chainable = 0;
  var near = 0;
  _forEachChainablePair(board, band, (result) {
    final delta = result - target;
    if (delta.isZero) {
      return;
    }
    chainable += 1;
    if (delta.numerator.abs() <= decoyNearDistance * delta.denominator) {
      near += 1;
    }
  });
  return DecoyQuality(
    chainable: chainable,
    near: near,
    ratio: chainable == 0 ? 0 : near / chainable,
  );
}

List<int> rankTargetsForBoard(Board board, BandConfig band) {
  final values = <int>[];
  _forEachChainablePair(board, band, (result) {
    if (result.isInteger) {
      values.add(result.numerator);
    }
  });
  if (values.isEmpty) {
    return <int>[];
  }

  var lowest = values.first;
  var highest = values.first;
  for (final value in values.skip(1)) {
    if (value < lowest) {
      lowest = value;
    }
    if (value > highest) {
      highest = value;
    }
  }
  final histogram = List<int>.filled(highest - lowest + 1, 0);
  for (final value in values) {
    histogram[value - lowest] += 1;
  }
  final prefix = List<int>.filled(histogram.length + 1, 0);
  for (var index = 0; index < histogram.length; index += 1) {
    prefix[index + 1] = prefix[index] + histogram[index];
  }

  int countBetween(int from, int to) {
    final low = _max(0, from - lowest);
    final high = _min(histogram.length - 1, to - lowest);
    return high < low ? 0 : prefix[high + 1] - prefix[low];
  }

  final firstTarget = band.allowNegatives
      ? lowest - decoyNearDistance
      : _max(0, lowest - decoyNearDistance);
  final lastTarget = _min(highest + decoyNearDistance, band.maxTarget);
  final scored = <({int target, int score})>[];
  for (var target = firstTarget; target <= lastTarget; target += 1) {
    final histogramIndex = target - lowest;
    final exactHits = histogramIndex >= 0 && histogramIndex < histogram.length
        ? histogram[histogramIndex]
        : 0;
    scored.add((
      target: target,
      score:
          countBetween(target - decoyNearDistance, target + decoyNearDistance) -
          exactHits,
    ));
  }
  scored.sort((left, right) {
    final byScore = right.score - left.score;
    return byScore != 0 ? byScore : left.target - right.target;
  });
  return scored.take(_targetCandidates).map((entry) => entry.target).toList();
}

enum ValidationReason {
  unsolvable,
  tooFewSolutions,
  tooManySolutions,
  weakDecoys,
}

final class ValidationResult {
  const ValidationResult({
    required this.valid,
    required this.analysis,
    required this.reasons,
  });

  final bool valid;
  final Analysis analysis;
  final List<ValidationReason> reasons;
}

ValidationResult validatePuzzle(
  Board board,
  Num target,
  LevelRules rules,
  BandConfig band,
) {
  final analysis = analyseWithBand(board, target, rules, band);
  final reasons = <ValidationReason>[];
  if (analysis.isStuck) {
    reasons.add(ValidationReason.unsolvable);
  }
  if (analysis.solutions.length < band.minSolutions) {
    reasons.add(ValidationReason.tooFewSolutions);
  }
  if (analysis.solutions.length > band.maxSolutions) {
    reasons.add(ValidationReason.tooManySolutions);
  }
  final decoys = decoyQuality(board, target, band);
  if (decoys.chainable < _minChainableDecoys || decoys.ratio < decoyNearRatio) {
    reasons.add(ValidationReason.weakDecoys);
  }
  return ValidationResult(
    valid: reasons.isEmpty,
    analysis: analysis,
    reasons: reasons,
  );
}

int _max(int left, int right) => left > right ? left : right;
int _min(int left, int right) => left < right ? left : right;
