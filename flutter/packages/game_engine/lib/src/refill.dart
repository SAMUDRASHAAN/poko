import 'package:poko_game_engine/src/board.dart';
import 'package:poko_game_engine/src/generator.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/rng.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:poko_game_engine/src/types.dart';
import 'package:poko_game_engine/src/validator.dart';

final class RefillResult {
  const RefillResult({
    required this.board,
    required this.target,
    required this.rngState,
  });

  final Board board;
  final Num target;
  final int rngState;
}

(Cell, Cell)? _emptyAdjacentPair(List<Cell> emptyCells) {
  final empty = emptyCells.map((cell) => '${cell.row}:${cell.col}').toSet();
  for (final cell in emptyCells) {
    final right = Cell(row: cell.row, col: cell.col + 1);
    final below = Cell(row: cell.row + 1, col: cell.col);
    if (empty.contains('${right.row}:${right.col}')) {
      return (cell, right);
    }
    if (empty.contains('${below.row}:${below.col}')) {
      return (cell, below);
    }
  }
  return null;
}

(Cell, Cell) _repairPair(Board board, Rng rng) {
  final horizontal = rng.nextInt(0, 1) == 0;
  if (horizontal) {
    final row = rng.nextInt(0, board.height - 1);
    final col = rng.nextInt(0, board.width - 2);
    return (Cell(row: row, col: col), Cell(row: row, col: col + 1));
  }
  final row = rng.nextInt(0, board.height - 2);
  final col = rng.nextInt(0, board.width - 1);
  return (Cell(row: row, col: col), Cell(row: row + 1, col: col));
}

GuaranteedSolution _chooseRefillSolution(
  Rng rng,
  BandConfig band,
  Board survivors,
) {
  for (final fitted in rankTargetsForBoard(survivors, band)) {
    final solution = solutionForTarget(rng, band, fitted);
    if (solution != null) {
      return solution;
    }
  }
  return chooseGuaranteedSolution(rng, band);
}

const int _tideShuffleAttempts = 8;

Board tideShuffle(
  Board board,
  Num target,
  LevelRules rules,
  BandConfig band,
  Rng rng,
) {
  final cells = allCells(board);
  final present = cells
      .map((cell) => getTile(board, cell))
      .whereType<Tile>()
      .toList();
  var stirred = board;
  for (var attempt = 0; attempt < _tideShuffleAttempts; attempt += 1) {
    final shuffled = rng.shuffle(present);
    var index = 0;
    stirred = replaceTiles(
      board,
      cells
          .map(
            (cell) => (
              cell: cell,
              tile: getTile(board, cell) == null ? null : shuffled[index++],
            ),
          )
          .toList(),
    );
    if (analyseWithBand(stirred, target, rules, band).solutions.isNotEmpty) {
      return stirred;
    }
  }
  if (!target.isInteger) {
    return stirred;
  }
  final solution = solutionForTarget(rng, band, target.numerator);
  if (solution == null) {
    return stirred;
  }
  final pair = _repairPair(stirred, rng);
  final guaranteed = solutionTiles(solution, 'tide-${rng.state}');
  return replaceTiles(stirred, <({Cell cell, Tile? tile})>[
    (cell: pair.$1, tile: guaranteed.$1),
    (cell: pair.$2, tile: guaranteed.$2),
  ]);
}

RefillResult refillAfterRemoval(
  Board board,
  List<Cell> removed,
  BandConfig band,
  LevelRules rules,
  int rngState,
) {
  final fallen = applyGravity(removeCells(board, removed));
  final emptyCells = allCells(
    fallen,
  ).where((cell) => getTile(fallen, cell) == null).toList();
  final rng = Rng(rngState);
  final solution = _chooseRefillSolution(rng, band, fallen);
  final preferredPair = _emptyAdjacentPair(emptyCells);
  final ordered = List<Cell>.of(emptyCells)
    ..sort((left, right) {
      final byRow = left.row - right.row;
      return byRow != 0 ? byRow : left.col - right.col;
    });

  var filled = fallen;
  for (var index = 0; index < ordered.length; index += 1) {
    final cell = ordered[index];
    final id = 'refill-$rngState-$index';
    final left = cell.col > 0
        ? getTile(filled, Cell(row: cell.row, col: cell.col - 1))
        : null;
    final above = cell.row > 0
        ? getTile(filled, Cell(row: cell.row - 1, col: cell.col))
        : null;
    final anchors = <Tile>[?left, ?above];
    final nearMiss = anchors.isNotEmpty && shouldNearMiss(rng)
        ? nearMissTile(rng, band, solution.target, anchors, id)
        : null;
    filled = replaceTiles(filled, <({Cell cell, Tile? tile})>[
      (cell: cell, tile: nearMiss ?? randomTile(rng, band, id)),
    ]);
  }

  final guaranteed = solutionTiles(solution, 'refill-$rngState-solution');
  final seeded = preferredPair == null
      ? filled
      : replaceTiles(filled, <({Cell cell, Tile? tile})>[
          (cell: preferredPair.$1, tile: guaranteed.$1),
          (cell: preferredPair.$2, tile: guaranteed.$2),
        ]);
  if (analyseWithBand(
    seeded,
    solution.target,
    rules,
    band,
  ).solutions.isNotEmpty) {
    return RefillResult(
      board: seeded,
      target: solution.target,
      rngState: rng.state,
    );
  }

  final pair = _repairPair(seeded, rng);
  final repaired = replaceTiles(seeded, <({Cell cell, Tile? tile})>[
    (cell: pair.$1, tile: guaranteed.$1),
    (cell: pair.$2, tile: guaranteed.$2),
  ]);
  if (analyseWithBand(
    repaired,
    solution.target,
    rules,
    band,
  ).solutions.isNotEmpty) {
    return RefillResult(
      board: repaired,
      target: solution.target,
      rngState: rng.state,
    );
  }
  return RefillResult(
    board: tideShuffle(repaired, solution.target, rules, band, rng),
    target: solution.target,
    rngState: rng.state,
  );
}
