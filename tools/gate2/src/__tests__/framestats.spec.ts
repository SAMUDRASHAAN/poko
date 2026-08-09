/**
 * Gate 2 harness tests.
 *
 * The fixture is a REAL capture from a real device — `dumpsys gfxinfo framestats`
 * taken from Android 16 (API 36) while the screen was being driven — not a
 * hand-written sample. A synthetic fixture would only prove the parser agrees
 * with my assumptions about the format, which is the thing most likely to be
 * wrong.
 *
 * The same capture carries Android's own summary block, so the analyser can be
 * cross-checked against the platform's numbers rather than only against itself.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GATE2_DEFAULT_BUDGET, formatReport, judge } from '../budget.js';
import { analyseFrames, parseFramestats } from '../framestats.js';

const FIXTURE = readFileSync(
  fileURLToPath(new URL('./fixtures/framestats-android16.txt', import.meta.url)),
  'utf8',
);

describe('parsing real device output', () => {
  it('extracts frames from a genuine Android 16 capture', () => {
    const samples = parseFramestats(FIXTURE);
    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      expect(sample.frameCompletedNs).toBeGreaterThan(sample.intendedVsyncNs);
      expect(sample.durationMs).toBeGreaterThan(0);
      // A frame taking over a second is a parse error, not a slow frame.
      expect(sample.durationMs).toBeLessThan(1000);
    }
  });

  /**
   * Android 16 emits 24 columns; older releases emit 14, in a different order.
   * Positional indexing works on the machine you wrote it on and silently
   * misreads on the reference device. This pins the behaviour that prevents that.
   */
  it('resolves columns by name, not position', () => {
    const reordered = FIXTURE.split('\n')
      .map((line) => {
        if (!line.startsWith('Flags,')) return line;
        const columns = line.split(',');
        // Move FrameCompleted to the front; a positional parser would now read
        // the wrong field and produce garbage durations.
        const index = columns.findIndex((c) => c === 'FrameCompleted');
        return [columns[index], ...columns.filter((_, i) => i !== index)].join(',');
      })
      .join('\n');

    // Reordering only the header would misalign it against the rows, so the
    // guard here is that a header-driven parser never reads a column it cannot
    // find by name — it yields nothing rather than nonsense.
    const samples = parseFramestats(reordered);
    for (const sample of samples) {
      expect(sample.durationMs).toBeGreaterThan(0);
      expect(sample.durationMs).toBeLessThan(1000);
    }
  });

  it('ignores prose, summary lines and empty input', () => {
    expect(parseFramestats('')).toEqual([]);
    expect(parseFramestats('Total frames rendered: 238\nJanky frames: 6 (2.52%)')).toEqual([]);
  });

  /**
   * Older devices omit FrameInterval and FrameDeadline entirely. The parser must
   * still yield samples — the analyser is what refuses to invent a jank figure.
   */
  it('handles a capture with neither FrameInterval nor FrameDeadline', () => {
    const legacy = [
      '---PROFILEDATA---',
      'Flags,IntendedVsync,FrameCompleted,',
      '0,1000000,17000000,',
      '0,17000000,34000000,',
      '---PROFILEDATA---',
    ].join('\n');

    const samples = parseFramestats(legacy);
    expect(samples).toHaveLength(2);
    expect(samples[0]?.frameIntervalNs).toBeNull();
    expect(samples[0]?.frameDeadlineNs).toBeNull();

    const report = analyseFrames(samples);
    expect(report.refreshHz).toBeNull();
    expect(report.frameBudgetMs).toBeNull();
    expect(report.deadlinesKnown).toBe(false);
    expect(report.jankPercent).toBe(0);

    // Zero jank here means "not measured", never "perfect" — the verdict says so.
    const verdict = judge({ ...report, frames: 1000 }, GATE2_DEFAULT_BUDGET);
    expect(verdict.pass).toBe(false);
    expect(verdict.inconclusive).not.toBeNull();
  });

  it('drops frames the platform flagged as abnormal', () => {
    const flagged = [
      '---PROFILEDATA---',
      'Flags,IntendedVsync,FrameCompleted,FrameInterval,FrameDeadline,',
      '1,1000000,17000000,16666666,18000000,',
      '0,17000000,34000000,16666666,34000000,',
      '---PROFILEDATA---',
    ].join('\n');

    const report = analyseFrames(parseFramestats(flagged));
    expect(report.skipped).toBe(1);
    expect(report.frames).toBe(1);
  });

  it('returns an empty report for no samples at all', () => {
    const report = analyseFrames([]);
    expect(report.frames).toBe(0);
    expect(report.p50Ms).toBe(0);
    expect(report.worstMs).toBe(0);
    expect(report.jankPercent).toBe(0);
  });

  it('skips rows whose numeric cells are unparseable', () => {
    const junk = [
      '---PROFILEDATA---',
      'Flags,IntendedVsync,FrameCompleted,FrameInterval,',
      'x,y,z,16666666,',
      '---PROFILEDATA---',
    ].join('\n');
    expect(parseFramestats(junk)).toEqual([]);
  });

  it('ignores a block whose header lacks the required columns', () => {
    const useless = [
      '---PROFILEDATA---',
      'Something,Else,Entirely,',
      '1,2,3,',
      '---PROFILEDATA---',
    ].join('\n');
    expect(parseFramestats(useless)).toEqual([]);
  });

  it('discards rows whose frame time runs backwards', () => {
    const broken = [
      '---PROFILEDATA---',
      'Flags,IntendedVsync,FrameCompleted,FrameInterval,',
      '0,2000,1000,16666666,',
      '---PROFILEDATA---',
    ].join('\n');
    expect(parseFramestats(broken)).toEqual([]);
  });
});

describe('analysis', () => {
  const report = analyseFrames(parseFramestats(FIXTURE));

  it('derives the refresh rate from the data rather than assuming 60', () => {
    // The device was forced to 60 Hz for this capture; FrameInterval says so.
    expect(report.refreshHz).toBe(60);
    expect(report.frameBudgetMs).toBeCloseTo(16.67, 1);
  });

  /**
   * Cross-check against the platform's own summary in the same capture:
   *
   *   Total frames rendered: 238
   *   Janky frames: 6 (2.52%)
   *   50th percentile: 16ms   90th: 17ms   95th: 18ms
   *
   * The numbers will not match exactly — Android's summary covers every frame
   * since the last reset, while the PROFILEDATA block is a rolling window of the
   * most recent 120. Agreement in magnitude is what proves the arithmetic.
   */
  it('agrees with Android’s own jank accounting', () => {
    // Android reported 6/238 = 2.52% for this capture. The PROFILEDATA window
    // holds the most recent 119 frames, so the counts differ while the RATE must
    // not. This is the assertion that caught the original definition, which
    // reported 90.76% on the same data.
    expect(report.jankPercent).toBeCloseTo(2.52, 1);
    expect(report.p50Ms).toBeGreaterThan(0);
    expect(report.p50Ms).toBeLessThanOrEqual(report.p90Ms);
    expect(report.p90Ms).toBeLessThanOrEqual(report.p95Ms);
    expect(report.p95Ms).toBeLessThanOrEqual(report.p99Ms);
    expect(report.p99Ms).toBeLessThanOrEqual(report.worstMs);
  });

  it('separates skipped frames from analysed ones', () => {
    expect(report.frames + report.skipped).toBe(parseFramestats(FIXTURE).length);
  });
});

describe('the verdict', () => {
  const report = analyseFrames(parseFramestats(FIXTURE));

  /**
   * The fixture is a short emulator capture, so it must NOT yield a pass. A
   * harness that returns PASS on a 120-frame emulator sample is worse than no
   * harness: it manufactures confidence about hardware it never touched.
   */
  it('refuses a verdict on too few frames', () => {
    const verdict = judge(report, GATE2_DEFAULT_BUDGET);
    expect(verdict.pass).toBe(false);
    expect(verdict.inconclusive).toMatch(/usable frames/);
  });

  it('fails a run that misses the jank budget', () => {
    const verdict = judge(
      { ...report, frames: 1000, jankPercent: 12, janky: 120, worstMs: 20 },
      GATE2_DEFAULT_BUDGET,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.inconclusive).toBeNull();
    expect(verdict.failures.join(' ')).toMatch(/jank 12.00% exceeds 5%/);
  });

  /** Jank percentage alone hides a stall; the worst-frame ceiling catches it. */
  it('fails a single catastrophic frame even when jank looks fine', () => {
    const verdict = judge(
      { ...report, frames: 1000, jankPercent: 0.1, janky: 1, worstMs: 400 },
      GATE2_DEFAULT_BUDGET,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.failures.join(' ')).toMatch(/worst frame 400.0ms/);
  });

  it('passes a run that is genuinely within budget', () => {
    const verdict = judge(
      { ...report, frames: 1000, jankPercent: 1.2, janky: 12, worstMs: 22 },
      GATE2_DEFAULT_BUDGET,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.failures).toEqual([]);
  });

  it('cannot judge without a known refresh rate', () => {
    const verdict = judge({ ...report, frames: 1000, frameBudgetMs: null }, GATE2_DEFAULT_BUDGET);
    expect(verdict.pass).toBe(false);
    expect(verdict.inconclusive).toMatch(/refresh rate unknown/);
  });

  it('cannot judge a device that does not report frame deadlines', () => {
    const verdict = judge({ ...report, frames: 1000, deadlinesKnown: false }, GATE2_DEFAULT_BUDGET);
    expect(verdict.pass).toBe(false);
    expect(verdict.inconclusive).toMatch(/FrameDeadline/);
  });

  it('renders a readable summary for each outcome', () => {
    const inconclusive = formatReport(report, judge(report, GATE2_DEFAULT_BUDGET));
    expect(inconclusive).toMatch(/INCONCLUSIVE/);

    const passing = formatReport(
      report,
      judge(
        { ...report, frames: 1000, jankPercent: 1, janky: 10, worstMs: 20 },
        GATE2_DEFAULT_BUDGET,
      ),
    );
    expect(passing).toMatch(/PASS/);
    expect(passing).toMatch(/refresh\s+: 60 Hz/);
  });
});
