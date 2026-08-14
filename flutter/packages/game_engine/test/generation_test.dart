import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/generator.dart';
import 'package:poko_game_engine/src/refill.dart';
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

void main() {
  group('solution-first generation', () {
    test('matches the frozen seed 12345 oracle snapshot', () {
      final state = createInitialState(12345, rules, band);
      expect(state.target, integer(12));
      expect(
        state.board.tiles.first
            .map(
              (tile) => tile == null
                  ? null
                  : <Object>[
                      tile.value.numerator,
                      tile.operation.name,
                      tile.colour.name,
                    ],
            )
            .toList(),
        <List<Object>?>[
          <Object>[8, 'add', 'coral'],
          <Object>[7, 'add', 'coral'],
          <Object>[3, 'add', 'coral'],
          <Object>[6, 'add', 'coral'],
          <Object>[5, 'sub', 'marine'],
          <Object>[5, 'sub', 'marine'],
          <Object>[9, 'sub', 'marine'],
          <Object>[2, 'add', 'coral'],
        ],
      );
      expect(createInitialState(12345, rules, band).rngState, state.rngState);
    });

    test('keeps 300 deterministic arbitrary seeds solvable', () {
      for (var index = 0; index < 300; index += 1) {
        final seed = (index * 2654435761) & 0xffffffff;
        final state = createInitialState(seed, rules, band);
        final analysis = analyseWithBand(
          state.board,
          state.target,
          state.rules,
          state.band,
        );
        expect(analysis.isStuck, isFalse, reason: 'seed $seed');
      }
    });

    test('generates deterministic validated packs', () {
      final pack = generatePackInternal(BandId.sprout, 3, 99);
      expect(pack, hasLength(3));
      expect(pack.map((puzzle) => puzzle.id).toList(), <String>[
        'sprout-53',
        'sprout-17wdrty',
        'sprout-grnhm5',
      ]);
      expect(pack.every((puzzle) => puzzle.validation.solvable), isTrue);
      expect(
        generatePackInternal(BandId.sprout, 3, 99).map((e) => e.id),
        pack.map((e) => e.id),
      );
      expect(generatePackInternal(BandId.sprout, 0, 1), isEmpty);
    });
  });

  group('solution-aware refill', () {
    test('preserves its input and keeps 100 refills solvable', () {
      for (var seed = 1; seed <= 100; seed += 1) {
        final state = createInitialState(seed, rules, band);
        final solution = analyseWithBand(
          state.board,
          state.target,
          rules,
          band,
        ).bestSolution;
        expect(solution, isNotNull);
        final before = state.board.tiles
            .map((row) => row.map((tile) => tile?.id).toList())
            .toList();
        final refilled = refillAfterRemoval(
          state.board,
          solution!.cells,
          band,
          rules,
          state.rngState,
        );
        expect(
          analyseWithBand(refilled.board, refilled.target, rules, band).isStuck,
          isFalse,
          reason: 'seed $seed',
        );
        expect(
          state.board.tiles
              .map((row) => row.map((tile) => tile?.id).toList())
              .toList(),
          before,
        );
      }
    });

    test('validator rejects an empty puzzle for all required reasons', () {
      const empty = Board(
        width: 1,
        height: 1,
        seed: 1,
        tiles: <List<Tile?>>[
          <Tile?>[null],
        ],
      );
      expect(
        validatePuzzle(empty, integer(1), rules, band).reasons,
        <ValidationReason>[
          ValidationReason.unsolvable,
          ValidationReason.tooFewSolutions,
          ValidationReason.weakDecoys,
        ],
      );
    });
  });
}
