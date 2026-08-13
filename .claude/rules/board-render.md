---
paths:
  - 'flutter/apps/mobile/lib/game/board/**'
  - 'flutter/apps/mobile/android/macrobenchmark/**'
---

# Board rendering rules

## Performance is the requirement, not a goal

- ONE Flame game/render/input loop with a pre-rendered tile atlas. Never 64
  independently laid-out Flutter widgets.
- Pointer movement updates Flame state without rebuilding the Flutter widget tree.
  Flutter rebuilds only on phase transitions, never on finger movement.
- Budget: 16ms frame time sustained on the reference Android device.
  Gate 2 uses the two approved managed physical Android models and the checked-in
  Macrobenchmark workload; simulator results are diagnostic only.

## Rules live elsewhere

This directory draws what the engine decides. If you are writing `if` statements
about chain length, adjacency or validity, that code belongs in
`flutter/packages/game_engine`. [INV-2]

## Interaction feel

- Never show red during an in-progress drag. A still-forming thought must not be
  marked wrong.
- No buzzer sounds. No screen shake. No modal on a wrong answer.
- Every celebration is interruptible by the next drag.
