/**
 * GATE 1 — the solvability fuzz harness. [INV-6]
 *
 * Runs in CI. Nothing downstream of Phase 1 starts until this passes:
 *   100,000 generated boards, ZERO unsolvable.
 *
 * This file is the executable form of the project's single most important
 * promise: a child can never be shown a target they cannot reach.
 */
import { analyse, createLevel, generatePack, type BandConfig } from '@poko/engine';

const RUNS = Number(process.env.FUZZ_RUNS ?? 100_000);
const BANDS: readonly BandConfig[] = [
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

type Failure = { seed: number; band: string; reason: string };

function main(): void {
  const failures: Failure[] = [];
  const started = Date.now();
  let slowest = 0;

  for (let i = 0; i < RUNS; i++) {
    const band = BANDS[i % BANDS.length] as BandConfig;
    const seed = i * 2654435761;

    try {
      const [puzzle] = generatePack(band.id, 1, seed);
      if (!puzzle) {
        failures.push({ seed, band: band.id, reason: 'generator returned no puzzle' });
        continue;
      }

      const state = createLevel(puzzle.seed, puzzle.rules, band);
      const t0 = performance.now();
      const analysis = analyse(state.board, state.target, state.rules);
      slowest = Math.max(slowest, performance.now() - t0);

      if (analysis.solutions.length === 0) {
        failures.push({ seed, band: band.id, reason: 'INV-6 VIOLATION: no solution exists' });
      }
      if (analysis.isStuck) {
        failures.push({ seed, band: band.id, reason: 'board is stuck within the move budget' });
      }
    } catch (err) {
      failures.push({ seed, band: band.id, reason: `threw: ${(err as Error).message}` });
    }

    if (i > 0 && i % 10_000 === 0) console.warn(`  ${i}/${RUNS}...`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.warn(`\nfuzz: ${RUNS} boards in ${elapsed}s, slowest analyse() ${slowest.toFixed(2)}ms`);

  if (slowest > 5) {
    console.error(`FAIL: analyse() budget exceeded — ${slowest.toFixed(2)}ms > 5ms`);
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} unsolvable or broken boards.`);
    for (const f of failures.slice(0, 10)) {
      console.error(`  seed=${f.seed} band=${f.band} — ${f.reason}`);
    }
    console.error('\nReproduce with: createLevel(<seed>, rules, band)');
    process.exit(1);
  }

  console.warn('PASS: every board solvable. GATE 1 green.');
}

main();
