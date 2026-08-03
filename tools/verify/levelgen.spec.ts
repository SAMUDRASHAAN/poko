import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  buildPackArtifact,
  parseLevelgenArgs,
  renderPackArtifact,
  validatePuzzles,
  type LevelPackArtifact,
} from '@poko/levelgen';

describe('levelgen pack artifact', () => {
  it('is deterministic, validated, unique and stably sorted', () => {
    const first = buildPackArtifact('sprout', 20, 12345);
    const replay = buildPackArtifact('sprout', 20, 12345);

    expect(renderPackArtifact(replay)).toBe(renderPackArtifact(first));
    expect(first).toMatchObject({ schemaVersion: 1, packSeed: 12345, band: 'sprout', count: 20 });
    expect(first.puzzles).toHaveLength(20);
    expect(new Set(first.puzzles.map((puzzle) => puzzle.id)).size).toBe(20);
    expect(new Set(first.puzzles.map((puzzle) => puzzle.seed)).size).toBe(20);

    for (let index = 1; index < first.puzzles.length; index += 1) {
      const previous = first.puzzles[index - 1]!;
      const current = first.puzzles[index]!;
      expect(
        previous.difficultyScore < current.difficultyScore ||
          (previous.difficultyScore === current.difficultyScore &&
            previous.id.localeCompare(current.id) <= 0),
      ).toBe(true);
    }
  });

  it('rejects invalid requests and invalid candidate sets', () => {
    expect(() => buildPackArtifact('sprout', 0, 1)).toThrow(RangeError);
    expect(() => buildPackArtifact('sprout', 1.5, 1)).toThrow(RangeError);
    expect(() => buildPackArtifact('sprout', 1, Number.MAX_VALUE)).toThrow(RangeError);

    const artifact = buildPackArtifact('sprout', 2, 7);
    expect(() => validatePuzzles('sprout', 3, artifact.puzzles)).toThrow(/expected 3/);
    expect(() => validatePuzzles('adventurer', 2, artifact.puzzles)).toThrow(/outside band/);
    expect(() =>
      validatePuzzles('sprout', 2, [artifact.puzzles[0]!, artifact.puzzles[0]!]),
    ).toThrow(/duplicate/);
  });

  it('parses explicit reproducible CLI options', () => {
    expect(
      parseLevelgenArgs([
        '--band',
        'challenger',
        '--count',
        '50',
        '--seed',
        '8675309',
        '--output',
        'pack.json',
      ]),
    ).toEqual({ band: 'challenger', count: 50, seed: 8675309, output: 'pack.json' });
    expect(parseLevelgenArgs(['--help'])).toBeNull();
    expect(() => parseLevelgenArgs(['--band', 'missing'])).toThrow(/unsupported band/);
    expect(() => parseLevelgenArgs(['--band', 'sprout'])).toThrow(/required/);
    expect(() => parseLevelgenArgs(['--wat', '1'])).toThrow(/unknown option/);
  });

  it('runs as a Node CLI and emits parseable stable JSON', () => {
    const cliPath = fileURLToPath(new URL('../levelgen/index.ts', import.meta.url));
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', cliPath, '--band', 'sprout', '--count', '3', '--seed', '42'],
      { encoding: 'utf8' },
    );

    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const artifact = JSON.parse(run.stdout) as LevelPackArtifact;
    expect(artifact).toMatchObject({ schemaVersion: 1, band: 'sprout', count: 3, packSeed: 42 });
    expect(artifact.puzzles).toHaveLength(3);
  });
});
