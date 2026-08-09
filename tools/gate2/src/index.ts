/**
 * `@poko/gate2` — the Gate 2 frame-timing harness.
 *
 * Measures the Android frame pipeline via `dumpsys gfxinfo framestats`, which is
 * a platform facility rather than a renderer one: it reports real frames for any
 * app, so this harness judges a React Native build and a Flutter build the same
 * way and survives ADR-0001 either outcome.
 *
 * The analysis is pure and runs in CI against a captured fixture. Capturing from
 * a device needs `adb` and lives in `cli.ts`.
 */
export {
  analyseFrames,
  parseFramestats,
  type FrameReport,
  type FrameSample,
} from './framestats.js';

export {
  GATE2_DEFAULT_BUDGET,
  formatReport,
  judge,
  type Gate2Budget,
  type Gate2Verdict,
} from './budget.js';
