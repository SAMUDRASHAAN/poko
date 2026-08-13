import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:test/test.dart';

const band = BandConfig(
  id: BandId.sprout,
  numberRange: IntRange(1, 10),
  allowedOperations: <Operation>[Operation.add, Operation.sub],
  allowedColours: <TileColour>[TileColour.coral, TileColour.marine],
  minChain: 2,
  maxChain: 4,
  maxTarget: 20,
  allowNegatives: false,
  allowDiagonals: false,
  minSolutions: 1,
  maxSolutions: 4,
);

const rules = LevelRules(
  objective: ObjectiveType.equationCount,
  goalValue: 3,
  moveLimit: 10,
  obstacles: <ObstacleCount>[],
  allowedPowerUps: <PowerUpId>[PowerUpId.hintLens, PowerUpId.equationShuffle],
  targetSkills: <String>['addition', 'subtraction'],
);

void main() {
  test('public API creates, previews, and atomically resolves a level', () {
    final initial = createLevel(7, rules, band);
    final solution = analyseWithBand(
      initial.board,
      initial.target,
      rules,
      band,
    ).bestSolution!;
    var preview = dispatch(initial, BeginChain(solution.cells.first));
    for (final cell in solution.cells.skip(1)) {
      preview = dispatch(preview, ExtendChain(cell));
    }
    expect(preview.phase, Phase.previewing);
    final before = serialise(preview);
    final resolved = dispatch(preview, const Commit());
    expect(serialise(preview), before);
    expect(resolved.phase, Phase.ready);
    expect(resolved.solvedCount, 1);
    expect(resolved.movesUsed, 1);
    expect(resolved.score, greaterThan(0));
    expect(
      analyseWithBand(resolved.board, resolved.target, rules, band).isStuck,
      isFalse,
    );
  });

  test(
    'reducer handles guarded input, pause, timers, hints, and short commits',
    () {
      final initial = createLevel(
        9,
        const LevelRules(
          objective: ObjectiveType.equationCount,
          goalValue: 3,
          moveLimit: 10,
          timeLimitMs: 1000,
          obstacles: <ObstacleCount>[],
          allowedPowerUps: <PowerUpId>[
            PowerUpId.hintLens,
            PowerUpId.equationShuffle,
          ],
          targetSkills: <String>['addition'],
        ),
        band,
      );
      expect(
        identical(
          dispatch(initial, const BeginChain(Cell(row: -1, col: 0))),
          initial,
        ),
        isTrue,
      );
      final paused = dispatch(initial, const Pause());
      expect(paused.phase, Phase.paused);
      final resumed = dispatch(paused, const Resume());
      final hinted = dispatch(resumed, const RequestHint());
      expect(hinted.hintsUsed, 1);
      final ticked = dispatch(hinted, const Tick(250));
      expect(ticked.timeRemainingMs, 750);

      final solution = analyseWithBand(
        ticked.board,
        ticked.target,
        ticked.rules,
        ticked.band,
      ).bestSolution!;
      final dragging = dispatch(ticked, BeginChain(solution.cells.first));
      final released = dispatch(dragging, const Commit());
      expect(released.phase, Phase.ready);
      expect(released.attemptCount, 1);
      expect(released.movesUsed, 0);
    },
  );

  test('serialisation is canonical and lossless across generated states', () {
    for (var seed = -50; seed <= 50; seed += 1) {
      final state = createLevel(seed, rules, band);
      final blob = serialise(state);
      expect(serialise(restore(blob)), blob, reason: 'seed $seed');
    }
    expect(() => restore('not-json'), throwsFormatException);
    expect(() => restore('{}'), throwsA(isA<TypeError>()));
  });

  test('mastery update rewards fluent unhinted correct attempts', () {
    const mastery = Mastery(
      skillId: 'addition',
      mastery: 0.5,
      attempts: 4,
      correct: 3,
      avgTimeMs: 4000,
      hintsUsed: 1,
      nextReviewInDays: 2,
    );
    final fluent = updateMastery(
      mastery,
      const Attempt(
        skillId: 'addition',
        correct: true,
        timeMs: 2000,
        hintUsed: false,
        expectedTimeMs: 4000,
      ),
    );
    final hinted = updateMastery(
      mastery,
      const Attempt(
        skillId: 'addition',
        correct: true,
        timeMs: 2000,
        hintUsed: true,
        expectedTimeMs: 4000,
      ),
    );
    expect(fluent.mastery, greaterThan(mastery.mastery));
    expect(hinted.mastery, lessThan(fluent.mastery));
    expect(fluent.attempts, 5);
    expect(fluent.correct, 4);
    expect(
      () => updateMastery(
        mastery,
        const Attempt(
          skillId: 'subtraction',
          correct: false,
          timeMs: 1,
          hintUsed: false,
          expectedTimeMs: 1,
        ),
      ),
      throwsRangeError,
    );
  });
}
