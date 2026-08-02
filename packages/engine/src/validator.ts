import { analyseWithBand } from './solver.js';
import type { Analysis, BandConfig, Board, LevelRules } from './types.js';

type PuzzleValidation = {
  readonly valid: boolean;
  readonly analysis: Analysis;
  readonly reasons: readonly ('unsolvable' | 'tooFewSolutions' | 'tooManySolutions')[];
};

export function validatePuzzle(
  board: Board,
  target: Parameters<typeof analyseWithBand>[1],
  rules: LevelRules,
  band: BandConfig,
): PuzzleValidation {
  const analysis = analyseWithBand(board, target, rules, band);
  const reasons: ('unsolvable' | 'tooFewSolutions' | 'tooManySolutions')[] = [];
  if (analysis.isStuck) reasons.push('unsolvable');
  if (analysis.solutions.length < band.minSolutions) reasons.push('tooFewSolutions');
  if (analysis.solutions.length > band.maxSolutions) reasons.push('tooManySolutions');
  return { valid: reasons.length === 0, analysis, reasons };
}
