import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { isDeepStrictEqual, inspect } from 'node:util';
import { fileURLToPath, URL } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const manifestPath = fileURLToPath(
  new URL('../../contracts/fixtures/v1/manifest.json', import.meta.url),
);
const schemaPath = fileURLToPath(
  new URL('../../contracts/schema/v1/parity-fixture.schema.json', import.meta.url),
);
const snapshotPath = fileURLToPath(
  new URL('../../contracts/snapshots/v1/public-api.json', import.meta.url),
);
const adapterPath = fileURLToPath(new URL('dart_adapter.dart', import.meta.url));
const dartWorkspace = process.env.POKO_DART_WORKSPACE ?? `${repo}/flutter`;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const operations = new Set([
  'createLevel',
  'dispatch',
  'serialise',
  'restore',
  'analyse',
  'generatePack',
  'updateMastery',
]);

if (
  manifest.schemaVersion !== 1 ||
  manifest.oracle?.implementation !== 'typescript' ||
  !/^[0-9a-f]{40}$/.test(manifest.oracle?.commit ?? '') ||
  !Array.isArray(manifest.cases)
) {
  throw new Error('manifest does not satisfy the v1 envelope');
}

const ids = new Set();
for (const fixture of manifest.cases) {
  if (
    typeof fixture?.id !== 'string' ||
    fixture.id.length === 0 ||
    ids.has(fixture.id) ||
    !operations.has(fixture.operation) ||
    !Object.hasOwn(fixture, 'input') ||
    !Object.hasOwn(fixture, 'expected')
  ) {
    throw new Error(`invalid or duplicate fixture: ${inspect(fixture)}`);
  }
  ids.add(fixture.id);
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
if (sha256(readFileSync(schemaPath)) !== snapshot.schemaSha256) {
  throw new Error('parity schema changed without updating its reviewed snapshot');
}
for (const [relative, expected] of Object.entries(snapshot.dartContractSha256)) {
  const path = `${dartWorkspace}/${relative}`;
  if (!existsSync(path) || sha256(readFileSync(path)) !== expected) {
    throw new Error(`frozen Dart contract changed: ${relative}`);
  }
}

const apiSource = readFileSync(
  `${dartWorkspace}/packages/game_engine/lib/src/api.dart`,
  'utf8',
).replaceAll(/\s+/g, ' ');
for (const signature of snapshot.apiSignatures) {
  if (!apiSource.includes(`${signature} =>`)) {
    throw new Error(`Dart API signature changed or disappeared: ${signature}`);
  }
}

const packageConfig = `${dartWorkspace}/.dart_tool/package_config.json`;
if (!existsSync(packageConfig)) {
  throw new Error(
    `missing ${packageConfig}; run flutter pub get --enforce-lockfile in the Dart workspace`,
  );
}
const dart = spawnSync('dart', [`--packages=${packageConfig}`, adapterPath], {
  cwd: dartWorkspace,
  encoding: 'utf8',
  input: JSON.stringify({ cases: manifest.cases }),
  maxBuffer: 64 * 1024 * 1024,
});
if (dart.status !== 0) {
  throw new Error(`Dart adapter failed:\n${dart.stderr || dart.stdout}`);
}

const response = JSON.parse(dart.stdout);
if (!Array.isArray(response.results) || response.results.length !== manifest.cases.length) {
  throw new Error('Dart adapter returned an incomplete result set');
}

const failures = [];
for (let index = 0; index < manifest.cases.length; index += 1) {
  const fixture = manifest.cases[index];
  const result = response.results[index];
  if (result?.id !== fixture.id || !isDeepStrictEqual(result.actual, fixture.expected)) {
    failures.push(
      `${fixture.id}:\nexpected ${inspect(fixture.expected, { depth: 5 })}\n` +
        `actual   ${inspect(result?.actual, { depth: 5 })}`,
    );
  }
}
if (failures.length > 0) {
  throw new Error(`${failures.length} parity mismatches:\n${failures.slice(0, 5).join('\n\n')}`);
}

console.warn(
  `PASS cases=${manifest.cases.length} mismatches=0 ` +
    `oracle=${manifest.oracle.commit} snapshots=green`,
);
