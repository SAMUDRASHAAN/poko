# Rive React Native qualification result

This document closes the ADR-0001 contingency with retained, controlled evidence
from the two managed physical models pinned by ADR-0010.

## Verdict

**Failed on frame budget.** Both models completed the workload without a crash,
restart, runtime error, readiness timeout, or process-ID change. Memory remained
below budget. Neither model met the required frame-duration or frame-overrun
threshold, so the two-model contingency cannot pass.

ADR-0011 therefore supersedes ADR-0001. React Native Phase 2 work remains frozen
and must not be serialized into the mobile scaffold.

## Tested build

- Provider/project: Firebase Test Lab / `poko-device-lab-20260814`
- Billing: disabled; no-cost physical-device quota
- Runtime: Expo 57.0.10, React Native 0.86.2,
  `@rive-app/react-native` 0.4.19, Nitro Modules 0.35.10, Rive Android 11.7.2
- Qualification source snapshot: `65906e2eef934bd56691dfc451cc5d7ee12aba3b`
  (isolated spike repository; production manifests and lockfile were not changed)
- Spike lineage: `bf51e0e` on `spike/rive-borrowed-rig` (PR #20)
- App APK SHA-256:
  `e4b5b1394d5a053a64eb91c197920cbd223d8e2ca83827e787517214663c448a`
- Instrumentation APK SHA-256:
  `3f16a5be4b93632c22d47e458fe5d9e8a932f6ccf012ca232378e4cc981699e1`

The cloud result directories retain the exact APKs that ran. A later local clean
build succeeds but is not byte-identical, so the hashes above—not a regenerated
APK—identify the qualification binaries.

## Workload

The target was a non-debuggable, shell-profileable ARM release build. AndroidX
Macrobenchmark 1.4.1 performed one unmeasured five-second warm-up followed by five
measured iterations. Each iteration kept three native Rive views active, drove a
numeric state-machine input every 80 ms for ten seconds, then performed twenty
boolean state switches at 150 ms intervals. UI Automator waited for observable
`Rive ready 3/3` and monotonic burst-completion state.

Every iteration retained a Perfetto trace, raw benchmark JSON, process marker,
and `dumpsys meminfo` output. The harness asserted 60 Hz and a stable app PID.

## Results

| Model                         | Matrix                 | Functional result                  | Frame CPU P95 | Frame overrun P95 | Positive-overrun samples | Peak process PSS | Qualification |
| ----------------------------- | ---------------------- | ---------------------------------- | ------------: | ----------------: | -----------------------: | ---------------: | ------------- |
| Galaxy A03s (`a03su`, API 33) | `matrix-k6l44ri6iorga` | 5/5 iterations; PID `27979` stable |      19.93 ms |         +18.33 ms |     3,747/3,820 (98.09%) |       112,474 KB | ❌ frame gate |
| Galaxy A04s (`a04s`, API 34)  | `matrix-22igol2ov72ti` | 5/5 iterations; PID `21330` stable |      18.66 ms |         +19.04 ms |     3,132/4,318 (72.53%) |       104,004 KB | ❌ frame gate |

Required: frame-duration P95 below 16 ms, no positive P95 frame overrun,
fewer than 1% missed/janky frames, process PSS below 220 MB, and no functional
failure. Both devices passed only the memory and functional parts.

## Retained evidence

- A03s result:
  <https://console.firebase.google.com/project/poko-device-lab-20260814/testlab/histories/bh.67311de0eb8e5633/matrices/7114635356255969355>
- A03s raw artifacts:
  `gs://test-lab-xawiq9kh6t1y4-hfm9di99h0u7m/2026-08-14_03:30:40.063181_Nhed/`
- A04s result:
  <https://console.firebase.google.com/project/poko-device-lab-20260814/testlab/histories/bh.67311de0eb8e5633/matrices/8654937236233721759>
- A04s raw artifacts:
  `gs://test-lab-xawiq9kh6t1y4-hfm9di99h0u7m/2026-08-14_03:45:25.399211_VUNh/`

An earlier A03s attempt (`matrix-2rzypzpsf8nkh`) failed before the app launched
because the command named the listener as `androidx.benchmark.junit4` instead of
`androidx.benchmark.macro.junit4`. It contains no product evidence and is excluded
from the verdict. The corrected command reused the same signed APKs.
