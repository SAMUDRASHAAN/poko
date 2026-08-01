# ADR-0005: Supabase for the v1 backend

- **Status:** Accepted
- **Date:** 2026-08-01

## Context

The game runs entirely on-device and is offline-first, so the server does five
things only: authenticate parents, record consent, sync progress, serve reports,
handle billing. The dominant risk at this stage is over-building infrastructure
for v3 while v1 fails to ship.

## Decision

Use Supabase — Postgres, Auth (parent phone OTP), Row Level Security, Edge
Functions, Storage. Total server code for v1 is expected to be 800-1200 lines.

## Consequences

- RLS maps precisely onto the security model: a parent may touch only their own
  children's rows. Children never authenticate, which removes an entire class of
  risk.
- `supabase gen types typescript` generates types from the schema, so neither
  agent nor developer can invent a column that does not exist.
- **Cost:** vendor coupling. Mitigated because the surface is small, standard
  Postgres, and the client is offline-first — a migration would be an
  inconvenience, not a rewrite.
- Agents and developers use a LOCAL Supabase project. Production credentials
  never enter a development environment.

## Alternatives considered

- **Custom Node/Fastify + managed Postgres** — more control, several weeks more
  work, and reimplements auth and RLS that Supabase provides.
- **Firebase** — Google's analytics coupling is an active liability for a
  children's product under DPDP (see ADR-0006).
