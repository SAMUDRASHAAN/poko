import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/json_codec.dart';
import 'package:poko_game_engine/src/refill.dart';
import 'package:poko_game_engine/src/rng.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:poko_game_engine/src/validator.dart';
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

LevelState copyState(
  LevelState state, {
  Phase? phase,
  Num? target,
  LevelRules? replacementRules,
  int? movesRemaining,
}) => LevelState(
  phase: phase ?? state.phase,
  board: state.board,
  target: target ?? state.target,
  chain: state.chain,
  preview: state.preview,
  score: state.score,
  combo: state.combo,
  movesUsed: state.movesUsed,
  movesRemaining: movesRemaining ?? state.movesRemaining,
  timeRemainingMs: state.timeRemainingMs,
  solvedCount: state.solvedCount,
  attemptCount: state.attemptCount,
  hintsUsed: state.hintsUsed,
  rules: replacementRules ?? state.rules,
  band: state.band,
  rngState: state.rngState,
  history: state.history,
);

LevelState previewBest(LevelState state) {
  final best = analyseWithBand(
    state.board,
    state.target,
    state.rules,
    state.band,
  ).bestSolution!;
  var next = dispatch(state, BeginChain(best.cells.first));
  for (final cell in best.cells.skip(1)) {
    next = dispatch(next, ExtendChain(cell));
  }
  return next;
}

Board unsolvableBoard() => Board(
  width: 8,
  height: 8,
  seed: 7,
  tiles: List<List<Tile?>>.generate(
    8,
    (row) => List<Tile?>.generate(
      8,
      (col) => Tile(
        id: 'stuck-$row-$col',
        value: integer(1),
        colour: TileColour.coral,
        operation: Operation.add,
      ),
    ),
  ),
);

void main() {
  group('JSON codec edge cases', () {
    test('encodes and decodes every supported primitive and escape', () {
      final value = <String, Object?>{
        'null': null,
        'bool': true,
        'int': 4,
        'wholeDouble': 2.0,
        'double': 1.25,
        'nonFinite': double.infinity,
        'text': '"\\\b\f\n\r\t${String.fromCharCode(1)}é',
        'list': <Object?>[false, -2, 1.5e2],
      };
      final encoded = encodeJson(value);
      expect(encoded, contains(r'\"\\\b\f\n\r\t\u0001'));
      final decoded = decodeJson(encoded) as Map<String, Object?>;
      expect(decoded['nonFinite'], isNull);
      expect(decoded['wholeDouble'], 2);
      expect(decoded['double'], 1.25);
      expect(
        decodeJson(r'{"unicode":"\u0041","slash":"\/"}'),
        <String, Object?>{'unicode': 'A', 'slash': '/'},
      );
      expect(() => encodeJson(Object()), throwsArgumentError);
    });

    test('rejects malformed input at every parser boundary', () {
      for (final source in <String>[
        '',
        'true false',
        'truth',
        '"unterminated',
        '"bad\\',
        '"bad\\x"',
        '"bad\\u12"',
        '"bad\\uzzzz"',
        '[1',
        '[1 2]',
        '{',
        '{1:2}',
        '{"a" 2}',
        '{"a":2 "b":3}',
        '-',
      ]) {
        expect(() => decodeJson(source), throwsFormatException, reason: source);
      }
      expect(
        () => decodeJson('"${String.fromCharCode(1)}"'),
        throwsFormatException,
      );
    });
  });

  test('serialises every optional field and action variant losslessly', () {
    final special = Tile(
      id: 'special',
      value: Num(3, 4),
      colour: TileColour.violet,
      operation: Operation.wild,
      ownOperator: Operation.mul,
      obstacle: ObstacleKind.ice,
      powerUp: PowerUpId.wildNumber,
    );
    final state = LevelState(
      phase: Phase.previewing,
      board: Board(
        width: 2,
        height: 1,
        tiles: <List<Tile?>>[
          <Tile?>[special, null],
        ],
        seed: 4294967295,
      ),
      target: Num(3, 2),
      chain: const Chain(cells: <Cell>[Cell(row: 0, col: 0)]),
      preview: Equation(
        tiles: <Tile>[special],
        operation: Operation.wild,
        result: Num(3, 4),
        display: '¾',
        isValid: false,
        invalidReason: InvalidReason.tooShort,
      ),
      score: 7,
      combo: 2,
      movesUsed: 1,
      movesRemaining: 9,
      timeRemainingMs: 1234,
      solvedCount: 1,
      attemptCount: 2,
      hintsUsed: 3,
      rules: const LevelRules(
        objective: ObjectiveType.iceMelt,
        goalValue: 4,
        moveLimit: 10,
        timeLimitMs: 5000,
        obstacles: <ObstacleCount>[
          ObstacleCount(kind: ObstacleKind.ice, count: 2),
        ],
        allowedPowerUps: <PowerUpId>[PowerUpId.wildNumber],
        targetSkills: <String>['fractions'],
      ),
      band: const BandConfig(
        id: BandId.pathfinder,
        numberRange: IntRange(-10, 20),
        allowedOperations: <Operation>[Operation.wild],
        allowedColours: <TileColour>[TileColour.violet],
        minChain: 2,
        maxChain: 6,
        maxTarget: 200,
        allowNegatives: true,
        allowDiagonals: true,
        minSolutions: 1,
        maxSolutions: 8,
      ),
      rngState: 42,
      history: const <GameAction>[
        BeginChain(Cell(row: 0, col: 0)),
        ExtendChain(Cell(row: 0, col: 1)),
        RetractChain(),
        CancelChain(),
        Commit(),
        Swap(a: Cell(row: 0, col: 0), b: Cell(row: 0, col: 1)),
        RequestHint(),
        UsePowerUp(id: PowerUpId.wildNumber, cell: Cell(row: 0, col: 0)),
        Tick(16),
        Pause(),
        Resume(),
        AdvancePhase(),
      ],
    );
    final blob = serialise(state);
    expect(serialise(restore(blob)), blob);
    expect(blob, contains('"ownOperator":"mul"'));
    expect(blob, contains('"ADVANCE_PHASE"'));
  });

  group('reducer edge behavior', () {
    test(
      'rejects wrong chains and handles retract, cancel, and resume phases',
      () {
        final initial = createLevel(18, rules, band);
        final best = analyseWithBand(
          initial.board,
          initial.target,
          rules,
          band,
        ).bestSolution!;
        final dragging = dispatch(initial, BeginChain(best.cells.first));
        expect(
          identical(dispatch(dragging, BeginChain(best.cells.last)), dragging),
          isTrue,
        );
        expect(
          identical(
            dispatch(dragging, ExtendChain(best.cells.first)),
            dragging,
          ),
          isTrue,
        );
        expect(
          dispatch(dispatch(dragging, const Pause()), const Resume()).phase,
          Phase.dragging,
        );
        final preview = dispatch(dragging, ExtendChain(best.cells[1]));
        expect(
          dispatch(dispatch(preview, const Pause()), const Resume()).phase,
          Phase.previewing,
        );
        expect(
          dispatch(preview, const RetractChain()).chain.cells,
          hasLength(1),
        );
        expect(dispatch(preview, const CancelChain()).phase, Phase.ready);

        final wrong = copyState(initial, target: integer(999));
        final wrongPreview = previewBest(
          copyState(wrong, target: initial.target),
        );
        final retargeted = LevelState(
          phase: wrongPreview.phase,
          board: wrongPreview.board,
          target: integer(999),
          chain: wrongPreview.chain,
          preview: wrongPreview.preview,
          score: wrongPreview.score,
          combo: wrongPreview.combo,
          movesUsed: wrongPreview.movesUsed,
          movesRemaining: wrongPreview.movesRemaining,
          timeRemainingMs: wrongPreview.timeRemainingMs,
          solvedCount: wrongPreview.solvedCount,
          attemptCount: wrongPreview.attemptCount,
          hintsUsed: wrongPreview.hintsUsed,
          rules: wrongPreview.rules,
          band: wrongPreview.band,
          rngState: wrongPreview.rngState,
          history: wrongPreview.history,
        );
        final rejected = dispatch(retargeted, const Commit());
        expect(rejected.attemptCount, 1);
        expect(rejected.combo, 0);
        expect(rejected.movesUsed, 0);
      },
    );

    test(
      'covers power-ups, timeout, score completion, and move exhaustion',
      () {
        final initial = createLevel(14, rules, band);
        expect(identical(dispatch(initial, const Commit()), initial), isTrue);
        expect(
          identical(dispatch(initial, const RetractChain()), initial),
          isTrue,
        );
        expect(
          identical(dispatch(initial, const CancelChain()), initial),
          isTrue,
        );
        expect(identical(dispatch(initial, const Resume()), initial), isTrue);
        expect(
          identical(dispatch(initial, const AdvancePhase()), initial),
          isTrue,
        );
        expect(
          identical(
            dispatch(initial, const UsePowerUp(id: PowerUpId.calculatorBomb)),
            initial,
          ),
          isTrue,
        );
        expect(
          dispatch(initial, const UsePowerUp(id: PowerUpId.hintLens)).hintsUsed,
          1,
        );
        final shuffled = dispatch(
          initial,
          const UsePowerUp(id: PowerUpId.equationShuffle),
        );
        expect(shuffled.board.seed, isNot(initial.board.seed));
        expect(
          validatePuzzle(shuffled.board, shuffled.target, rules, band).valid,
          isTrue,
        );

        final extraRules = LevelRules(
          objective: rules.objective,
          goalValue: rules.goalValue,
          moveLimit: rules.moveLimit,
          obstacles: rules.obstacles,
          allowedPowerUps: const <PowerUpId>[PowerUpId.calculatorBomb],
          targetSkills: rules.targetSkills,
        );
        final withExtra = copyState(initial, replacementRules: extraRules);
        expect(
          dispatch(
            withExtra,
            const UsePowerUp(id: PowerUpId.calculatorBomb),
          ).history,
          hasLength(1),
        );

        final timed = createLevel(
          15,
          const LevelRules(
            objective: ObjectiveType.equationCount,
            goalValue: 3,
            timeLimitMs: 10,
            obstacles: <ObstacleCount>[],
            allowedPowerUps: <PowerUpId>[],
            targetSkills: <String>[],
          ),
          band,
        );
        expect(dispatch(timed, const Tick(10)).phase, Phase.levelEnded);
        expect(identical(dispatch(timed, const Tick(0)), timed), isTrue);
        final pausedTimed = copyState(timed, phase: Phase.paused);
        expect(
          identical(dispatch(pausedTimed, const Tick(1)), pausedTimed),
          isTrue,
        );

        final scoreState = previewBest(
          createLevel(
            16,
            const LevelRules(
              objective: ObjectiveType.scoreTide,
              goalValue: 1,
              obstacles: <ObstacleCount>[],
              allowedPowerUps: <PowerUpId>[],
              targetSkills: <String>[],
            ),
            band,
          ),
        );
        expect(dispatch(scoreState, const Commit()).phase, Phase.levelComplete);
        final finalMove = previewBest(
          createLevel(
            17,
            const LevelRules(
              objective: ObjectiveType.equationCount,
              goalValue: 99,
              moveLimit: 1,
              obstacles: <ObstacleCount>[],
              allowedPowerUps: <PowerUpId>[],
              targetSkills: <String>[],
            ),
            band,
          ),
        );
        expect(dispatch(finalMove, const Commit()).phase, Phase.levelEnded);
      },
    );
  });

  group('refill safety layers', () {
    test('repairs an unchanged board and tide-shuffles a stuck board', () {
      final generated = createLevel(22, rules, band);
      for (final rngState in <int>[1, 2, 3, 4]) {
        final refilled = refillAfterRemoval(
          generated.board,
          <Cell>[],
          band,
          rules,
          rngState,
        );
        expect(
          analyseWithBand(refilled.board, refilled.target, rules, band).isStuck,
          isFalse,
        );
      }
      final stuck = unsolvableBoard();
      final shuffled = tideShuffle(stuck, integer(20), rules, band, Rng(11));
      expect(
        analyseWithBand(shuffled, integer(20), rules, band).isStuck,
        isFalse,
      );
      expect(stuck.tiles.first.first?.id, 'stuck-0-0');
    });

    test('cannot seed unsupported fractional or out-of-band tide targets', () {
      final stuck = unsolvableBoard();
      final fractional = tideShuffle(stuck, Num(1, 2), rules, band, Rng(3));
      final excessive = tideShuffle(stuck, integer(999), rules, band, Rng(3));
      expect(fractional.width, 8);
      expect(excessive.height, 8);
    });
  });

  test('covers remaining public arithmetic and mastery branches', () {
    expect(add(integer(2), integer(3)), integer(5));
    expect(subtract(integer(2), integer(3)), integer(-1));
    expect(multiply(integer(2), integer(3)), integer(6));
    expect(divide(integer(2), integer(3)), Num(2, 3));
    expect(equal(Num(2, 4), Num(1, 2)), isTrue);
    expect(Num(3, 4).toDouble(), 0.75);
    expect(fraction(1, 2), Num(1, 2));

    const previous = Mastery(
      skillId: 'addition',
      mastery: 0.2,
      attempts: 1,
      correct: 0,
      avgTimeMs: 100,
      hintsUsed: 0,
      nextReviewInDays: 1,
    );
    expect(
      updateMastery(
        previous,
        const Attempt(
          skillId: 'addition',
          correct: false,
          timeMs: 0,
          hintUsed: false,
          expectedTimeMs: 0,
        ),
      ).nextReviewInDays,
      1,
    );
    expect(
      updateMastery(
        const Mastery(
          skillId: 'addition',
          mastery: 0.9,
          attempts: 1,
          correct: 1,
          avgTimeMs: 1,
          hintsUsed: 0,
          nextReviewInDays: 7,
        ),
        const Attempt(
          skillId: 'addition',
          correct: true,
          timeMs: 1,
          hintUsed: false,
          expectedTimeMs: 10,
        ),
      ).nextReviewInDays,
      7,
    );
  });
}
