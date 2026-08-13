# Poko Flutter workspace

The production client is pinned to Flutter 3.44.2 stable and Dart 3.12.2. The
single pub workspace and root lockfile are authoritative; do not run `pub get`
inside a child package or commit nested lockfiles.

## Bootstrap

```sh
cd flutter
flutter --version
flutter pub get --enforce-lockfile
dart pub workspace list
```

For the first dependency resolution after an intentional manifest edit, run
`flutter pub get`, review `pubspec.lock`, and commit it with the manifest.

## Verify

```sh
cd flutter
dart run tool/verify_workspace.dart
cd apps/mobile
flutter build apk --release --target-platform android-arm64 --split-per-abi
```

The verifier checks formatting, analysis, package boundaries, forbidden SDKs,
and every Dart/widget test. The TypeScript oracle remains separately gated by
`pnpm verify:gate1` at the repository root.

## Package boundaries

- `apps/mobile`: offline app shell and, later, screens and Flame board.
- `packages/game_engine`: deterministic Dart core; Dart core imports only.
- `packages/content`: typed authored content that depends on the engine contract.
- `packages/design_system`: frozen tokens and game-agnostic Flutter UI.
- `packages/client_data`: local persistence boundary; SQLite remains the source of
  truth.

See `../ARCHITECTURE.md` and `../docs/adr/0012-flutter-foundation-dependencies.md`
before changing dependencies or boundaries.
