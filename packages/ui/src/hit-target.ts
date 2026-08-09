/**
 * INV-14 — every interactive element in the child zone is at least 64×64 px.
 *
 * `01-experience-spec.md` §4 is precise about the measurement: "Interactive child
 * elements are at least 64×64 px **including their hit area**". The visual box is
 * not the thing being constrained — the touchable region is. A 48 px button with
 * 8 px of slop on every side is compliant; the same button drawn at 64 px with
 * negative slop is not.
 *
 * This module is the assertion. It takes geometry and returns violations, so it
 * is framework-agnostic: the React Native adapter that measures rendered nodes
 * calls it, and so would a Flutter one. Nothing here imports a renderer.
 *
 * Why it exists before the components do: `04-release-readiness.md` §3 requires
 * the measurement to land before the feature. Twenty primitives is exactly the
 * surface where a manual checklist rots.
 */
import { touch } from './tokens.js';

/** Extra touchable area outside the visual box, per edge. */
export type HitSlop = {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
};

export type MeasuredElement = {
  /** Something a failure message can point at — a testID or component name. */
  readonly id: string;
  /** Visual width in px. */
  readonly width: number;
  /** Visual height in px. */
  readonly height: number;
  /** Additional touchable area, if the element declares any. */
  readonly hitSlop?: HitSlop | number;
  /**
   * Elements outside the child zone are exempt: INV-14 is a child-zone rule.
   * Parent-zone controls follow ordinary platform minimums.
   */
  readonly zone?: 'child' | 'parent';
};

export type HitTargetViolation = {
  readonly id: string;
  /** Effective touchable size, slop included. */
  readonly effectiveWidth: number;
  readonly effectiveHeight: number;
  /** How many px short each axis is; 0 when that axis passes. */
  readonly shortfallX: number;
  readonly shortfallY: number;
};

function slopOf(hitSlop: HitSlop | number | undefined): Required<HitSlop> {
  if (typeof hitSlop === 'number') {
    return { top: hitSlop, right: hitSlop, bottom: hitSlop, left: hitSlop };
  }
  return {
    top: hitSlop?.top ?? 0,
    right: hitSlop?.right ?? 0,
    bottom: hitSlop?.bottom ?? 0,
    left: hitSlop?.left ?? 0,
  };
}

/** Touchable size of an element, slop included. */
export function effectiveSize(element: MeasuredElement): { width: number; height: number } {
  const slop = slopOf(element.hitSlop);
  return {
    width: element.width + slop.left + slop.right,
    height: element.height + slop.top + slop.bottom,
  };
}

/**
 * Every child-zone element whose touchable area is under the minimum.
 *
 * Returns violations rather than throwing, so a test can report all of them at
 * once — finding twenty undersized targets one failed run at a time is how a
 * check like this gets disabled.
 */
export function findHitTargetViolations(
  elements: readonly MeasuredElement[],
  minimumPx: number = touch.min,
): HitTargetViolation[] {
  const violations: HitTargetViolation[] = [];

  for (const element of elements) {
    // Default to child: the child zone is the strict case, so an element that
    // forgets to declare its zone is held to the stricter rule rather than
    // silently exempted.
    if ((element.zone ?? 'child') !== 'child') continue;

    const { width, height } = effectiveSize(element);
    const shortfallX = Math.max(0, minimumPx - width);
    const shortfallY = Math.max(0, minimumPx - height);

    if (shortfallX > 0 || shortfallY > 0) {
      violations.push({
        id: element.id,
        effectiveWidth: width,
        effectiveHeight: height,
        shortfallX,
        shortfallY,
      });
    }
  }

  return violations;
}

/** Failure text listing every violation, for a test's assertion message. */
export function describeViolations(
  violations: readonly HitTargetViolation[],
  minimumPx: number = touch.min,
): string {
  if (violations.length === 0) return '';
  const lines = violations.map(
    (violation) =>
      `  ${violation.id}: ${violation.effectiveWidth}×${violation.effectiveHeight}px ` +
      `(short by ${violation.shortfallX}×${violation.shortfallY})`,
  );
  return `${violations.length} element(s) below the ${minimumPx}px child-zone minimum [INV-14]:\n${lines.join('\n')}`;
}
