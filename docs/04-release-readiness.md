# Release readiness — Poko's World v1

|              |                                                                        |
| ------------ | ---------------------------------------------------------------------- |
| **Status**   | Canonical readiness strategy from Gate 1 to launch                     |
| **Audience** | Owner, engineering, QA, content                                        |
| **Related**  | `03-build-plan.md` · `WORKTREE-PLAN.md` · `ARCHITECTURE.md` · ADR-0011 |

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

What exists: `packages/engine`, content/client-data references,
`packages/ui/src/tokens.ts`, verification tools, and retained two-model Rive
evidence. What does not exist: **the production Flutter workspace and app**.

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

| Status                                          | Invariants                      |
| ----------------------------------------------- | ------------------------------- |
| Enforced and exercised in the TypeScript oracle | INV-1, 3, 4, 5, 6, 7, 15        |
| Repository dependency audit exists              | INV-12                          |
| Must be recreated before Dart feature code      | INV-1, 2, 3, 4, 5, 6, 7, 13, 15 |
| No product implementation exists yet            | INV-8, 9, 10, 11, 14            |

The five not-yet-implementable invariants are the ones carrying legal and product risk:
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

Gate 2 remains "sustained 60 fps drag and refill on both physical Android models
in the approved managed low-end profile" (ADR-0010). Managed access and a proven
Macrobenchmark artifact path now exist. Phase 2 must adapt that path to the
Flutter board scenario before rendering feature code begins.

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

`WORKTREE-PLAN.md` §8 already forbids parallelising these. Respect it: once work
crosses every boundary, a second agent adds merge surface and review load faster
than throughput.

---

## 4. The critical path is not code

The engineering critical path now sits beside three external review items whose
calendar lead times working harder does not compress.

| Item                                                              | Blocks                            | Risk if late                                                                               |
| ----------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| **Flutter foundation + Dart parity**                              | All production client work        | A direct feature start could encode behavior that no longer matches the accepted TS oracle |
| **Trademark clearance** ("Poko's World" / "Sumlings", Cl. 9 & 41) | Naming, everywhere                | The name is baked into `@poko/*`, the repo and every doc                                   |
| **Indian privacy counsel** (DPDP consent flow)                    | Phase 3 schema and Edge Functions | Rework of exactly the code that touches children's data                                    |
| **Store child-policy review**                                     | Public beta                       | Late-stage submission rejection                                                            |

The managed-device item is resolved and ADR-0011 has exercised the fallback.
The immediate engineering critical path is the serialized Flutter foundation,
then cross-language engine parity. Counsel, store-policy and trademark work remain
external calendar risks and should proceed in parallel.

---

## 5. Keeping CI honest as it grows

- **The fuzz gate is tiered.** ✅ Pull requests run a 10,000-board sample; `main`
  and the nightly schedule run the full 100,000. The full corpus took 7m05s and was
  required on every push, which makes a gate something people work around rather
  than with. The sampled tier still catches systematic INV-6 breakage in about a
  minute, and rare-case coverage moves to where a slow job costs nobody's review
  cycle. `FUZZ_RUNS` selects the tier; the job name stays `fuzz` because branch
  protection matches on it.
- **The timing assertion measures the distribution.** ✅
  `tools/verify/behaviour.spec.ts` asserted a single wall-clock sample per seed and
  produced two false failures — 8.6 ms and 6.4 ms against a real ~0.5 ms — the
  second on a documentation-only pull request that changed no code. It now asserts
  median and p90 against the 5 ms budget, with the max held to 5× as a pathology
  guard. A regression moves the distribution; a noisy runner moves one sample.
- **Grow required checks per phase**: device perf at Phase 2, RLS suite at Phase 3,
  difficulty-curve check at Phase 4.
- **Cross-model review is currently unenforceable.** Both agents authenticate as the
  owner, so required approvals must be 0 and `WORKTREE-PLAN.md` §8's review rule is
  honour-system. A second GitHub account is the only mechanism that would bind it.

---

## 6. Known debt to schedule

| Item                                                                                    | Source   | When                                      |
| --------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| Band ceilings are far below what the generator naturally produces                       | ADR-0009 | Calibrate when Phase 4 sets difficulty    |
| Tide-shuffle story beat cannot be signalled to the client                               | PR #6    | Needs frozen-contract change + sync point |
| Daily-challenge and practice seeds must route through `generatePack`, not `createLevel` | ADR-0009 | Before any such mode ships                |

The first item is a calibration question, not a defect. `generatePack` honours
every ceiling — but it does so by scanning into a narrow tail: only 3.3% of
generated sprout boards sit at or under the ceiling of 4, against a median of 14.
So sprout content is drawn from an atypical 3% of the generator's output. Nothing
breaks today, and whether that tail is the content we want is a decision worth
making deliberately in Phase 4 rather than inheriting from a ceiling that was never
calibrated against what the generator actually produces.

The related enforcement gap is closed. `createInitialState` still does not enforce
`band.maxSolutions` — it cannot at acceptable cost, and making it try would
regenerate every existing level (ADR-0009, "Resolved"). Instead the one live path
that skipped validation, the `equationShuffle` power-up, now validates and redraws
the way `generatePack` does. The standing rule that replaces it: **any caller that
builds a level from an arbitrary seed must validate it.** `createLevel` alone
carries only a statistical guarantee.

The third is the same root cause seen from the product side. `createLevel` carries
only a statistical decoy guarantee — roughly one seed in five thousand lands below
the teaching bar — so any mode that generates levels from arbitrary seeds at
runtime inherits that, while anything drawn from `generatePack` does not.

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

1. Merge the ADR-0011 Flutter rebaseline and retire/freeze pre-replatform Phase 2
   worktrees.
2. Build the serialized Flutter foundation and language-neutral parity contracts.
3. Port the pure engine to Dart while an independent worktree verifies every
   golden seed, action trace, serialization fixture and 100,000-state corpus.
4. Start Flutter board/UI work only after Gate 1F; keep counsel and trademark work
   moving in parallel.
