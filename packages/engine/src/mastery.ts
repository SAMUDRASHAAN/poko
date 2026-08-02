import type { Attempt, Mastery } from './types.js';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function updateMasteryModel(previous: Mastery, attempt: Attempt): Mastery {
  if (previous.skillId !== attempt.skillId) {
    throw new RangeError('attempt skill must match mastery skill');
  }
  const expected = Math.max(1, attempt.expectedTimeMs);
  const fluency = clamp(expected / Math.max(1, attempt.timeMs), 0, 1);
  const correctness = attempt.correct ? 1 : 0;
  const hintFactor = attempt.hintUsed ? 0.7 : 1;
  const evidence = correctness * (0.6 + 0.4 * fluency) * hintFactor;
  const attempts = previous.attempts + 1;
  const mastery = clamp(previous.mastery * 0.8 + evidence * 0.2, 0, 1);
  const averageTime = Math.round(
    (previous.avgTimeMs * previous.attempts + attempt.timeMs) / attempts,
  );
  return {
    skillId: previous.skillId,
    mastery,
    attempts,
    correct: previous.correct + (attempt.correct ? 1 : 0),
    avgTimeMs: averageTime,
    hintsUsed: previous.hintsUsed + (attempt.hintUsed ? 1 : 0),
    nextReviewInDays: mastery >= 0.85 ? 7 : mastery >= 0.65 ? 3 : 1,
  };
}
