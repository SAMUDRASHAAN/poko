# Poko game engine

Pure, deterministic Dart gameplay core with zero runtime dependencies. The
public `Num`, data/action types, and entry-point signatures are frozen; the
implementation matches the pinned TypeScript oracle.

Run the package gates from this directory:

```sh
dart test
dart test --coverage-path=coverage/lcov.info --concurrency=1
dart -DFUZZ_RUNS=100000 run bin/fuzz_gate.dart
```

The full fuzz command verifies 100,000 generated boards have a solution and
fails when `analyse()` P95 is 5 ms or slower. The regular suite retains a
500-board smoke sample plus golden RNG, board, pack, complete-state serialization
and action-trace oracle snapshots.
