# ADR-0010: Managed physical devices for performance gates

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

ADR-0001 and Gate 2 require evidence from a low-end Android reference device.
Owning one specific handset is not itself a product requirement: the requirement
is that the React Native, Rive, Skia, and Reanimated stack performs within budget
on representative low-end hardware. The locally available OnePlus CPH2619 has
7.2 GiB RAM and a Snapdragon 695, so its clean run is useful compatibility
evidence but cannot represent the specified 3–4 GiB class.

An Android emulator is not an equivalent substitute. Its CPU and GPU performance
come from the host and its renderer, so restricting virtual RAM or cores creates a
repeatable regression environment, not evidence about a low-end phone.

Managed device labs provide physical phones without requiring the team to buy,
maintain, or keep one particular model available. Their catalogs change, so the
gate must define a hardware profile and retained evidence rather than depend on a
single product name.

## Decision

Replace the locally owned reference Android handset with an **approved managed
physical-device profile**. Firebase Test Lab is the initial provider, but the
contract is provider-neutral.

A qualifying Android execution must:

1. run on a physical, ARM64 phone — never a virtual device or emulator;
2. use a device with 3–4 GiB physical RAM, a low-end/mobile-value SoC, and a
   60 Hz display mode;
3. pin and report provider, catalog model ID, Android API, orientation, locale,
   app commit, APK hash, and test APK hash;
4. test a non-debuggable release build after one unmeasured warm-up;
5. execute at least five measured iterations of the scripted interaction;
6. retain the raw benchmark JSON and system trace for every measured iteration;
7. report crashes/restarts, frame-time percentiles, frame overruns or missed
   deadlines, and process PSS.

The Rive contingency in ADR-0001 passes only when two distinct qualifying Android
models complete the three-rig sustained-input and rapid-switch scenarios without
a crash, restart, runtime error, or missed frame budget. One qualifying model is
provisional evidence only.

Gate 2 passes only when two distinct qualifying Android models complete scripted
drag → commit → refill → target rotation with:

- p95 frame duration below 16 ms;
- no positive p95 frame overrun and fewer than 1% janky frames;
- total process PSS below 220 MB; and
- all engine and UI assertions passing.

If no provider currently offers two exact 3–4 GiB models, the phase owner may pin
the two slowest available physical ARM64 phones only after recording their RAM,
SoC, and why each is conservative for the profile. That substitution is an ADR
amendment, not an undocumented CI edit.

## Consequences

- No locally owned Android reference handset is required.
- Hardware evidence becomes reproducible and reviewable through retained machine
  output instead of screenshots or a developer's observation.
- Two models reduce the risk that a result is peculiar to one vendor's scheduler,
  GPU driver, or thermal policy.
- Cloud authentication, billing, device availability, and queue time become build
  inputs. A missing qualifying device blocks the gate rather than silently
  downgrading it to an emulator run.
- Android Macrobenchmark/UI Automator support and the managed-lab submission step
  must be serialized with the mobile scaffold and dependency changes.

## Alternatives considered

- **Continue with the OnePlus CPH2619.** Rejected as the decision device: its
  7.2 GiB RAM and Snapdragon 695 are outside the low-end profile. It remains a
  useful local smoke and regression target.
- **Throttle an emulator or the OnePlus.** Rejected for qualification. Artificial
  CPU/RAM limits do not reproduce mobile GPU drivers, memory bandwidth, thermal
  policy, or device scheduling.
- **Buy and maintain one handset.** Valid, but slower to unblock and less robust
  than two managed models. It remains a fallback if the managed catalog cannot
  supply the approved profile.
- **Remove the performance gate.** Rejected. Board interaction and character
  animation are core product behavior, so beta is too late to discover an
  architectural miss.
