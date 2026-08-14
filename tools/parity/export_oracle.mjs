import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import {
  analyse,
  createLevel,
  dispatch,
  generatePack,
  restore,
  serialise,
  updateMastery,
} from '../../packages/engine/src/index.ts';

const ORACLE_COMMIT = 'f0cf0ffab4cca7c88475b6d0c14bc2d82ce84040';
const repo = fileURLToPath(new URL('../..', import.meta.url));
const manifestPath = fileURLToPath(
  new URL('../../contracts/fixtures/v1/manifest.json', import.meta.url),
);

execFileSync('git', ['diff', '--quiet', ORACLE_COMMIT, '--', 'packages/engine'], {
  cwd: repo,
  stdio: 'inherit',
});

const bands = {
  sprout: {
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
  adventurer: {
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
  challenger: {
    id: 'challenger',
    numberRange: [1, 12],
    allowedOperations: ['add', 'sub', 'mul', 'div'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish'],
    minChain: 2,
    maxChain: 5,
    maxTarget: 100,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  },
  trailblazer: {
    id: 'trailblazer',
    numberRange: [1, 15],
    allowedOperations: ['add', 'sub', 'mul', 'div'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish'],
    minChain: 2,
    maxChain: 6,
    maxTarget: 150,
    allowNegatives: false,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 6,
  },
  pathfinder: {
    id: 'pathfinder',
    numberRange: [1, 20],
    allowedOperations: ['add', 'sub', 'mul', 'div', 'wild'],
    allowedColours: ['coral', 'marine', 'kelp', 'sunfish', 'violet'],
    minChain: 2,
    maxChain: 6,
    maxTarget: 200,
    allowNegatives: true,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 8,
  },
};

const rules = {
  objective: 'equationCount',
  goalValue: 3,
  moveLimit: 10,
  obstacles: [],
  allowedPowerUps: ['hintLens', 'equationShuffle'],
  targetSkills: ['addition', 'subtraction'],
};

const jsonState = (state) => JSON.parse(serialise(state));
const cases = [];

Object.entries(bands).forEach(([bandId, band], index) => {
  const seed = [12345, 42, -1, 0x7fffffff, -987654321][index];
  const input = { seed, rules, band };
  cases.push({
    id: `create-${bandId}`,
    operation: 'createLevel',
    input,
    expected: jsonState(createLevel(seed, rules, band)),
  });
});

const traceInitial = createLevel(7, rules, bands.sprout);
const traceSolution = analyse(traceInitial.board, traceInitial.target, rules).bestSolution;
if (!traceSolution) throw new Error('trace fixture must be solvable');
const actions = [
  { type: 'BEGIN_CHAIN', cell: traceSolution.cells[0] },
  ...traceSolution.cells.slice(1).map((cell) => ({ type: 'EXTEND_CHAIN', cell })),
  { type: 'COMMIT' },
  { type: 'REQUEST_HINT' },
  { type: 'PAUSE' },
  { type: 'RESUME' },
  { type: 'TICK', deltaMs: 16 },
];
let traced = traceInitial;
const states = [];
for (const action of actions) {
  traced = dispatch(traced, action);
  states.push(jsonState(traced));
}
cases.push({
  id: 'dispatch-solved-trace',
  operation: 'dispatch',
  input: { state: jsonState(traceInitial), actions },
  expected: states,
});

const serialised = serialise(createLevel(99, rules, bands.sprout));
cases.push({
  id: 'serialise-level',
  operation: 'serialise',
  input: { state: JSON.parse(serialised) },
  expected: serialised,
});
cases.push({
  id: 'restore-level',
  operation: 'restore',
  input: { blob: serialised },
  expected: jsonState(restore(serialised)),
});

const analysed = createLevel(12345, rules, bands.sprout);
cases.push({
  id: 'analyse-golden-board',
  operation: 'analyse',
  input: {
    board: jsonState(analysed).board,
    target: analysed.target,
    rules,
  },
  expected: analyse(analysed.board, analysed.target, rules),
});

for (const bandId of Object.keys(bands)) {
  cases.push({
    id: `pack-${bandId}`,
    operation: 'generatePack',
    input: { bandId, count: 2, seed: 99 },
    expected: generatePack(bandId, 2, 99),
  });
}

const mastery = {
  skillId: 'addition',
  mastery: 0.5,
  attempts: 4,
  correct: 3,
  avgTimeMs: 4000,
  hintsUsed: 1,
  nextReviewInDays: 2,
};
for (const [id, attempt] of Object.entries({
  fluent: {
    skillId: 'addition',
    correct: true,
    timeMs: 2000,
    hintUsed: false,
    expectedTimeMs: 4000,
  },
  hinted: {
    skillId: 'addition',
    correct: true,
    timeMs: 2000,
    hintUsed: true,
    expectedTimeMs: 4000,
  },
  incorrect: {
    skillId: 'addition',
    correct: false,
    timeMs: 6000,
    hintUsed: false,
    expectedTimeMs: 4000,
  },
})) {
  cases.push({
    id: `mastery-${id}`,
    operation: 'updateMastery',
    input: { previous: mastery, attempt },
    expected: updateMastery(mastery, attempt),
  });
}

const manifest = {
  schemaVersion: 1,
  oracle: { implementation: 'typescript', commit: ORACLE_COMMIT },
  cases,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
execFileSync(process.env.POKO_PRETTIER_BIN ?? 'prettier', ['--write', manifestPath], {
  cwd: repo,
  stdio: 'inherit',
});
console.warn(`Exported ${cases.length} cases from ${ORACLE_COMMIT}.`);
