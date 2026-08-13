# Managed Android device profile

This is the mutable provider catalog pin for ADR-0010. The ADR defines what
qualifies; this document records the concrete models used to satisfy it.

## Active provider

Firebase Test Lab, queried with Google Cloud CLI 580.0.0 on 2026-08-14.

## Pinned qualification models

| Provider model ID | Device              | API | Catalog evidence                                             | Hardware evidence                                    |
| ----------------- | ------------------- | --: | ------------------------------------------------------------ | ---------------------------------------------------- |
| `a03su`           | Samsung Galaxy A03s |  33 | physical phone; `arm64-v8a`; `DEVICE_CAPACITY_LOW`; 720×1600 | 3 GB RAM; MediaTek Helio P35; 60 Hz                  |
| `a04s`            | Samsung Galaxy A04s |  34 | physical phone; `arm64-v8a`; `DEVICE_CAPACITY_LOW`; 720×1600 | 3–4 GB RAM; Exynos 850; app-requested 60 Hz required |

The catalog evidence above comes from `gcloud firebase test android models
describe`. Hardware facts come from the manufacturers' published specifications:

- Samsung Galaxy A03s spec sheet:
  <https://image-us.samsung.com/SamsungUS/samsungbusiness/pdf/spec-sheets/Galaxy_A03s_Unlocked_SpecSheet.pdf>
- Samsung Galaxy A04s announcement and specifications:
  <https://news.samsung.com/uk/samsung-welcomes-two-new-additions-to-the-a-series-the-a04s-and-the-a23-5g>

The Test Lab catalog does not expose physical RAM directly. The manufacturer
specifications establish that each catalog model belongs to the approved 3–4 GB
product family; the execution must still retain runtime `MemTotal` when the
instrumentation environment permits it.

## Execution configuration

Each model runs separately with:

- physical device form only;
- the pinned Android API, portrait, `en`, `US`;
- non-debuggable ARM64 release APK and instrumentation APK pinned by SHA-256;
- one unmeasured warm-up followed by at least five measured iterations;
- app-requested 60 Hz rendering for displays that expose a higher refresh mode;
- raw result JSON, frame traces, device catalog JSON, logs, and memory readings
  retained together under the tested app commit.

## Acceptance

Rive and Gate 2 are evaluated independently against ADR-0010. Both pinned models
must pass; replacing a model requires recording the replacement, catalog output,
hardware evidence, and reason in this file before the run.

## Rive qualification evidence (2026-08-14)

Both pinned models completed the controlled, non-debuggable Nitro Rive workload:
one warm-up and five measured iterations at verified 60 Hz, with three native
Rive views, sustained 80 ms numeric-input updates, and twenty 150 ms state
switches per iteration. Both were functionally stable and below the memory
ceiling, but both missed the frame budget.

| Model                         | Matrix                 | Frame CPU P95 | Frame overrun P95 |   Peak PSS | Result                 |
| ----------------------------- | ---------------------- | ------------: | ----------------: | ---------: | ---------------------- |
| Galaxy A03s (`a03su`, API 33) | `matrix-k6l44ri6iorga` |      19.93 ms |         +18.33 ms | 112,474 KB | ❌ ADR-0001 frame gate |
| Galaxy A04s (`a04s`, API 34)  | `matrix-22igol2ov72ti` |      18.66 ms |         +19.04 ms | 104,004 KB | ❌ ADR-0001 frame gate |

All ten iteration markers, all ten Perfetto traces, raw benchmark JSON, meminfo,
logs, exact APKs, device/API identity, and stable per-device PIDs are retained.
See `06-rive-spike-results.md` for hashes, artifact locations, methodology, and
the excluded pre-launch runner-configuration failure. ADR-0011 records the
resulting Flutter decision.

## Physical smoke evidence (2026-08-14)

These are **functional cloud-path checks, not ADR-0001 or Gate 2 performance
verdicts**. Firebase Robo exercised the controls opportunistically; it did not run
five controlled iterations or collect Macrobenchmark frame distributions.

Release APK SHA-256:
`748a78db389bff50b99a9d76250fdca2d2058fe6298622986c00e91e210b95b3`.

| Model                         | Matrix                 | Result                    | Observed behavior                                                                                                                                           |
| ----------------------------- | ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Galaxy A03s (`a03su`, API 33) | `matrix-2mi4l9r1xx6wr` | ✅ 49 s physical Robo run | rendered Rive; enabled three rigs; completed the 20-switch burst; returned to one rig; completed a second burst; no fatal, soft-exception, or harness error |
| Galaxy A04s (`a04s`, API 34)  | `matrix-3fp1lw2bjscu5` | ✅ 42 s physical Robo run | rendered one and three rigs; completed both burst paths; no fatal, soft-exception, or harness error                                                         |

Retained cloud evidence:

- A03s:
  `gs://test-lab-xawiq9kh6t1y4-hfm9di99h0u7m/2026-08-14_01:46:13.820984_FbJu/`
- A04s:
  `gs://test-lab-xawiq9kh6t1y4-hfm9di99h0u7m/2026-08-14_02:05:46.813100_CYNH/`

### Harness findings before qualification

- On both low-end models, the three initial state readbacks performed after a
  fixed 250 ms delay were still false. All settled readbacks after the burst were
  true. The instrumentation harness must wait for observable Rive readiness with
  a bounded timeout rather than treat 250 ms as a cross-device contract.
- A04s screenshots visually confirm all three rigs, but its JS counter ran near
  the 90 Hz panel rate. Qualification must request and verify 60 Hz before
  comparing against the 16 ms budget.
- The A03s three-rig screenshot was captured before both added rigs were visually
  ready. Qualification must capture readiness before starting measurements.
- `Infinix-X6525` failed three times in Test Lab infrastructure before app launch
  (`Internal System Error 3`). `TECNO-BG6` showed the same pre-launch fault and
  was cancelled. Neither result is an application failure, but neither device is
  operationally suitable for the active profile today.

## Current readiness

| Requirement                    | Status                                 |
| ------------------------------ | -------------------------------------- |
| Google Cloud CLI installed     | ✅ 580.0.0                             |
| Google account authenticated   | ✅                                     |
| Qualification models available | ✅ both currently report low capacity  |
| Dedicated project selected     | ✅ `poko-device-lab-20260814`          |
| Billing                        | ✅ disabled; Spark path retained       |
| Testing and Tool Results APIs  | ✅ enabled                             |
| Physical smoke path            | ✅ both pinned models                  |
| Controlled Rive qualification  | ❌ frame gate on both; ADR-0011 active |
| Exact qualification APKs       | ✅ retained in both cloud result paths |
| Flutter Gate 2 APKs            | ⛔ Phase 2, after Dart parity          |
