# Cross-language contracts

This directory is the language-neutral boundary between the accepted TypeScript
oracle and the production Dart engine. Schemas and checked-in fixtures are
reviewed independently from Dart engine implementation changes.

Version 1 starts with the manifest envelope in
`schema/v1/parity-fixture.schema.json`. The Phase 1F parity worktree expands the
case payloads and exports canonical cases from the exact oracle commit recorded
in each manifest. Expected output must never be regenerated merely to make a
failing Dart implementation pass.

Contract changes require an ADR and a sync point across active engine/parity
worktrees.
