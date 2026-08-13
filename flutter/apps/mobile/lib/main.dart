import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:poko_client_data/poko_client_data.dart';
import 'package:poko_content/poko_content.dart';
import 'package:poko_design_system/poko_design_system.dart';
import 'package:rive/rive.dart' as rive;

void main() {
  runApp(const PokoApp());
}

/// Keeps the official Rive runtime in the compiled foundation without requiring
/// a placeholder art asset. Phase 2 owns real artboards and controllers.
Type get riveRuntimeWidgetType => rive.RiveWidget;

/// Compiles the local-first persistence boundary without opening a database.
Type get persistenceBoundaryType => ProgressStore;

final class FoundationGame extends FlameGame {
  @override
  Color backgroundColor() => PokoColour.foam;
}

class PokoApp extends StatelessWidget {
  const PokoApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: pokoFoundationTheme(),
    home: const FoundationScreen(),
  );
}

class FoundationScreen extends StatefulWidget {
  const FoundationScreen({super.key});

  @override
  State<FoundationScreen> createState() => _FoundationScreenState();
}

class _FoundationScreenState extends State<FoundationScreen> {
  late final FoundationGame _game;

  @override
  void initState() {
    super.initState();
    _game = FoundationGame();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(
      children: <Widget>[
        Positioned.fill(child: GameWidget<FoundationGame>(game: _game)),
        Center(
          child: Semantics(
            label: 'Poko foundation ready',
            child: ExcludeSemantics(
              child: Text(
                emptyFoundationContent.puzzles.isEmpty
                    ? 'Poko foundation ready'
                    : 'Poko content ready',
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
