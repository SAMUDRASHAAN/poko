# Managed Android device profile

This is the mutable provider catalog pin for ADR-0010. The ADR defines what
qualifies; this document records the concrete models used to satisfy it.

## Active provider

Firebase Test Lab, queried with Google Cloud CLI 580.0.0 on 2026-08-14.

## Pinned qualification models

| Provider model ID | Device              | API | Catalog evidence                                             | Hardware evidence                                  |
| ----------------- | ------------------- | --: | ------------------------------------------------------------ | -------------------------------------------------- |
| `a03su`           | Samsung Galaxy A03s |  33 | physical phone; `arm64-v8a`; `DEVICE_CAPACITY_LOW`; 720×1600 | 3 GB RAM; MediaTek Helio P35; 60 Hz                |
| `Infinix-X6525`   | Infinix SMART 8     |  33 | physical phone; `arm64-v8a`; `DEVICE_CAPACITY_LOW`; 720×1612 | 4 GB physical RAM; 12 nm value-class octa-core SoC |

The catalog evidence above comes from `gcloud firebase test android models
describe`. Hardware facts come from the manufacturers' published specifications:

- Samsung Galaxy A03s spec sheet:
  <https://image-us.samsung.com/SamsungUS/samsungbusiness/pdf/spec-sheets/Galaxy_A03s_Unlocked_SpecSheet.pdf>
- Infinix SMART 8 product page:
  <https://www.infinixmobility.com/smart-8>

The SMART 8 advertises 8 GB only by combining 4 GB physical RAM with 4 GB of
storage-backed extended memory. ADR-0010 classifies devices by physical RAM, so it
is a 4 GB qualification model.

## Execution configuration

Each model runs separately with:

- physical device form only;
- Android API 33, portrait, `en`, `US`;
- non-debuggable ARM64 release APK and instrumentation APK pinned by SHA-256;
- one unmeasured warm-up followed by at least five measured iterations;
- app-requested 60 Hz rendering for displays that expose a higher refresh mode;
- raw result JSON, frame traces, device catalog JSON, logs, and memory readings
  retained together under the tested app commit.

## Acceptance

Rive and Gate 2 are evaluated independently against ADR-0010. Both pinned models
must pass; replacing a model requires recording the replacement, catalog output,
hardware evidence, and reason in this file before the run.

## Current readiness

| Requirement                      | Status                                |
| -------------------------------- | ------------------------------------- |
| Google Cloud CLI installed       | ✅ 580.0.0                            |
| Google account authenticated     | ✅                                    |
| Qualification models available   | ✅ both currently report low capacity |
| Dedicated project selected       | ⛔ pending owner choice               |
| Billing/Test Lab APIs configured | ⛔ pending project selection          |
| Release + instrumentation APKs   | ⛔ pending serialized mobile scaffold |
