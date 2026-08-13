import 'package:poko_game_engine/poko_game_engine.dart';

/// Persistence capability consumed by controllers, never by widgets directly.
abstract interface class ProgressStore {
  Future<LevelState?> loadLevel(String profileId);

  Future<void> saveLevel(String profileId, LevelState state);
}
