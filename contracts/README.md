# Cross-language contracts

This directory is the language-neutral boundary between the accepted TypeScript
oracle and the production Dart engine. Schemas and checked-in fixtures are
reviewed independently from Dart engine implementation changes.

Version 1 starts with the manifest envelope in
`schema/v1/parity-fixture.schema.json`. Its manifest contains canonical cases for
all seven public engine operations, exported from the exact oracle commit
recorded in the manifest. `snapshots/v1/public-api.json` freezes the schema and
Dart public contract independently from implementation bodies.

`tools/parity/verify.mjs` compares every checked-in fixture through the Dart
black-box adapter. `tools/parity/corpus.mjs` additionally compares the same
100,000 seeded pack/state/analysis records as a canonical 64-bit rolling digest.
Expected output must never be regenerated merely to make a failing Dart
implementation pass.

Contract changes require an ADR and a sync point across active engine/parity
worktrees.
