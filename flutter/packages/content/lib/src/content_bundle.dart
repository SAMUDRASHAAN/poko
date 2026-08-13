import 'package:poko_game_engine/poko_game_engine.dart';

/// A versioned set of levels validated by the engine/parity gates.
final class ContentBundle {
  const ContentBundle({required this.version, required this.puzzles});

  final int version;
  final List<PuzzleSeed> puzzles;
}

const emptyFoundationContent = ContentBundle(
  version: 1,
  puzzles: <PuzzleSeed>[],
);
