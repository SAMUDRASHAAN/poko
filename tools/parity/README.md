# Engine parity tools

This directory is the independent language-boundary verifier for Gate 1F. It
reads the TypeScript oracle and Dart engine only through their frozen public
entry points; it never edits engine output to resolve a mismatch.

```sh
# Regenerate reviewed fixtures only from the pinned, clean oracle source.
pnpm --filter @poko/parity export

# Compare the checked-in fixtures with a Dart workspace.
POKO_DART_WORKSPACE=../poko-dart-engine/flutter \
  pnpm --filter @poko/parity verify

# Compare the complete seeded corpus as a canonical rolling digest.
PARITY_RUNS=100000 \
POKO_DART_WORKSPACE=../poko-dart-engine/flutter \
  pnpm --filter @poko/parity corpus
```

`verify.mjs` also checks the frozen Dart contract and schema snapshots. Omit
`POKO_DART_WORKSPACE` after the Dart engine has merged and the repository-local
`flutter/` workspace is authoritative.
