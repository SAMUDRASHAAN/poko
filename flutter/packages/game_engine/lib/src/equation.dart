import 'package:poko_game_engine/src/board.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/types.dart';

InvalidReason? validateChain(Board board, List<Cell> cells, BandConfig band) {
  if (cells.length < band.minChain) {
    return InvalidReason.tooShort;
  }
  if (cells.length > band.maxChain) {
    return InvalidReason.tooLong;
  }

  final first = getTile(board, cells.first);
  if (first == null) {
    return InvalidReason.notAdjacent;
  }
  final visited = <String>{};
  for (var index = 0; index < cells.length; index += 1) {
    final cell = cells[index];
    final tile = getTile(board, cell);
    final key = '${cell.row}:${cell.col}';
    if (tile == null || visited.contains(key)) {
      return InvalidReason.notAdjacent;
    }
    if (index > 0 &&
        !areAdjacent(
          cells[index - 1],
          cell,
          allowDiagonals: band.allowDiagonals,
        )) {
      return InvalidReason.notAdjacent;
    }
    if (tile.colour != first.colour) {
      return InvalidReason.colourMismatch;
    }
    visited.add(key);
  }
  return null;
}

Num _applyOperation(Num left, Num right, Operation operation) =>
    switch (operation) {
      Operation.add || Operation.wild => left + right,
      Operation.sub => left - right,
      Operation.mul => left * right,
      Operation.div => left / right,
    };

Operation _operatorFor(List<Tile> tiles, int index, Operation chainOperation) {
  if (chainOperation != Operation.wild) {
    return chainOperation;
  }
  final ownOperator = tiles[index].ownOperator;
  return ownOperator != null && ownOperator != Operation.wild
      ? ownOperator
      : Operation.add;
}

String _glyph(Operation operation) => switch (operation) {
  Operation.add || Operation.wild => '+',
  Operation.sub => '−',
  Operation.mul => '×',
  Operation.div => '÷',
};

String _display(List<Tile> tiles, Operation operation, Num result) {
  var display = tiles.first.value.toString();
  for (var index = 1; index < tiles.length; index += 1) {
    final nextOperation = _operatorFor(tiles, index, operation);
    display += ' ${_glyph(nextOperation)} ${tiles[index].value}';
  }
  return '$display = $result';
}

Num? chainResult(Board board, List<Cell> cells, BandConfig band) {
  if (validateChain(board, cells, band) != null) {
    return null;
  }
  final tiles = cells
      .map((cell) => getTile(board, cell))
      .whereType<Tile>()
      .toList();
  if (tiles.isEmpty) {
    return null;
  }

  final operation = tiles.first.operation;
  var result = tiles.first.value;
  for (var index = 1; index < tiles.length; index += 1) {
    final nextOperation = _operatorFor(tiles, index, operation);
    try {
      result = _applyOperation(result, tiles[index].value, nextOperation);
    } on DivisionByZeroError {
      return null;
    }
    if (nextOperation == Operation.div && !result.isInteger) {
      return null;
    }
  }
  return result;
}

Equation evaluateChain(Board board, List<Cell> cells, BandConfig band) {
  final tiles = cells
      .map((cell) => getTile(board, cell))
      .whereType<Tile>()
      .toList();
  if (tiles.isEmpty) {
    throw RangeError('cannot evaluate an empty chain');
  }

  final geometryError = validateChain(board, cells, band);
  final operation = tiles.first.operation;
  var result = tiles.first.value;
  InvalidReason? arithmeticError;
  for (
    var index = 1;
    index < tiles.length && arithmeticError == null;
    index += 1
  ) {
    final nextOperation = _operatorFor(tiles, index, operation);
    try {
      result = _applyOperation(result, tiles[index].value, nextOperation);
      if (nextOperation == Operation.div && !result.isInteger) {
        arithmeticError = InvalidReason.inexactDivision;
      }
    } on DivisionByZeroError {
      arithmeticError = InvalidReason.inexactDivision;
    }
  }

  final valueError =
      arithmeticError ??
      (!band.allowNegatives && result.isNegative
          ? InvalidReason.negative
          : result > integer(band.maxTarget)
          ? InvalidReason.exceedsMax
          : null);
  final invalidReason = geometryError ?? valueError;
  return Equation(
    tiles: tiles,
    operation: operation,
    result: result,
    display: _display(tiles, operation, result),
    isValid: invalidReason == null,
    invalidReason: invalidReason,
  );
}
