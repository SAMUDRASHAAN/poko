import { spawn } from 'node:child_process';
import console from 'node:console';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { analyse, createLevel, generatePack, serialise } from '../../packages/engine/src/index.ts';

const runs = Number(process.env.PARITY_RUNS ?? 100_000);
if (!Number.isSafeInteger(runs) || runs <= 0) {
  throw new RangeError(`PARITY_RUNS must be a positive safe integer, got ${runs}`);
}

const repo = fileURLToPath(new URL('../..', import.meta.url));
const dartWorkspace = process.env.POKO_DART_WORKSPACE ?? `${repo}/flutter`;
const packageConfig = `${dartWorkspace}/.dart_tool/package_config.json`;
if (!existsSync(packageConfig)) {
  throw new Error(`missing Dart package config: ${packageConfig}`);
}
const adapter = fileURLToPath(new URL('corpus_adapter.dart', import.meta.url));
const child = spawn('dart', [`--packages=${packageConfig}`, adapter, String(runs)], {
  cwd: dartWorkspace,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let dartOutput = '';
let dartError = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => (dartOutput += chunk));
child.stderr.on('data', (chunk) => (dartError += chunk));
const dartComplete = new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code) =>
    code === 0 ? resolve(JSON.parse(dartOutput)) : reject(new Error(dartError || dartOutput)),
  );
});

const bands = [
  {
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
  {
    id: 'adventurer',
    numberRange: [1, 12],
    allowedOperations: ['add', 'sub', 'mul'],
    allowedColours: ['coral', 'marine', 'kelp'],
    minChain: 2,
    maxChain: 5,
    maxTarget: 50,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  },
];

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const seedStride = 2654435761;
let hash = FNV_OFFSET;
let codeUnits = 0;
let failures = 0;
const started = performance.now();

for (let index = 0; index < runs; index += 1) {
  const band = bands[index % bands.length];
  const seed = index * seedStride;
  try {
    const [puzzle] = generatePack(band.id, 1, seed);
    if (!puzzle) {
      failures += 1;
      continue;
    }
    const state = createLevel(puzzle.seed, puzzle.rules, band);
    const analysis = analyse(state.board, state.target, state.rules);
    if (analysis.solutions.length === 0 || analysis.isStuck) failures += 1;
    const record = JSON.stringify({ puzzle, state: JSON.parse(serialise(state)), analysis });
    for (let offset = 0; offset < record.length; offset += 1) {
      hash = ((hash ^ BigInt(record.charCodeAt(offset))) * FNV_PRIME) & MASK_64;
    }
    hash = ((hash ^ 10n) * FNV_PRIME) & MASK_64;
    codeUnits += record.length + 1;
  } catch {
    failures += 1;
  }
  if (index > 0 && index % 10_000 === 0) console.warn(`${index}/${runs}`);
}

const typescript = {
  runs,
  failures,
  codeUnits,
  fnv64: hash.toString(16).padStart(16, '0'),
};
const dart = await dartComplete;
if (typescript.failures !== 0 || dart.failures !== 0) {
  throw new Error(`corpus failures: TypeScript=${typescript.failures}, Dart=${dart.failures}`);
}
const { analyseP95Micros, ...dartCorpus } = dart;
if (!Number.isSafeInteger(analyseP95Micros) || analyseP95Micros < 0) {
  throw new Error(`invalid Dart analyse P95: ${analyseP95Micros}`);
}
if (analyseP95Micros >= 5_000) {
  throw new Error(`Dart analyse P95 exceeds 5 ms: ${analyseP95Micros / 1_000} ms`);
}
if (JSON.stringify(typescript) !== JSON.stringify(dartCorpus)) {
  throw new Error(
    `100k corpus mismatch:\nTypeScript ${JSON.stringify(typescript)}\nDart ${JSON.stringify(dartCorpus)}`,
  );
}

console.warn(
  `PASS runs=${runs} digest=${typescript.fnv64} code_units=${codeUnits} ` +
    `dart_analyse_p95_ms=${(analyseP95Micros / 1_000).toFixed(3)} ` +
    `elapsed_s=${((performance.now() - started) / 1000).toFixed(1)}`,
);
