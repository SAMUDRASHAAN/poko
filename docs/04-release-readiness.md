# Release readiness — Poko's World v1

|              |                                                                        |
| ------------ | ---------------------------------------------------------------------- |
| **Status**   | Canonical readiness strategy from Gate 1 to launch                     |
| **Audience** | Owner, engineering, QA, content                                        |
| **Related**  | `03-build-plan.md` · `WORKTREE-PLAN.md` · `ARCHITECTURE.md` · ADR-0001 |

`03-build-plan.md` says _what_ to build and `WORKTREE-PLAN.md` says _who builds it
where_. This document says **what must be true before each phase starts**, and what
"production ready" means for a maths game played by children under 13.

If this document conflicts with an accepted ADR or an architecture invariant, the
ADR or invariant wins and this document must be corrected in the same change.

---

## 1. Where the build actually is

Phase 0 and Phase 1 are complete. Gate 1 is green: engine coverage ≥90%, 100,000
generated boards with zero unsolvable [INV-6], `analyse()` inside its 5 ms budget,
reducer purity and lossless serialisation proven.

What exists: `packages/engine`, `packages/ui/src/tokens.ts`, and the three
verification tools. What does not exist: **`apps/` is empty**, and `packages/ui`
contains no primitives — zero of the components in `03-build-plan.md` §1.5.

The honest reading: the part of the product whose correctness a machine can decide
is finished. Rendering at 60 fps on low-end Android, offline-first sync, RLS over
children's data, store review, and a difficulty curve that actually teaches are all
ahead, and none of them are decidable by unit tests.

---

## 2. The governing lesson

Decoy quality was specified in `.claude/rules/engine.md`, in `02-content-spec.md`,
and named "a first-class concern" by ADR-0004. It was violated for the whole of
Phase 1 while CI stayed green, because **nothing measured it**. It was found only
when someone measured it directly (ADR-0009).

Read the invariant table in `ARCHITECTURE.md` §7 through that lens:

| Status                              | Invariants                   |
| ----------------------------------- | ---------------------------- |
| Enforced and exercised today        | INV-1, 3, 4, 5, 6, 7, 12, 15 |
| Rule exists, nothing yet to check   | INV-2, INV-13                |
| **No enforcement mechanism at all** | INV-8, 9, 10, 11, 14         |

The five unenforced invariants are the ones carrying legal and product risk:
offline playability, SQLite as source of truth, consent gating, no full date of
birth, and 64×64 touch targets. They are unenforced because the code they guard
does not exist yet — which is exactly when the check is cheap to write. Phase 0
already proved the pattern by writing `.dependency-cruiser.js` before the engine
had a single line.

> **The rule for every remaining phase: the measurement lands before the feature,
> and it is written by someone other than the implementer.**

That is the worktree model already in use for engine correctness. Extend it to
performance, accessibility, privacy, and content quality — the four areas where a
green build currently proves nothing.

---

## 3. Phase entry conditions

Each phase may not start until its measurement exists.

### Phase 2 — board renderer and UI

| Before writing feature code                                                                                        | Guards |
| ------------------------------------------------------------------------------------------------------------------ | ------ |
| **Frame-timing harness**: scripted drag → refill → target rotation, frame times captured, pass/fail against budget | Gate 2 |
| **Hit-target test helper**: asserts every interactive child-zone element is ≥64×64                                 | INV-14 |
| **Accessibility variant renderer**: each primitive rendered in every supported variant                             | §1.5   |

Gate 2 is "sustained 60 fps drag and refill on the reference low-end Android
device". Today there is neither a harness nor a device. Without the harness, frame
drops surface during beta, when the fix is architectural rather than local.

Twenty primitives times six variants is precisely the surface where a manual
checklist rots silently.

### Phase 3 — screens, persistence, backend

| Before writing feature code                                                        | Guards |
| ---------------------------------------------------------------------------------- | ------ |
| **Cross-account RLS attack suite**, as a required check                            | §RLS   |
| **Consent-gate attack test** — child data rejected server-side without a record    | INV-10 |
| **Airplane-mode E2E** — a full session completes and syncs once on reconnect       | INV-8  |
| **Schema constraint** making a full date of birth unstorable, not merely unwritten | INV-11 |

The highest-consequence phase. Each of these is written as an attack that must
fail, not a happy path that must pass.

### Phase 4 — content and parent zone

Difficulty-curve monotonicity is the same shape of risk as decoy quality: a quality
property no unit test will catch. Compute monotonicity across the 50 seeds as a
mechanical check, with human review layered on top of the number rather than
substituting for it.

### Phases 5–6 — integration, beta, launch

`WORKTREE-PLAN.md` §10 already forbids parallelising these. Respect it: once work
crosses every boundary, a second agent adds merge surface and review load faster
than throughput.

---

## 4. The critical path is not code

Three of the four open items in `PHASE-0-CHECKLIST.md` are procurement and legal,
with calendar lead times that working harder does not compress.

| Item                                                              | Blocks                                                  | Risk if late                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| **Reference devices** (~Rs.10k Android, SE-class iPhone)          | ADR-0001 Rive spike → all of Phase 2; and Gate 2 itself | `wt/board` Skia/Reanimated work is unrecoverable if ADR-0001 reverses |
| **Trademark clearance** ("Poko's World" / "Sumlings", Cl. 9 & 41) | Naming, everywhere                                      | The name is baked into `@poko/*`, the repo and every doc              |
| **Indian privacy counsel** (DPDP consent flow)                    | Phase 3 schema and Edge Functions                       | Rework of exactly the code that touches children's data               |
| **Store child-policy review**                                     | Public beta                                             | Late-stage submission rejection                                       |

All four can start immediately and none require the app to exist. **The device
order is the single highest-value unblock available**, because Phase 2 is already
in flight against a decision the spike has not yet confirmed.

Until the spike resolves, hold Phase 2's Skia work at a reversible boundary.

---

## 5. Keeping CI honest as it grows

- **Tier the fuzz gate.** It is 7m05s on CI and required on every PR, and it will
  grow. Run a 5–10k sample on PRs and the full 100k on `main` and nightly. Same
  signal, without paying it on every push.
- **Remove the flaky timing assertion.** `tools/verify/behaviour.spec.ts` asserts a
  single wall-clock sample per seed and has already produced a false failure at
  8.5 ms against a real 0.48 ms. Assert a median or p95 instead. One flaky required
  check trains everyone to re-run red builds, which is how a real failure gets
  waved through.
- **Grow required checks per phase**: device perf at Phase 2, RLS suite at Phase 3,
  difficulty-curve check at Phase 4.
- **Cross-model review is currently unenforceable.** Both agents authenticate as the
  owner, so required approvals must be 0 and `WORKTREE-PLAN.md` §8's review rule is
  honour-system. A second GitHub account is the only mechanism that would bind it.

---

## 6. Known debt to schedule

| Item                                                      | Source   | When                                      |
| --------------------------------------------------------- | -------- | ----------------------------------------- |
| `createInitialState` does not enforce `band.maxSolutions` | ADR-0009 | Decide before Phase 4 sets difficulty     |
| Tide-shuffle story beat cannot be signalled to the client | PR #6    | Needs frozen-contract change + sync point |
| `tools/verify` timing assertion is single-sample          | §5       | Before required-check count grows         |

Levels shipped through `generatePack` are validated, so the first item is not
urgent — but an ad-hoc `createLevel` can produce a board far easier than its band
intends, and the difficulty curve is measured on generated levels.

---

## 7. Definition of production ready

Green CI is necessary and nowhere near sufficient. For this product, launch
requires all of:

1. Gates 1, 2 and 3 passed on real hardware, not simulators.
2. Consent flow reviewed by Indian privacy counsel; DPDP obligations mapped to
   code, with INV-10 and INV-11 enforced server-side and schema-side.
3. Data export and erasure **rehearsed** end to end, not merely implemented.
4. Crash recovery and release rollback rehearsed.
5. Device matrix swept on real low-end Android hardware.
6. Store child-policy submission passed.
7. Trademark cleared in Classes 9 and 41.
8. Difficulty curve human-reviewed and mechanically monotonic.
9. A parent completes onboarding and consent unaided in under three minutes.

Items 2, 6 and 7 are owner actions tracked outside this repository and cannot be
satisfied by passing CI — `03-build-plan.md` §11 makes the same point, and it is
the one most likely to be forgotten under delivery pressure.

---

## 8. Next actions

1. Order the reference devices; open counsel and trademark work in parallel.
2. Build the Gate 2 frame-timing harness and the hit-target/variant test helpers
   before further board code lands.
3. Tier the fuzz gate and de-flake the timing assertion.
4. Run the Rive spike the day the Android device arrives; keep Phase 2 reversible
   until it resolves.
