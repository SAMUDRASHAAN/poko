/**
 * `@poko/content` — band packs, the shipped difficulty curve, and their metadata.
 *
 * Contains no UI and no platform code [02-content-spec §1]. It may import the
 * engine contract; it never overrides a validator result.
 *
 * Not yet authored here, and deliberately not invented: child and parent copy
 * strings, scripted voice lines and their manifest, and reward labels. Those are
 * pedagogy and product voice for a child audience, and they need a human author.
 */
export { BANDS, type BandId } from './bands.js';

export { BAND_ORDER, LEVEL_PACKS, PACK_SEEDS, allCandidates, type LevelPack } from './packs.js';

export {
  MINIMUM_CURVE_LENGTH,
  analyseCurve,
  buildCurve,
  type CurveEntry,
  type CurveReport,
} from './curve.js';
