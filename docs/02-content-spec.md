# Content and curriculum specification — Tally Sea v1

|                   |                                                    |
| ----------------- | -------------------------------------------------- |
| **Status**        | Canonical v1 content contract                      |
| **Content owner** | `packages/content`                                 |
| **Related**       | `00-product-spec.md` · ADR-0004 · `tools/levelgen` |

## 1. Content model

A shipped level is a deterministic seed plus a band ID and level rules. Production
content never stores a hand-authored board. The same artifact must reproduce a
byte-identical initial state on every platform and engine build approved for that
content version.

`packages/content` owns:

- band configurations;
- level seed packs;
- objective and difficulty metadata;
- child and parent copy strings;
- scripted voice lines and their manifest;
- reward labels and descriptions.

It may import the engine contract but contains no UI or platform code.

## 2. Skill bands

The five bands are `sprout`, `adventurer`, `challenger`, `trailblazer`, and
`pathfinder`. Exact ranges and thresholds live in versioned band configuration,
not components or screens.

Band progression may vary only through declared controls:

- number and target range;
- permitted operations and colours;
- minimum and maximum chain length;
- diagonal adjacency;
- minimum and maximum visible solutions;
- setup-move requirement;
- obstacle type/count and power-up availability;
- move/time pressure and objective mix.

New concepts are introduced one at a time. A production curve must be monotonic
under the engine's difficulty score and reviewed by a human educator or designated
curriculum owner. Narrative maturity tiers remain separate from skill bands.

## 3. Equation and target content

- Targets are produced solution-first from legal operands and operations.
- Bands that disallow negatives never generate a chain with an intermediate or final negative result.
- Bands requiring exact division never generate a fractional result accidentally.
- Fractions and decimals remain an extension point and are not authored for v1 unless an accepted scope ADR adds them.
- At least 60% of decoy pairs should evaluate within ±3 of the target, preventing visual elimination from replacing calculation.
- The configured solution count is verified after generation and every refill.

The engine owns mathematical correctness. Content selects legal constraints and
skills; it never overrides a validator result.

## 4. Level pack

The v1 bundled pack contains at least 50 validated seeds distributed across the
approved band curve. Each seed record includes stable ID, seed, band, rules,
difficulty score, validation counts, and a content schema version. Tooling may
wrap the pure engine result with build timestamp and engine commit metadata.

`tools/levelgen` must:

1. generate candidates from a fixed pack seed;
2. validate solvability and accidental-solution limits;
3. calculate difficulty from declared engine features;
4. reject duplicates and out-of-band candidates;
5. emit stable, sorted JSON;
6. reproduce identical output when rerun against the same engine revision.

No level enters the app merely because generation succeeded. The final curve is
played and human-reviewed for clarity, monotonicity, repetition, and frustration.

## 5. Objectives and rewards

V1 may use the objective types declared in the frozen engine contract. An objective
is enabled for a band only when its rules, tutorial treatment, accessibility state,
and completion test exist. Content must not use an unimplemented obstacle, power-up,
or objective simply because its type is reserved.

Rewards acknowledge completion and improvement. Copy never threatens loss,
compares children, labels ability, pressures spending, or makes a streak feel like
an obligation. Hints and retries receive neutral language.

## 6. Copy

Child copy uses short concrete verbs, one instruction at a time, and vocabulary
that can be paired with an icon or spoken label. Parent copy can be denser but
must explain learning and privacy in plain language.

Every string has:

- a stable key;
- audience (`child` or `parent`);
- screen/context;
- default text;
- optional VO asset key;
- interpolation variables with examples;
- translator note where meaning is not literal.

Gameplay logic never branches on displayed text.

## 7. Voice and sound manifest

The VO manifest maps stable keys to locale, speaker, duration, transcript, asset
hash, and fallback text. Missing VO always falls back to visible text/tap guidance.
No runtime synthesis or generated dialogue is part of v1.

Audio review checks pronunciation of numbers and operations, pace for early
learners, neutral wrong-attempt tone, silence/mute paths, and clipping on the
reference devices.

## 8. Content QA and versioning

Every content change runs schema validation, golden-seed snapshots, levelgen,
solver validation, duplicate detection, and the current Gate 1 fuzz suite. A
change in RNG consumption or seed output is breaking: it needs an ADR, a content
version bump, and an explicit migration/replay decision.

Content packs are append-only within a released version. Removing or changing a
seed that may exist in a saved game requires a compatibility plan rather than an
in-place edit.
