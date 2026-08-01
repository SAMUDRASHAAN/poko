# ADR-0006: Analytics are aggregated on device and uploaded as daily rollups

- **Status:** Accepted
- **Date:** 2026-08-01

## Context

Every user of this product is a child under 18. India's DPDP Rules 2025 prohibit
tracking, behavioural monitoring and targeted advertising directed at children,
and app-store family policies add further constraints. The standard product
playbook — instrument every event, ship it to a third-party SDK, optimise
engagement — is unavailable, and not merely as a compliance formality.

## Decision

Count events on-device into SQLite. Roll up nightly to day-level aggregates.
Upload only the rollups. No event streams leave the device. No third-party
analytics or advertising SDK exists in the client. Crash reporting runs with PII
scrubbing on and no child identifiers attached. Retention is 90 days rolling, and
a parent can erase everything at any time.

## Consequences

- We still get what actually matters: retention, session length, per-level
  abandon rate, accuracy trends, difficulty-curve validation.
- No behavioural profile of any child ever leaves the device.
- CI enforces this with a dependency audit that fails on known analytics and ads
  SDKs. [INV-12]
- **Cost:** no funnel analysis, no cohort replay, no per-event debugging in
  production. Reproduce issues from a seed and an action log instead — which
  ADR-0002 and ADR-0004 make possible.
- Monetisation must be parent-paid. Advertising was never viable here.

## Alternatives considered

- **Standard analytics with a "kids mode"** — the SDK is still present and still
  collects. The compliance posture depends on a vendor's configuration rather
  than on our architecture.
- **No analytics at all** — leaves the difficulty curve unvalidated, which is a
  product-quality failure, not just a business one.
