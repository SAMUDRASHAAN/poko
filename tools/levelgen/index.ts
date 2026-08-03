#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BAND_IDS,
  buildPackArtifact,
  isLevelgenBandId,
  renderPackArtifact,
  type LevelgenBandId,
} from './pack.js';

// The package root is the whole public surface: consumers import '@poko/levelgen',
// never a deep path into it. [AGENTS.md rule 9]
export {
  BAND_IDS,
  buildPackArtifact,
  isLevelgenBandId,
  renderPackArtifact,
  validatePuzzles,
  type LevelgenBandId,
  type LevelPackArtifact,
} from './pack.js';

const USAGE = `Usage: node --import tsx tools/levelgen/index.ts \\
  --band <${BAND_IDS.join('|')}> --count <positive integer> --seed <integer> [--output <file>]
`;

export type LevelgenOptions = {
  readonly band: LevelgenBandId;
  readonly count: number;
  readonly seed: number;
  readonly output?: string;
};

function optionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

function integerOption(option: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${option} must be a safe integer`);
  return parsed;
}

export function parseLevelgenArgs(args: readonly string[]): LevelgenOptions | null {
  if (args.includes('--help') || args.includes('-h')) return null;

  let band: LevelgenBandId | undefined;
  let count: number | undefined;
  let seed: number | undefined;
  let output: string | undefined;

  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    if (!option) continue;
    const value = optionValue(args, index, option);
    switch (option) {
      case '--band':
        if (!isLevelgenBandId(value)) throw new Error(`unsupported band: ${value}`);
        band = value;
        break;
      case '--count':
        count = integerOption(option, value);
        break;
      case '--seed':
        seed = integerOption(option, value);
        break;
      case '--output':
        output = value;
        break;
      default:
        throw new Error(`unknown option: ${option}`);
    }
  }

  if (!band || count === undefined || seed === undefined) {
    throw new Error('--band, --count and --seed are required');
  }
  if (count <= 0) throw new Error('--count must be greater than zero');
  return output === undefined ? { band, count, seed } : { band, count, seed, output };
}

function runCli(): void {
  try {
    const options = parseLevelgenArgs(process.argv.slice(2));
    if (!options) {
      process.stdout.write(USAGE);
      return;
    }

    const artifact = buildPackArtifact(options.band, options.count, options.seed);
    const rendered = renderPackArtifact(artifact);
    if (options.output) writeFileSync(resolve(options.output), rendered, 'utf8');
    else process.stdout.write(rendered);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`levelgen: ${message}\n${USAGE}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) runCli();
