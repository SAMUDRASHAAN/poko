import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/types.dart';

const _orthogonalDeltas = <(int, int)>[(-1, 0), (0, -1), (0, 1), (1, 0)];

const _diagonalDeltas = <(int, int)>[
  (-1, -1),
  (-1, 0),
  (-1, 1),
  (0, -1),
  (0, 1),
  (1, -1),
  (1, 0),
  (1, 1),
];

Operation _operationFor(Tile tile, Operation chainOperation) {
  if (chainOperation != Operation.wild) {
    return chainOperation;
  }
  final ownOperator = tile.ownOperator;
  return ownOperator != null && ownOperator != Operation.wild
      ? ownOperator
      : Operation.add;
}

Num? _applyOperation(Num left, Tile tile, Operation chainOperation) {
  final operation = _operationFor(tile, chainOperation);
  return switch (operation) {
    Operation.add || Operation.wild => left + tile.value,
    Operation.sub => left - tile.value,
    Operation.mul => left * tile.value,
    Operation.div =>
      tile.value.isZero
          ? null
          : switch (left / tile.value) {
              final quotient when quotient.isInteger => quotient,
              _ => null,
            },
  };
}

int _compareSolutions(Solution left, Solution right) {
  if (left.cells.length != right.cells.length) {
    return left.cells.length - right.cells.length;
  }
  for (var index = 0; index < left.cells.length; index += 1) {
    final leftCell = left.cells[index];
    final rightCell = right.cells[index];
    if (leftCell.row != rightCell.row) {
      return leftCell.row - rightCell.row;
    }
    if (leftCell.col != rightCell.col) {
      return leftCell.col - rightCell.col;
    }
  }
  return 0;
}

Analysis analyseWithBand(
  Board board,
  Num target,
  LevelRules rules,
  BandConfig band,
) {
  final solutions = <Solution>[];
  final tileCount = board.width * board.height;
  final tiles = List<Tile?>.filled(tileCount, null);
  for (var row = 0; row < board.height; row += 1) {
    for (var col = 0; col < board.width; col += 1) {
      tiles[row * board.width +
          col] = row < board.tiles.length && col < board.tiles[row].length
          ? board.tiles[row][col]
          : null;
    }
  }

  final visited = List<bool>.filled(tileCount, false);
  final path = <int>[];
  final exactLength = rules.objective == ObjectiveType.exactlyThree ? 3 : null;
  final deltas = band.allowDiagonals ? _diagonalDeltas : _orthogonalDeltas;

  void visit(
    int index,
    TileColour colour,
    Operation chainOperation,
    Num result,
  ) {
    visited[index] = true;
    path.add(index);

    if (path.length >= band.minChain &&
        (exactLength == null || path.length == exactLength)) {
      final legalValue =
          (band.allowNegatives || !result.isNegative) &&
          result.numerator <= band.maxTarget * result.denominator;
      if (legalValue && result == target) {
        solutions.add(
          Solution(
            cells: path
                .map(
                  (pathIndex) => Cell(
                    row: pathIndex ~/ board.width,
                    col: pathIndex % board.width,
                  ),
                )
                .toList(),
            result: result,
          ),
        );
      }
    }

    if (path.length < band.maxChain) {
      final row = index ~/ board.width;
      final col = index % board.width;
      for (final delta in deltas) {
        final nextRow = row + delta.$1;
        final nextCol = col + delta.$2;
        if (nextRow < 0 ||
            nextRow >= board.height ||
            nextCol < 0 ||
            nextCol >= board.width) {
          continue;
        }
        final nextIndex = nextRow * board.width + nextCol;
        final nextTile = tiles[nextIndex];
        if (nextTile == null ||
            nextTile.colour != colour ||
            visited[nextIndex]) {
          continue;
        }
        final nextResult = _applyOperation(result, nextTile, chainOperation);
        if (nextResult != null) {
          visit(nextIndex, colour, chainOperation, nextResult);
        }
      }
    }

    path.removeLast();
    visited[index] = false;
  }

  for (var index = 0; index < tileCount; index += 1) {
    final tile = tiles[index];
    if (tile != null) {
      visit(index, tile.colour, tile.operation, tile.value);
    }
  }

  solutions.sort(_compareSolutions);
  final bestSolution = solutions.isEmpty ? null : solutions.first;
  return Analysis(
    solutions: solutions,
    bestSolution: bestSolution,
    hiddenSolutions: solutions.isEmpty ? 0 : solutions.length - 1,
    setupMoves: bestSolution == null ? 1 : 0,
    isStuck: bestSolution == null,
    accidentals: solutions.skip(1).toList(),
  );
}

Analysis analyseBoard(Board board, Num target, LevelRules rules) {
  final operations = <Operation>[];
  final colours = <TileColour>[];
  for (final row in board.tiles) {
    for (final tile in row) {
      if (tile == null) {
        continue;
      }
      if (!operations.contains(tile.operation)) {
        operations.add(tile.operation);
      }
      if (!colours.contains(tile.colour)) {
        colours.add(tile.colour);
      }
    }
  }
  final exactThree = rules.objective == ObjectiveType.exactlyThree;
  final inferredBand = BandConfig(
    id: BandId.sprout,
    numberRange: const IntRange(-9007199254740991, 9007199254740991),
    allowedOperations: operations.isEmpty
        ? const <Operation>[Operation.add]
        : operations,
    allowedColours: colours.isEmpty
        ? const <TileColour>[TileColour.coral]
        : colours,
    minChain: exactThree ? 3 : 2,
    maxChain: exactThree ? 3 : 5,
    maxTarget: 9007199254740991,
    allowNegatives: target.isNegative,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 9007199254740991,
  );
  return analyseWithBand(board, target, rules, inferredBand);
}
