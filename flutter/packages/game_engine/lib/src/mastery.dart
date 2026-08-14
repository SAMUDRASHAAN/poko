import 'package:poko_game_engine/src/types.dart';

Mastery updateMasteryModel(Mastery previous, Attempt attempt) {
  if (previous.skillId != attempt.skillId) {
    throw RangeError('attempt skill must match mastery skill');
  }
  final expected = _max(1, attempt.expectedTimeMs);
  final fluency = _clamp(expected / _max(1, attempt.timeMs), 0, 1);
  final correctness = attempt.correct ? 1.0 : 0.0;
  final hintFactor = attempt.hintUsed ? 0.7 : 1.0;
  final evidence = correctness * (0.6 + 0.4 * fluency) * hintFactor;
  final attempts = previous.attempts + 1;
  final mastery = _clamp(previous.mastery * 0.8 + evidence * 0.2, 0, 1);
  final averageTime =
      (previous.avgTimeMs * previous.attempts + attempt.timeMs) / attempts;
  return Mastery(
    skillId: previous.skillId,
    mastery: mastery,
    attempts: attempts,
    correct: previous.correct + (attempt.correct ? 1 : 0),
    avgTimeMs: averageTime.roundToDouble(),
    hintsUsed: previous.hintsUsed + (attempt.hintUsed ? 1 : 0),
    nextReviewInDays: mastery >= 0.85
        ? 7
        : mastery >= 0.65
        ? 3
        : 1,
  );
}

double _clamp(num value, num minimum, num maximum) => value < minimum
    ? minimum.toDouble()
    : value > maximum
    ? maximum.toDouble()
    : value.toDouble();

int _max(int left, int right) => left > right ? left : right;
