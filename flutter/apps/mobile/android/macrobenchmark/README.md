# Android Macrobenchmark host

This module is the buildable integration point for the managed physical-device
gate. Its foundation test proves that the release-like app can be targeted and
started without network access. `BoardMacrobenchmark` is the Phase 2 workload:
one unmeasured warm-up followed by five measured iterations of twelve scripted
drag → commit → refill → target-rotation cycles. AndroidX captures frame timing,
maximum memory use, raw benchmark JSON, and a Perfetto trace for every iteration.

The workload intentionally lands before the board renderer and is red until the
app exposes all of these persistent semantic descriptions:

- `Poko Gate 2 board ready` and `Poko Gate 2 Rive ready`;
- four drag anchors, `Poko Gate 2 path 0` through `path 3`;
- monotonically increasing `Poko Gate 2 commits N`, `refills N`,
  `target rotations N`, and `assertions passed N` markers.

The counters prevent a smooth no-op animation from satisfying the performance
gate. A measured cycle counts only after real engine commit, refill, target
rotation, Rive readiness, and UI assertions have all completed.

Build the two Firebase Test Lab artifacts from `apps/mobile/android`:

```sh
./gradlew :app:assembleBenchmark :macrobenchmark:assembleBenchmark \
  -Ptarget-platform=android-arm64
```

From `apps/mobile`, the expected artifacts are
`build/app/outputs/apk/benchmark/app-benchmark.apk` and
`build/macrobenchmark/outputs/apk/benchmark/macrobenchmark-benchmark.apk`.
Device qualification uses the exact artifact hashes and the corrected listener
`androidx.benchmark.macro.junit4.SideEffectRunListener`.

Run the instrumentation APK only on the two pinned physical profiles. Emulator
suppression exists to keep the artifact buildable for local plumbing checks; an
emulator result is never Gate 2 evidence.
