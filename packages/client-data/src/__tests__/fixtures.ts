/** Band config and rules for tests. Mirrors @poko/content without depending on it. */
import type { BandConfig, LevelRules } from '@poko/engine';

export const SPROUT: { config: BandConfig; rules: LevelRules } = {
  config: {
    id: 'sprout',
    numberRange: [1, 10],
    allowedOperations: ['add', 'sub'],
    allowedColours: ['coral', 'marine'],
    minChain: 2,
    maxChain: 4,
    maxTarget: 20,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 4,
  },
  rules: {
    objective: 'equationCount',
    goalValue: 10,
    moveLimit: 20,
    obstacles: [],
    allowedPowerUps: ['hintLens', 'equationShuffle'],
    targetSkills: ['sprout.mixed'],
  },
};
