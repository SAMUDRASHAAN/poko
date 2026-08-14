import 'package:poko_game_engine/poko_game_engine.dart';
import 'package:poko_game_engine/src/board.dart';
import 'package:poko_game_engine/src/equation.dart';
import 'package:poko_game_engine/src/rng.dart';
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

Tile tile(String id, int value, [Operation operation = Operation.add]) => Tile(
  id: id,
  value: integer(value),
  colour: operation == Operation.sub ? TileColour.marine : TileColour.coral,
  operation: operation,
);

void main() {
  group('seeded RNG', () {
    test('matches the frozen xorshift32 golden sequence', () {
      final rng = Rng(12345);
      expect(List<int>.generate(8, (_) => rng.nextInt(1, 10)), <int>[
        8,
        4,
        7,
        5,
        2,
        8,
        10,
        9,
      ]);
    });

    test('is deterministic, resumable, and handles zero', () {
      final first = Rng(42);
      final second = Rng(42);
      expect(
        List<int>.generate(100, (_) => first.nextInt(0, 999)),
        List<int>.generate(100, (_) => second.nextInt(0, 999)),
      );
      final zero = Rng(0);
      final initial = zero.state;
      expect(zero.nextUnit(), inInclusiveRange(0, 1));
      expect(zero.state, isNot(initial));
    });

    test('validates ranges and never mutates shuffled input', () {
      final input = <int>[1, 2, 3, 4, 5, 6, 7, 8];
      final shuffled = Rng(99).shuffle(input)..sort();
      expect(shuffled, input);
      expect(input, <int>[1, 2, 3, 4, 5, 6, 7, 8]);
      expect(() => Rng(7).nextInt(9, 3), throwsRangeError);
      expect(() => Rng(7).pick(<int>[]), throwsRangeError);
    });
  });

  group('board primitives', () {
    final board = Board(
      width: 2,
      height: 3,
      seed: 1,
      tiles: <List<Tile?>>[
        <Tile?>[tile('a', 1), tile('b', 2)],
        <Tile?>[tile('c', 3), null],
        <Tile?>[tile('d', 4), tile('e', 5)],
      ],
    );

    test('reads bounds and recognizes cardinal and diagonal adjacency', () {
      expect(getTile(board, const Cell(row: 0, col: 0))?.id, 'a');
      expect(getTile(board, const Cell(row: -1, col: 0)), isNull);
      expect(
        areAdjacent(
          const Cell(row: 0, col: 0),
          const Cell(row: 1, col: 0),
          allowDiagonals: false,
        ),
        isTrue,
      );
      expect(
        areAdjacent(
          const Cell(row: 0, col: 0),
          const Cell(row: 1, col: 1),
          allowDiagonals: false,
        ),
        isFalse,
      );
      expect(
        areAdjacent(
          const Cell(row: 0, col: 0),
          const Cell(row: 1, col: 1),
          allowDiagonals: true,
        ),
        isTrue,
      );
    });

    test('removes, swaps, and applies gravity without source mutation', () {
      final removed = removeCells(board, const <Cell>[Cell(row: 2, col: 0)]);
      final swapped = swapTiles(
        board,
        const Cell(row: 0, col: 0),
        const Cell(row: 2, col: 1),
      );
      expect(getTile(removed, const Cell(row: 2, col: 0)), isNull);
      expect(getTile(swapped, const Cell(row: 0, col: 0))?.id, 'e');
      expect(getTile(board, const Cell(row: 0, col: 0))?.id, 'a');
      expect(
        () => swapTiles(
          board,
          const Cell(row: 0, col: 0),
          const Cell(row: 9, col: 9),
        ),
        throwsRangeError,
      );

      final fallen = applyGravity(removed);
      expect(fallen.tiles.map((row) => row[0]?.id).toList(), <String?>[
        null,
        'a',
        'c',
      ]);
      expect(fallen.tiles.map((row) => row[1]?.id).toList(), <String?>[
        null,
        'b',
        'e',
      ]);
    });
  });

  group('equation evaluation', () {
    final board = Board(
      width: 3,
      height: 2,
      seed: 2,
      tiles: <List<Tile?>>[
        <Tile?>[
          tile('a', 8, Operation.sub),
          tile('b', 3, Operation.sub),
          tile('c', 2, Operation.sub),
        ],
        <Tile?>[tile('d', 2), tile('e', 4), tile('f', 5)],
      ],
    );

    test('evaluates ordered chains exactly and formats their preview', () {
      final equation = evaluateChain(board, const <Cell>[
        Cell(row: 0, col: 0),
        Cell(row: 0, col: 1),
        Cell(row: 0, col: 2),
      ], band);
      expect(equation.result, integer(3));
      expect(equation.display, '8 − 3 − 2 = 3');
      expect(equation.isValid, isTrue);
    });

    test(
      'rejects geometry, colour, negative, excessive, and fractional results',
      () {
        expect(
          validateChain(board, const <Cell>[Cell(row: 0, col: 0)], band),
          InvalidReason.tooShort,
        );
        expect(
          validateChain(board, const <Cell>[
            Cell(row: 0, col: 0),
            Cell(row: 1, col: 1),
          ], band),
          InvalidReason.notAdjacent,
        );
        expect(
          validateChain(board, const <Cell>[
            Cell(row: 0, col: 1),
            Cell(row: 1, col: 1),
          ], band),
          InvalidReason.colourMismatch,
        );
        expect(
          evaluateChain(board, const <Cell>[
            Cell(row: 0, col: 2),
            Cell(row: 0, col: 1),
          ], band).invalidReason,
          InvalidReason.negative,
        );

        final division = Board(
          width: 2,
          height: 1,
          seed: 3,
          tiles: <List<Tile?>>[
            <Tile?>[tile('a', 7, Operation.div), tile('b', 2, Operation.div)],
          ],
        );
        expect(
          evaluateChain(division, const <Cell>[
            Cell(row: 0, col: 0),
            Cell(row: 0, col: 1),
          ], band).invalidReason,
          InvalidReason.inexactDivision,
        );
      },
    );

    test('supports mixed wild operators in left-to-right order', () {
      final wild = Board(
        width: 3,
        height: 1,
        seed: 6,
        tiles: <List<Tile?>>[
          <Tile?>[
            Tile(
              id: 'a',
              value: integer(8),
              colour: TileColour.violet,
              operation: Operation.wild,
            ),
            Tile(
              id: 'b',
              value: integer(3),
              colour: TileColour.violet,
              operation: Operation.wild,
              ownOperator: Operation.sub,
            ),
            Tile(
              id: 'c',
              value: integer(2),
              colour: TileColour.violet,
              operation: Operation.wild,
              ownOperator: Operation.mul,
            ),
          ],
        ],
      );
      final wildBand = BandConfig(
        id: BandId.pathfinder,
        numberRange: band.numberRange,
        allowedOperations: const <Operation>[Operation.wild],
        allowedColours: const <TileColour>[TileColour.violet],
        minChain: 2,
        maxChain: 3,
        maxTarget: band.maxTarget,
        allowNegatives: band.allowNegatives,
        allowDiagonals: band.allowDiagonals,
        minSolutions: band.minSolutions,
        maxSolutions: band.maxSolutions,
      );
      final equation = evaluateChain(wild, const <Cell>[
        Cell(row: 0, col: 0),
        Cell(row: 0, col: 1),
        Cell(row: 0, col: 2),
      ], wildBand);
      expect(equation.result, integer(10));
      expect(equation.display, '8 − 3 × 2 = 10');
    });
  });

  group('solver', () {
    test('finds and orders every reachable solution', () {
      final board = Board(
        width: 2,
        height: 2,
        seed: 10,
        tiles: <List<Tile?>>[
          <Tile?>[tile('a', 1), tile('b', 2)],
          <Tile?>[tile('c', 2), tile('d', 9, Operation.sub)],
        ],
      );
      final analysis = analyseWithBand(board, integer(3), rules, band);
      expect(analysis.isStuck, isFalse);
      expect(analysis.bestSolution?.cells.length, 2);
      expect(analysis.solutions.length, 4);
      expect(analysis.hiddenSolutions, 3);
    });

    test('rules-only analysis handles empty boards', () {
      const empty = Board(
        width: 1,
        height: 1,
        seed: 1,
        tiles: <List<Tile?>>[
          <Tile?>[null],
        ],
      );
      expect(analyseBoard(empty, integer(1), rules).isStuck, isTrue);
    });
  });
}
