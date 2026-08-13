import 'package:poko_game_engine/src/generator.dart';
import 'package:poko_game_engine/src/machine.dart';
import 'package:poko_game_engine/src/mastery.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/serialisation.dart';
import 'package:poko_game_engine/src/solver.dart';
import 'package:poko_game_engine/src/types.dart';

/// Build a fresh validated level. Deterministic in [seed].
LevelState createLevel(int seed, LevelRules rules, BandConfig band) =>
    createInitialState(seed, rules, band);

/// Pure reducer: identical state and action always produce identical output.
LevelState dispatch(LevelState state, GameAction action) =>
    dispatchGame(state, action);

/// Lossless when paired with [restore].
String serialise(LevelState state) => serialiseState(state);

LevelState restore(String blob) => restoreState(blob);

Analysis analyse(Board board, Num target, LevelRules rules) =>
    analyseBoard(board, target, rules);

List<PuzzleSeed> generatePack(BandId bandId, int count, int seed) =>
    generatePackInternal(bandId, count, seed);

Mastery updateMastery(Mastery previous, Attempt attempt) =>
    updateMasteryModel(previous, attempt);
