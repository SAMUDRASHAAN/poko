#!/usr/bin/env node
/**
 * Gate 2 runner — captures frame timings from a connected Android device.
 *
 *   node --import tsx tools/gate2/src/cli.ts --package com.poko.app --seconds 60
 *   node --import tsx tools/gate2/src/cli.ts --file captured.txt      # re-analyse
 *
 * Needs `adb` and a device. The analysis it wraps is pure and runs in CI without
 * either — see `framestats.ts`.
 *
 * ## What this deliberately does not do
 *
 * It does not drive the app. Gate 2 is "sustained 60 fps drag and refill", and
 * the drag has to be the real gesture over the real board; a scripted `adb input
 * swipe` moves a finger but does not reproduce a child dragging a chain across
 * tiles. So the operator performs the interaction while this captures. When the
 * board exists and exposes a deterministic scripted path, that script belongs
 * here — and until then, inventing one would measure a gesture nobody makes.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { GATE2_DEFAULT_BUDGET, formatReport, judge } from './budget.js';
import { analyseFrames, parseFramestats } from './framestats.js';

type Options = {
  readonly packageName: string | null;
  readonly file: string | null;
  readonly seconds: number;
  readonly serial: string | null;
};

function parseArgs(argv: readonly string[]): Options {
  const get = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const seconds = Number(get('--seconds') ?? 60);
  return {
    packageName: get('--package'),
    file: get('--file'),
    seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 60,
    serial: get('--serial'),
  };
}

function adb(options: Options, args: readonly string[]): string {
  const prefix = options.serial ? ['-s', options.serial] : [];
  return execFileSync('adb', [...prefix, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function capture(options: Options): string {
  if (options.packageName === null) {
    throw new Error('--package is required when capturing from a device');
  }

  const devices = adb(options, ['devices'])
    .split('\n')
    .slice(1)
    .filter((line) => line.trim().endsWith('device'));
  if (devices.length === 0) throw new Error('no device: `adb devices` is empty');

  // Record the hardware, so a report can never be mistaken for one taken on
  // different hardware than it claims.
  const describe = (property: string): string =>
    adb(options, ['shell', 'getprop', property]).trim();
  process.stderr.write(
    `device : ${describe('ro.product.manufacturer')} ${describe('ro.product.model')}, ` +
      `Android ${describe('ro.build.version.release')}, ${describe('ro.soc.model')}\n`,
  );

  adb(options, ['shell', 'dumpsys', 'gfxinfo', options.packageName, 'reset']);
  process.stderr.write(
    `capturing ${options.seconds}s — perform the drag and refill interaction now\n`,
  );

  const until = Date.now() + options.seconds * 1000;
  // framestats keeps only the most recent ~120 frames, so poll and accumulate
  // rather than reading once at the end and losing most of the run.
  const blocks: string[] = [];
  while (Date.now() < until) {
    execFileSync('sleep', ['1']);
    blocks.push(adb(options, ['shell', 'dumpsys', 'gfxinfo', options.packageName, 'framestats']));
  }

  return blocks.join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  const raw = options.file !== null ? readFileSync(options.file, 'utf8') : capture(options);

  const samples = parseFramestats(raw);
  const report = analyseFrames(samples);
  const verdict = judge(report, GATE2_DEFAULT_BUDGET);

  process.stdout.write(`${formatReport(report, verdict)}\n`);

  // INCONCLUSIVE is not a pass. Exit non-zero so a run that could not be judged
  // never reads as a green Gate 2 in a script or a CI log.
  process.exitCode = verdict.pass ? 0 : 1;
}

main();
