import { int } from '../num.js';
import type { BandConfig, LevelRules, Tile } from '../types.js';

export const BAND: BandConfig = {
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
};

export const RULES: LevelRules = {
  objective: 'equationCount',
  goalValue: 3,
  moveLimit: 10,
  obstacles: [],
  allowedPowerUps: ['hintLens', 'equationShuffle'],
  targetSkills: ['addition', 'subtraction'],
};

export function tile(id: string, value: number, operation: Tile['operation'] = 'add'): Tile {
  return {
    id,
    value: int(value),
    colour: operation === 'sub' ? 'marine' : 'coral',
    operation,
  };
}
