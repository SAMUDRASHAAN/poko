---
paths:
  - 'apps/mobile/src/app/**'
---

# Screen rules

## Zones

The child zone has NO path to the network, billing, external links, or another
child's data. The parent gate is the only door, and leaving the parent zone
returns to Profile Select — never into a child session.

## Child zone

- Minimum touch target 64x64 px. [INV-14]
- Every navigable element has an icon plus an audio label. Ages 4-7 must be able
  to use the app with zero reading.
- No destructive action exists in the child zone at all.
- No purchase prompts, no notifications, no external links.

## Parent zone

- Uses the parent palette (`parentTeal`, `parentSlate`, `parentMist`) exclusively.
  A child glancing at it should instantly read "not mine".
- Privacy actions (export, erase, consent log) are first-class UI, not buried.

## Never

- No `<form>` elements. No browser storage. Use `packages/client-data`.
- No hex literals or magic spacing values — everything from `@poko/ui`. [INV-13]
