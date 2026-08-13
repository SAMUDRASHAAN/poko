---
paths:
  - 'flutter/packages/design_system/**'
  - 'flutter/apps/mobile/lib/game/**'
---

# Component rules

## The split

- `poko_design_system` — presentational primitives with NO game knowledge.
- mobile `lib/game` — Flutter/Flame presentation that knows tiles, targets and chains.

If a widget imports anything about the game, it belongs in the app, not the design system.

## Accessibility is the default, not a mode

Every component must render correctly in all variants before it is done:
colour-blind (shape + glyph coding), large text (1.3x / 1.6x), reduced motion,
high contrast, left-handed, dyslexia font.

The "colour-blind toggle" only thickens outlines and adds pattern fill — the
accessible design IS the default design.

## Values

Colours, spacing, radii, type sizes and durations come from `poko_design_system` tokens.
No literals. [INV-13]

## Never

No business logic, no store access, no network calls, no navigation side effects.
Widgets receive immutable values and emit callbacks.
