# Android Macrobenchmark host

This module is the buildable integration point for the managed physical-device
gate. Its foundation test proves that the release-like app can be targeted and
started without network access. Phase 2 replaces/extends this with the scripted
drag, commit, refill, and target-rotation workload before renderer code lands.

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
