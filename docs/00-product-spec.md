# Product specification — Poko's World v1: Tally Sea

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Status**   | Canonical v1 product contract                                                           |
| **Audience** | Product, design, engineering, content, QA                                               |
| **Related**  | `ARCHITECTURE.md` · `01-experience-spec.md` · `02-content-spec.md` · `03-build-plan.md` |

If this document conflicts with an accepted ADR or an architecture invariant,
the ADR or invariant wins and this document must be corrected in the same change.

## 1. Product promise

Poko's World helps children aged 4–12 practise numeracy through short, calm,
replayable puzzle sessions. The v1 release is **Tally Sea**, an 8×8 equation-path
game hosted by the scripted character Poko.

The product must be:

- playable with the network permanently unavailable;
- safe for a child to explore without ads, purchases, external links, or social features;
- exact and fair: a valid answer is never rejected and an impossible target is never shown;
- usable by an early reader through icons, spoken labels, and consistent interaction;
- transparent to the parent, including consent, learning progress, controls, export, and erasure.

## 2. Users and zones

### Child

The child plays without an account or credential. A child selects a local profile,
plays assigned or recommended levels, receives immediate non-punitive feedback,
and can view earned rewards. A child cannot reach network, billing, privacy, or
account-management functions.

### Parent or guardian

The parent authenticates by phone OTP, grants consent before any child profile is
created, manages profiles and controls, views plain-language learning reports,
and exercises export or erasure rights. Leaving the parent zone always returns to
Profile Select.

## 3. Core session

1. The child selects a profile and chooses **Continue** or a visible level.
2. The app restores or creates a deterministic level from a seed, rules, and band configuration.
3. A target number is presented visually and through optional spoken output.
4. The child drags through adjacent, same-colour tiles to form an equation.
5. The preview updates while dragging without marking an unfinished thought wrong.
6. Releasing commits the chain.
7. A non-matching chain returns calmly to the ready state with no move or score penalty.
8. A matching chain resolves, scores, refills, selects a new target, proves solvability, and returns to ready.
9. The ready state is persisted locally and the attempt is queued for later sync.
10. The level ends on its objective, move, or time condition and shows an interruptible result/reward sequence.

## 4. Game contract

- The board is 8×8 and rendered as one canvas.
- A chain is an ordered path of cells permitted by the active band configuration.
- Equation validity, evaluation order, target comparison, adjacency, chain length,
  swap legality, gravity, refill, scoring, difficulty, and mastery are engine rules.
- Equation operands and results use exact rational `Num` values. Counts, time,
  scores, seeds, and mastery coefficients remain typed scalar metadata.
- All random choices consume an explicit seeded RNG in a stable order.
- Every target presented in a reachable ready state has at least one solution.
- Solution, rejection, refill, and target rotation are one atomic engine transition;
  the client may animate that result but may not change it.
- A level and its action log must reproduce the same states on every supported platform.

## 5. v1 scope

### Included

- deterministic Tally Sea level creation, solving, validation, refill, and state machine;
- five skill bands, with exact production configuration owned by `packages/content`;
- seeded bundled levels and on-device generation;
- child onboarding, profile selection, play, results, rewards, and accessibility settings;
- parent authentication, consent, profiles, dashboard, controls, subscription state, export, and erasure;
- offline SQLite persistence with an idempotent sync outbox;
- scripted Poko voice output, sound effects, music/mute controls, and tap fallbacks;
- iOS and Android release clients; a scaffolded web client is not a v1 launch target.

### Explicitly excluded

- story episodes and session ribbon;
- voice input or open-ended speech recognition;
- live AI or generated tutoring dialogue;
- realtime multiplayer, leaderboards, chat, or social identity;
- third-party behavioural analytics, advertising, or child event streams;
- microservices, vector search, or a remotely served level-content API.

## 6. Learning and difficulty

The engine selects targets using the active band, recent mastery, and configured
skills. Weak skills may receive three times the normal selection weight, but the
child is never told they are weak. Difficulty is controlled through number range,
operations, chain length, solution count, setup moves, obstacles, and objective
pressure. The production curve must be monotonic and human-reviewed.

The app rewards effort and progress without shame, loss aversion, or pressure to
maintain a streak. Hints are allowed and recorded for adaptation; they do not
invalidate completion.

## 7. Data and privacy requirements

- SQLite is the client source of truth; server state is a sync target.
- No child data is processed before an immutable consent record exists.
- Store birth year only, never full date of birth.
- Parents can access only profiles linked to their authenticated ID.
- Telemetry leaves the device only as day-level aggregates.
- Production credentials never enter development or agent environments.
- Export and erase are first-class parent actions, not support-only workflows.

## 8. v1 acceptance

v1 is releasable only when:

- all architecture invariants have mechanical enforcement;
- Gate 1 proves 100,000 generated boards solvable and `analyse()` stays under 5 ms;
- the reference Android device sustains 60 fps through drag and refill;
- a full session works in airplane mode and later syncs exactly once;
- cross-account RLS attack tests cannot read or mutate another parent's data;
- a parent completes authentication, consent, and child setup unaided in under three minutes;
- accessibility, privacy, performance, and device-matrix suites pass.

## 9. Product evidence

Only aggregate, privacy-safe measures are used: day-level active devices,
session duration bands, completion and abandonment counts, accuracy by anonymous
skill aggregate, hint rate, difficulty progression, crash-free sessions, sync
success, and parent report usage. No metric justifies weakening a child-safety or
privacy invariant.
