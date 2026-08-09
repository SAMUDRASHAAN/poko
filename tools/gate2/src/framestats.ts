/**
 * Parser and analyser for Android's `dumpsys gfxinfo <pkg> framestats`.
 *
 * This is the measurement half of Gate 2 — "sustained 60 fps drag and refill on
 * the reference low-end Android device" (`03-build-plan.md` §4).
 *
 * ## Why this is not React Native code
 *
 * `framestats` is an Android **platform** facility. It reports the real frame
 * pipeline for any app on the device, whatever drew the frames. So this harness
 * measures a React Native build and a Flutter build identically, and survives
 * ADR-0001 either way. Nothing here imports React, React Native, or any renderer
 * — per `ARCHITECTURE.md` §5, `tools/*` may not.
 *
 * ## Why the parser is header-driven
 *
 * The column set changes between Android versions. Android 16 emits 24 columns;
 * older releases emit 14, and the classic documented layout is different again.
 * Indexing by position works on the machine you developed against and silently
 * misreads on the reference device — which is precisely where the numbers matter.
 * So every column is resolved by NAME from the header of each block.
 */

/** Frame durations are reported in nanoseconds. */
const NS_PER_MS = 1_000_000;

const BLOCK_MARKER = '---PROFILEDATA---';

export type FrameSample = {
  /** Non-zero flags mark frames the platform says not to treat as normal. */
  readonly flags: number;
  readonly intendedVsyncNs: number;
  readonly frameCompletedNs: number;
  /** Present on newer Android only; null when the column is absent. */
  readonly frameIntervalNs: number | null;
  /**
   * When this frame was due. Present on Android 12+ (FrameTimeline).
   *
   * This, not the refresh interval, decides jank — see `analyseFrames`.
   */
  readonly frameDeadlineNs: number | null;
  /**
   * Wall time from intended vsync to frame completion.
   *
   * This is END-TO-END PIPELINE LATENCY, not the time the frame "took". Rendering
   * is pipelined across several vsyncs, so a healthy 60 fps frame routinely
   * measures ~20 ms here. Useful for latency, useless for jank.
   */
  readonly durationMs: number;
};

export type FrameReport = {
  /** Frames actually analysed. */
  readonly frames: number;
  /** Rows discarded because `Flags` was non-zero. */
  readonly skipped: number;
  /**
   * Refresh rate derived from the data, not assumed. A harness that assumes 60
   * silently reports nonsense on a 120 Hz panel.
   */
  readonly refreshHz: number | null;
  /** One frame's budget at the observed refresh rate. */
  readonly frameBudgetMs: number | null;
  /**
   * Whether the capture carried `FrameDeadline`. Without it there is no honest
   * jank figure, and `judge()` returns INCONCLUSIVE rather than guessing.
   */
  readonly deadlinesKnown: boolean;
  /** Frames that completed after their deadline. */
  readonly janky: number;
  readonly jankPercent: number;
  readonly p50Ms: number;
  readonly p90Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly worstMs: number;
};

function columnIndex(header: readonly string[], name: string): number {
  return header.findIndex((column) => column.toLowerCase() === name.toLowerCase());
}

/**
 * Extracts frame samples from raw `dumpsys` output.
 *
 * Tolerates multiple `---PROFILEDATA---` blocks (one per window), differing
 * column sets between blocks, and the trailing comma each row carries.
 */
export function parseFramestats(raw: string): FrameSample[] {
  const lines = raw.split('\n').map((line) => line.trimEnd().replace(/\r$/, ''));
  const samples: FrameSample[] = [];

  let header: string[] | null = null;
  let inBlock = false;

  for (const line of lines) {
    if (line.startsWith(BLOCK_MARKER)) {
      // The marker both opens and closes a block; a new block re-reads its header.
      inBlock = !inBlock;
      header = null;
      continue;
    }
    if (!inBlock || line.length === 0) continue;

    const cells = line.split(',').map((cell) => cell.trim());

    if (header === null) {
      header = cells;
      continue;
    }

    const flagsAt = columnIndex(header, 'Flags');
    const intendedAt = columnIndex(header, 'IntendedVsync');
    const completedAt = columnIndex(header, 'FrameCompleted');
    const intervalAt = columnIndex(header, 'FrameInterval');
    const deadlineAt = columnIndex(header, 'FrameDeadline');
    if (flagsAt < 0 || intendedAt < 0 || completedAt < 0) continue;

    const flags = Number(cells[flagsAt]);
    const intendedVsyncNs = Number(cells[intendedAt]);
    const frameCompletedNs = Number(cells[completedAt]);
    const rawInterval = intervalAt >= 0 ? Number(cells[intervalAt]) : Number.NaN;
    const rawDeadline = deadlineAt >= 0 ? Number(cells[deadlineAt]) : Number.NaN;

    if (!Number.isFinite(flags) || !Number.isFinite(intendedVsyncNs)) continue;
    if (!Number.isFinite(frameCompletedNs) || frameCompletedNs <= intendedVsyncNs) continue;

    samples.push({
      flags,
      intendedVsyncNs,
      frameCompletedNs,
      frameIntervalNs: Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : null,
      frameDeadlineNs: Number.isFinite(rawDeadline) && rawDeadline > 0 ? rawDeadline : null,
      durationMs: (frameCompletedNs - intendedVsyncNs) / NS_PER_MS,
    });
  }

  return samples;
}

function percentile(sortedMs: readonly number[], quantile: number): number {
  if (sortedMs.length === 0) return 0;
  const index = Math.min(sortedMs.length - 1, Math.floor(sortedMs.length * quantile));
  return sortedMs[index] as number;
}

/**
 * Summarises frame samples.
 *
 * ## A frame is janky when it MISSES ITS DEADLINE, not when it exceeds 16.67 ms
 *
 * This was wrong in the first version and the error was large and flattering in
 * the dangerous direction. Judging `FrameCompleted - IntendedVsync` against the
 * refresh interval reported **90.76% jank** on a capture where Android's own
 * accounting said **2.52%**.
 *
 * The reason is pipelining. A frame's intended-vsync-to-completion span crosses
 * several vsyncs by design, so a perfectly healthy 60 fps frame measures ~20 ms
 * end to end. Comparing that to a 16.67 ms interval marks almost every frame
 * janky on an app that is dropping nothing.
 *
 * Android 12+ reports `FrameDeadline` — when the frame was actually due. A frame
 * is late if it completed after that. Where the column is missing (older
 * devices), no jank figure is produced at all rather than a fabricated one, and
 * `judge()` returns INCONCLUSIVE.
 */
export function analyseFrames(samples: readonly FrameSample[]): FrameReport {
  const usable = samples.filter((sample) => sample.flags === 0);
  const skipped = samples.length - usable.length;

  const intervals = usable
    .map((sample) => sample.frameIntervalNs)
    .filter((interval): interval is number => interval !== null);

  const frameBudgetMs = intervals.length > 0 ? (intervals[0] as number) / NS_PER_MS : null;
  const refreshHz = frameBudgetMs !== null ? Math.round(1000 / frameBudgetMs) : null;

  const durations = usable.map((sample) => sample.durationMs).sort((a, b) => a - b);

  const withDeadline = usable.filter((sample) => sample.frameDeadlineNs !== null);
  const deadlinesKnown = withDeadline.length > 0;
  const janky = withDeadline.filter(
    (sample) => sample.frameCompletedNs > (sample.frameDeadlineNs as number),
  ).length;

  return {
    frames: usable.length,
    skipped,
    refreshHz,
    frameBudgetMs,
    deadlinesKnown,
    janky,
    jankPercent:
      !deadlinesKnown || withDeadline.length === 0 ? 0 : (janky / withDeadline.length) * 100,
    p50Ms: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    worstMs: durations.length === 0 ? 0 : (durations[durations.length - 1] as number),
  };
}
