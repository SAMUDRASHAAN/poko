import 'package:poko_game_engine/src/types.dart';

bool _isInBounds(Board board, Cell cell) =>
    cell.row >= 0 &&
    cell.row < board.height &&
    cell.col >= 0 &&
    cell.col < board.width;

Tile? getTile(Board board, Cell cell) {
  if (!_isInBounds(board, cell)) {
    return null;
  }
  final row = board.tiles[cell.row];
  return cell.col < row.length ? row[cell.col] : null;
}

bool areAdjacent(Cell a, Cell b, {required bool allowDiagonals}) {
  final rowDistance = (a.row - b.row).abs();
  final colDistance = (a.col - b.col).abs();
  if (rowDistance == 0 && colDistance == 0) {
    return false;
  }
  if (allowDiagonals) {
    return rowDistance <= 1 && colDistance <= 1;
  }
  return rowDistance + colDistance == 1;
}

List<List<Tile?>> _mutableRows(Board board) => List<List<Tile?>>.generate(
  board.height,
  (row) => List<Tile?>.generate(
    board.width,
    (col) => row < board.tiles.length && col < board.tiles[row].length
        ? board.tiles[row][col]
        : null,
  ),
);

Board replaceTiles(Board board, List<({Cell cell, Tile? tile})> replacements) {
  final tiles = _mutableRows(board);
  for (final replacement in replacements) {
    if (!_isInBounds(board, replacement.cell)) {
      throw RangeError(
        'cell (${replacement.cell.row}, ${replacement.cell.col}) is outside board',
      );
    }
    tiles[replacement.cell.row][replacement.cell.col] = replacement.tile;
  }
  return Board(
    width: board.width,
    height: board.height,
    tiles: tiles,
    seed: board.seed,
  );
}

Board removeCells(Board board, List<Cell> cells) =>
    replaceTiles(board, cells.map((cell) => (cell: cell, tile: null)).toList());

Board swapTiles(Board board, Cell a, Cell b) {
  if (!_isInBounds(board, a) || !_isInBounds(board, b)) {
    throw RangeError('cannot swap outside the board');
  }
  return replaceTiles(board, <({Cell cell, Tile? tile})>[
    (cell: a, tile: getTile(board, b)),
    (cell: b, tile: getTile(board, a)),
  ]);
}

Board applyGravity(Board board) {
  final tiles = _mutableRows(board);
  for (var col = 0; col < board.width; col += 1) {
    final present = <Tile>[];
    for (var row = board.height - 1; row >= 0; row -= 1) {
      final tile = getTile(board, Cell(row: row, col: col));
      if (tile != null) {
        present.add(tile);
      }
    }
    for (
      var row = board.height - 1, index = 0;
      row >= 0;
      row -= 1, index += 1
    ) {
      tiles[row][col] = index < present.length ? present[index] : null;
    }
  }
  return Board(
    width: board.width,
    height: board.height,
    tiles: tiles,
    seed: board.seed,
  );
}

List<Cell> allCells(Board board) {
  final cells = <Cell>[];
  for (var row = 0; row < board.height; row += 1) {
    for (var col = 0; col < board.width; col += 1) {
      cells.add(Cell(row: row, col: col));
    }
  }
  return cells;
}
