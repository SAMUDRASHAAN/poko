import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // levelgen is intentionally not a workspace package yet: package manifests
    // and the lockfile remain human-owned. Resolve the frozen package root for
    // the verifier exactly as the future workspace link will.
    alias: {
      '@poko/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // No coverage thresholds here: this workspace is the harness, not the code
    // under test. Engine coverage is asserted in packages/engine.
  },
});
