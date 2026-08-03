import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // No coverage thresholds here: this workspace is the harness, not the code
    // under test. Engine coverage is asserted in packages/engine.
  },
});
