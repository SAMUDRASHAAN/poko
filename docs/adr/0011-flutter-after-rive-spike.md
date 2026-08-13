# ADR-0011: Flutter after the managed-device Rive spike

- **Status:** Accepted; supersedes ADR-0001 and amends ADR-0002's production scope
- **Date:** 2026-08-14

## Context

ADR-0001 selected React Native provisionally and made the choice contingent on a
three-rig Rive spike on the managed low-end Android profile in ADR-0010. It also
specified the consequence: if the spike failed, move the client to Flutter and
accept the loss of the shared TypeScript runtime and inexpensive React web reuse.

The controlled Nitro Rive build completed five measured iterations on both pinned
physical models with stable processes, verified 60 Hz, complete traces, and peak
PSS below 113 MB. It missed the frame budget on both:

| Model       | Frame CPU P95 | Frame overrun P95 |
| ----------- | ------------: | ----------------: |
| Galaxy A03s |      19.93 ms |         +18.33 ms |
| Galaxy A04s |      18.66 ms |         +19.04 ms |

The required values are below 16 ms and non-positive, respectively. Full evidence
and artifact locations are in `../06-rive-spike-results.md`.

## Decision

Supersede ADR-0001 and build the client with **Flutter + Dart**, the official Rive
Flutter runtime for characters, and Flame for the puzzle-board rendering loop.

The current React Native Phase 2 renderer must not be merged or expanded. React
Native spike code remains historical evidence only. Before new client feature
work begins, rebaseline `ARCHITECTURE.md`, `03-build-plan.md`, and
`WORKTREE-PLAN.md` around Flutter ownership, package boundaries, tests, and
managed-device gates.

The completed pure-TypeScript Phase 1 engine is retained as a behavioural oracle
during the transition. It is not a runtime dependency of the Flutter app. The Dart
engine port must match its golden seeds, serialized fixtures, action traces, and
100,000-board solvability corpus before it replaces that oracle.

ADR-0010 remains in force. Gate 2 still requires two-model controlled physical
Android evidence; changing the client framework does not weaken the product's
frame, memory, or functional budgets.

## Consequences

- The official Rive Flutter integration and a single Flutter render loop remove
  the failed React Native/Nitro bridge and multi-surface path from the critical
  animation workload.
- The shared TypeScript engine, Expo OTA model, and cheap React web build are no
  longer client-architecture benefits. Flutter web is the default shared web
  path; any separate parent web surface requires a later ADR.
- The Phase 1 TypeScript engine work is not discarded immediately: it becomes the
  executable specification used to prove the Dart port has not changed gameplay.
- Existing React Native Phase 2 work is sunk/reversible spike work and must not
  dictate the Flutter design.
- Schedule estimates and worktree ownership after Gate 1 are invalid until the
  Flutter rebaseline is reviewed and merged.

## Alternatives considered

- **Relax the 16 ms gate.** Rejected. Smooth board and character interaction on
  low-end Android is a core product requirement, not an optimization target.
- **Qualify on the local Snapdragon 695 phone.** Rejected by ADR-0010 because it is
  outside the 3–4 GB low-end profile.
- **Continue React Native and optimize later.** Rejected because both representative
  devices missed the pre-commit architecture gate before Skia/Reanimated Phase 2.
