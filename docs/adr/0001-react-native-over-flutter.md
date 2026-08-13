# ADR-0001: React Native over Flutter for the client

- **Status:** Superseded by ADR-0011 after the managed-device Rive spike failed
- **Superseded:** 2026-08-14
- **Date:** 2026-08-01

## Context

The client must render a 60fps puzzle board on low-end Android, animate rigged
characters, ship a responsive web build, and update content frequently. Flutter
was the earlier recommendation when this was a story-first tutor app. Merging the
game into the same product changed the weighting: the product brief requires
TypeScript, and the puzzle engine's value depends on being consumable by the app,
the web build, a Node CLI and CI from one source.

## Decision

Build on React Native + Expo + TypeScript. Board rendering via
`@shopify/react-native-skia`; gestures via Reanimated 3; characters via
`rive-react-native`.

## Consequences

- The pure-TypeScript engine can be shared across app, web, tooling and CI. This
  is the single largest benefit and the reason for the reversal.
- Expo OTA lets content ship without a store review cycle, which a weekly content
  cadence needs.
- The web build reuses the same engine and most UI.
- **Cost, stated honestly:** Rive's React Native runtime is less mature than its
  Flutter runtime, and character animation is central to this product. A 3-day
  spike on the approved low-end physical-device profile from ADR-0010 gates this
  decision. If the spike fails, this ADR is superseded, we move to Flutter, and
  we lose the shared TS engine and the cheap web build.
- The contingency was exercised on 2026-08-14. Both pinned ADR-0010 models missed
  the frame budget; see ADR-0011 and `../06-rive-spike-results.md`.

## Alternatives considered

- **Flutter + Rive + Flame** — better raw rendering performance and a more proven
  Rive runtime, but forfeits the TypeScript requirement, the shared headless
  engine, and a cheap web build.
- **Native per platform** — rejected outright at this team size.
