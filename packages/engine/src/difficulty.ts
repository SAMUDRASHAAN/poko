import type { Analysis, BandConfig, LevelRules } from './types.js';

export function difficultyScore(band: BandConfig, rules: LevelRules, analysis: Analysis): number {
  const operationWeight = Math.max(0, band.allowedOperations.length - 1) * 8;
  const rangeWeight = Math.max(0, band.numberRange[1] - band.numberRange[0]);
  const chainWeight = Math.max(0, band.maxChain - band.minChain) * 4;
  const scarcityWeight = Math.max(0, 6 - Math.min(6, analysis.solutions.length)) * 5;
  const pressureWeight = (rules.timeLimitMs ? 10 : 0) + (rules.moveLimit ? 5 : 0);
  return operationWeight + rangeWeight + chainWeight + scarcityWeight + pressureWeight;
}
