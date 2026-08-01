---
paths:
  - 'packages/ui/**'
  - 'apps/mobile/src/components/**'
---

# Component rules

## The split

- `packages/ui` — presentational primitives with NO game knowledge.
- `apps/mobile/src/components` — components that know about tiles, targets, chains.

If a component imports anything about the game, it belongs in the app, not `ui`.

## Accessibility is the default, not a mode

Every component must render correctly in all variants before it is done:
colour-blind (shape + glyph coding), large text (1.3x / 1.6x), reduced motion,
high contrast, left-handed, dyslexia font.

The "colour-blind toggle" only thickens outlines and adds pattern fill — the
accessible design IS the default design.

## Values

Colours, spacing, radii, type sizes and durations come from `@poko/ui` tokens.
No literals. [INV-13]

## Never

No business logic, no store access, no network calls, no navigation side effects.
Components receive props and emit callbacks.
