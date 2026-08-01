---
paths:
  - 'apps/mobile/src/board/**'
---

# Board rendering rules

## Performance is the requirement, not a goal

- ONE Skia canvas with a pre-rendered tile atlas. Never 64 React views.
- Drag runs in Reanimated worklets on the UI thread. React re-renders only on
  phase transitions, never on finger movement.
- Budget: 16ms frame time sustained on the reference Android device.
  Measure on hardware, not a simulator.

## Rules live elsewhere

This directory draws what the engine decides. If you are writing `if` statements
about chain length, adjacency or validity, that code belongs in
`packages/engine`. [INV-2]

## Interaction feel

- Never show red during an in-progress drag. A still-forming thought must not be
  marked wrong.
- No buzzer sounds. No screen shake. No modal on a wrong answer.
- Every celebration is interruptible by the next drag.
