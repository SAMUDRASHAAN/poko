import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/types.dart';

/// Build a fresh validated level. Deterministic in [seed].
LevelState createLevel(int seed, LevelRules rules, BandConfig band) =>
    throw UnimplementedError('createLevel is implemented in Phase 1F engine');

/// Pure reducer: identical state and action always produce identical output.
LevelState dispatch(LevelState state, GameAction action) =>
    throw UnimplementedError('dispatch is implemented in Phase 1F engine');

/// Lossless when paired with [restore].
String serialise(LevelState state) =>
    throw UnimplementedError('serialise is implemented in Phase 1F engine');

LevelState restore(String blob) =>
    throw UnimplementedError('restore is implemented in Phase 1F engine');

Analysis analyse(Board board, Num target, LevelRules rules) =>
    throw UnimplementedError('analyse is implemented in Phase 1F engine');

List<PuzzleSeed> generatePack(BandId bandId, int count, int seed) =>
    throw UnimplementedError('generatePack is implemented in Phase 1F engine');

Mastery updateMastery(Mastery previous, Attempt attempt) =>
    throw UnimplementedError('updateMastery is implemented in Phase 1F engine');
