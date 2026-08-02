import type { LevelState } from './types.js';

export function serialiseState(state: LevelState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLevelState(value: unknown): value is LevelState {
  if (!isRecord(value) || !isRecord(value.board) || !isRecord(value.target)) return false;
  return (
    typeof value.phase === 'string' &&
    Array.isArray(value.board.tiles) &&
    typeof value.board.width === 'number' &&
    typeof value.board.height === 'number' &&
    typeof value.target.n === 'number' &&
    typeof value.target.d === 'number' &&
    isRecord(value.chain) &&
    Array.isArray(value.chain.cells) &&
    Array.isArray(value.history)
  );
}

export function restoreState(blob: string): LevelState {
  const parsed: unknown = JSON.parse(blob);
  if (!isLevelState(parsed)) throw new TypeError('blob is not a serialised LevelState');
  return parsed;
}
