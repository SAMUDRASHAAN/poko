# ADR-0012: Flutter foundation dependencies

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

ADR-0011 selects Flutter, Flame, and the official Rive Flutter runtime after the
React Native contingency failed. The repository requires an exact, reviewable
foundation before feature work: one SDK pin, one Dart workspace resolution, a
pure engine boundary, a local-first persistence boundary, and a buildable offline
app shell.

Every dependency expands supply-chain, binary-size, privacy, and upgrade risk.
This is especially material in a child-zone client, where analytics, ads, and
unnecessary network-capable SDKs are prohibited.

## Decision

Pin Flutter 3.44.2 stable (framework revision `c9a6c48423`) and Dart 3.12.2. Use a
native Dart pub workspace with one root `pubspec.lock`; do not add Melos or another
workspace orchestrator.

Approve only these hosted foundation packages:

| Package         | Version | Scope                   | Reason                                                                          |
| --------------- | ------: | ----------------------- | ------------------------------------------------------------------------------- |
| `flame`         |  1.38.0 | mobile app              | one game/update/render/input loop for the board                                 |
| `rive`          | 0.14.11 | mobile app              | official Rive Flutter runtime selected by ADR-0011                              |
| `drift`         |  2.34.3 | client-data             | typed SQLite queries, migrations and transactions                               |
| `drift_flutter` |   0.3.1 | client-data             | native/web database opening without app-owned platform branching                |
| `flutter_lints` |   6.0.0 | development             | Flutter-published analyzer baseline, strengthened locally                       |
| `test`          |  1.31.0 | pure-Dart package tests | highest stable runner compatible with Flutter 3.44.2's pinned `test_api` 0.7.11 |

Flutter SDK packages `flutter`, `flutter_test`, and `integration_test` are also
allowed where their package role requires them. Code generation packages for
Drift are deferred until Phase 3 writes a schema; adding them requires a separate
dependency review at that serialized sync point.

Do not add a state-management, routing, HTTP, Supabase, analytics, ads, crash,
remote-config, or attribution package in the foundation. Controllers and the
standard Flutter navigator are sufficient for the empty shell. A later phase may
propose the minimum missing capability through another ADR.

Use hosted stable releases, never a Git dependency or prerelease. The lockfile is
committed and CI resolves it with `--enforce-lockfile`.

## Consequences

- The pure Dart game engine has zero runtime dependencies and no Flutter import.
- The app can compile Flame and Rive native dependencies before board feature work,
  exposing toolchain problems at the cheapest point.
- Drift establishes SQLite as the local source-of-truth implementation path while
  schema and code generation remain correctly deferred to Phase 3.
- Rive native binaries increase build/download size. Gate 2 and the install-size
  budget remain mandatory; the dependency is not accepted unconditionally for
  every asset or screen.
- Rive Native 0.1.11 and Drift's transitive JNI plugins emit AGP 9
  built-in-Kotlin migration warnings. Current release and Macrobenchmark builds
  pass; these compatibility warnings must be rechecked before a Flutter/AGP
  upgrade.
- Pub workspaces force one compatible resolution across app and packages, reducing
  worktree-specific dependency drift.

## Sources

- Flutter/Dart toolchain: <https://docs.flutter.dev/release/archive>
- Dart pub workspaces: <https://dart.dev/tools/pub/workspaces>
- Flame: <https://pub.dev/packages/flame>
- Rive Flutter: <https://pub.dev/packages/rive>
- Drift: <https://pub.dev/packages/drift>
- Drift Flutter: <https://pub.dev/packages/drift_flutter>
- Flutter lints: <https://pub.dev/packages/flutter_lints>
- Dart test: <https://pub.dev/packages/test>
