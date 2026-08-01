---
paths:
  - 'apps/api/**'
  - 'packages/client-data/**'
---

# Backend and persistence rules

## The backend is deliberately small

Five jobs only: authenticate parents, record consent, sync progress, serve
reports, handle billing. Roughly 800-1200 lines total for v1. If you are writing
more, check ARCHITECTURE.md section 12 before continuing.

## Non-negotiable

- RLS on EVERY table. No exceptions. Parents reach child rows only through
  `child_profile.parent_id = auth.uid()`.
- Children never authenticate. No child credential exists anywhere. [INV-10]
- No child data is processed before a valid, unrevoked `consent_record`.
  Enforced server-side in every child-data function, not just in the UI.
- `consent_record` is APPEND ONLY. No updates, no deletes.
- Store birth YEAR, never a full date of birth. [INV-11]
- Telemetry is day-level aggregate rollups. Never per-event child streams.
  No third-party analytics SDK. [INV-12]

## Sync

SQLite on device is the source of truth. [INV-9] The server is a sync target.
Every outbox row carries a client UUID and `updated_at`; applying is idempotent.
Progress conflicts resolve "best wins" (highest score / most stars), never by
clobbering.

## Never build in v1

Realtime gateway, AI orchestration, pgvector, microservices, leaderboards.
