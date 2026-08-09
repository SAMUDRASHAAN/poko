/**
 * The Gate 2 pass/fail decision.
 *
 * `03-build-plan.md` §4 states the gate as "sustained 60 fps drag and refill on
 * the reference low-end Android device". That is a sentence, not a threshold, so
 * this module turns it into one — explicitly, in one place, rather than leaving
 * each caller to invent a number.
 *
 * The budget is an argument, never a default buried in the analyser. Gate 2 is a
 * product decision and it should be visible in the command that runs it.
 */
import type { FrameReport } from './framestats.js';

export type Gate2Budget = {
  /**
   * Share of frames allowed to miss the refresh interval.
   *
   * "Sustained 60 fps" cannot mean zero missed frames: Android itself reports
   * jank on an idle screen, and a single GC pause would fail an otherwise perfect
   * run. It has to mean the drops are rare enough not to be felt.
   */
  readonly maxJankPercent: number;
  /**
   * Ceiling on the worst single frame.
   *
   * Jank percentage alone hides a stall: one 400 ms frame in a thousand is 0.1%
   * jank and a visible freeze to a six-year-old.
   */
  readonly maxWorstFrameMs: number;
  /** Minimum frames required before a verdict is meaningful. */
  readonly minFrames: number;
};

/**
 * Defaults carried from the Gate 2 brief. Deliberately conservative: this gate
 * exists to catch a renderer that cannot hold frame rate on cheap hardware, and
 * a gate nobody can fail is not a gate.
 */
export const GATE2_DEFAULT_BUDGET: Gate2Budget = {
  maxJankPercent: 5,
  maxWorstFrameMs: 100,
  minFrames: 300,
};

export type Gate2Verdict = {
  readonly pass: boolean;
  /** Human-readable reasons, empty when passing. */
  readonly failures: readonly string[];
  /** Set when the run cannot support a verdict either way. */
  readonly inconclusive: string | null;
};

export function judge(report: FrameReport, budget: Gate2Budget): Gate2Verdict {
  // Distinguish "failed" from "cannot say". A short or unlabelled capture is not
  // a pass and is not a failure; reporting either would be a fabricated verdict.
  if (report.frames < budget.minFrames) {
    return {
      pass: false,
      failures: [],
      inconclusive: `only ${report.frames} usable frames, need ${budget.minFrames}`,
    };
  }

  if (report.frameBudgetMs === null) {
    return {
      pass: false,
      failures: [],
      inconclusive: 'no FrameInterval column — refresh rate unknown, cannot judge jank',
    };
  }

  // Without FrameDeadline there is no honest jank figure. Older devices lack the
  // column, and inferring jank from pipeline latency overstates it ~36x — the
  // exact mistake this harness made in its first version.
  if (!report.deadlinesKnown) {
    return {
      pass: false,
      failures: [],
      inconclusive: 'no FrameDeadline column — jank cannot be measured on this device',
    };
  }

  const failures: string[] = [];

  if (report.jankPercent > budget.maxJankPercent) {
    failures.push(
      `jank ${report.jankPercent.toFixed(2)}% exceeds ${budget.maxJankPercent}% ` +
        `(${report.janky}/${report.frames} frames over ${report.frameBudgetMs.toFixed(2)}ms)`,
    );
  }

  if (report.worstMs > budget.maxWorstFrameMs) {
    failures.push(`worst frame ${report.worstMs.toFixed(1)}ms exceeds ${budget.maxWorstFrameMs}ms`);
  }

  return { pass: failures.length === 0, failures, inconclusive: null };
}

/** One-screen summary for a terminal or a CI log. */
export function formatReport(report: FrameReport, verdict: Gate2Verdict): string {
  const lines = [
    `frames analysed : ${report.frames} (${report.skipped} skipped, non-zero flags)`,
    `refresh         : ${report.refreshHz ?? '?'} Hz` +
      (report.frameBudgetMs === null ? '' : ` (${report.frameBudgetMs.toFixed(2)}ms budget)`),
    `jank            : ${report.janky} frames, ${report.jankPercent.toFixed(2)}%`,
    `p50 / p90 / p95 : ${report.p50Ms.toFixed(2)} / ${report.p90Ms.toFixed(2)} / ${report.p95Ms.toFixed(2)} ms`,
    `p99 / worst     : ${report.p99Ms.toFixed(2)} / ${report.worstMs.toFixed(2)} ms`,
  ];

  if (verdict.inconclusive !== null) {
    lines.push(`VERDICT         : INCONCLUSIVE — ${verdict.inconclusive}`);
  } else if (verdict.pass) {
    lines.push('VERDICT         : PASS');
  } else {
    lines.push('VERDICT         : FAIL');
    for (const failure of verdict.failures) lines.push(`                  ${failure}`);
  }

  return lines.join('\n');
}
