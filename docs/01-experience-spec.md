# Experience specification — mobile v1

|                    |                                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| **Status**         | Canonical v1 interaction and accessibility contract                    |
| **Primary device** | Touch-first iOS and Android phones/tablets                             |
| **Related**        | `00-product-spec.md` · `packages/ui/src/tokens.ts` · `ARCHITECTURE.md` |

## 1. Experience principles

1. **A forming thought is not wrong.** Drag previews remain neutral until commit.
2. **Recovery is immediate.** A rejected chain returns to ready without a modal,
   move cost, buzzer, shake, or red failure state.
3. **The accessible design is the default.** Colour is always reinforced by shape
   and glyph; accessibility is not a separate visual theme.
4. **Reading is optional in the child zone.** Every navigable child control has an
   icon, a spoken label, and a stable location.
5. **Celebration never blocks play.** Effects are brief, interruptible, and respect reduced motion.
6. **Parent and child spaces look unmistakably different.** The parent palette and denser information design begin only after the gate.

## 2. Navigation model

The mobile app has two isolated route groups. Child routes cannot navigate into
parent routes except through the parent gate. Parent-zone exit replaces the
stack with Profile Select, never an active child game.

### Child-zone responsibilities — 11 screens

| #   | Screen                | Responsibility                                                                 |
| --- | --------------------- | ------------------------------------------------------------------------------ |
| 1   | Launch / Restore      | Load local data, recover an interrupted write, route without requiring network |
| 2   | Profile Select        | Choose a consented local child profile or open the parent gate                 |
| 3   | Child Home            | Continue the current session, show the next recommended activity               |
| 4   | World / Level Select  | Browse unlocked Tally Sea levels without purchase or social prompts            |
| 5   | Level Brief           | Communicate objective, operation cues, and optional spoken instruction         |
| 6   | Tally Sea Play        | Render board, target, HUD, gestures, preview, pause, and hints                 |
| 7   | Pause                 | Resume, restart with confirmation, adjust audio/accessibility, or leave safely |
| 8   | Level Result          | Show objective outcome, stars, learning feedback, and next action              |
| 9   | Reward Reveal         | Present earned coins/badges briefly and interruptibly                          |
| 10  | Collection / Progress | Show owned rewards and child-readable progress, with no comparative ranking    |
| 11  | Child Settings        | Audio and child-safe accessibility controls only                               |

### Parent-zone responsibilities — 7 screens

| #   | Screen                  | Responsibility                                                           |
| --- | ----------------------- | ------------------------------------------------------------------------ |
| 1   | Parent Gate             | Deliberate adult check before any parent function                        |
| 2   | Parent Sign-in          | Phone entry, OTP verification, and recoverable errors                    |
| 3   | Consent                 | Plain-language consent record before child creation                      |
| 4   | Manage Profiles         | Create/edit consented child profiles using birth year only               |
| 5   | Parent Dashboard        | Weekly progress, strengths, practice areas, and sync freshness           |
| 6   | Controls & Subscription | Learning schedule, audio defaults, purchases, and subscription status    |
| 7   | Privacy Centre          | Consent history, data export, erasure, sign-out, and support information |

## 3. Board interaction

- Input is accepted only during `ready`, `dragging`, and `previewing` engine phases.
- Drag begins on a tile and extends when the pointer first enters a legal adjacent cell.
- Moving back one cell retracts the most recent cell; leaving the board does not commit.
- The UI thread owns pointer sampling and path animation. The engine validates each cell entry.
- The preview shows the ordered expression and current result but does not claim success before release.
- Commit occurs once on release. Duplicate release events are ignored by phase gating.
- During the atomic resolve/refill result, input stays disabled only as long as required for coherent animation and never beyond the configured motion budget.
- Hints identify a possible start or path without auto-committing the answer.

## 4. Visual system

- Every colour, spacing, radius, type size, and duration comes from the Flutter
  `design_system` token contract.
- Operation identity is redundant: colour + shape + glyph.
- Target type is always the largest gameplay type.
- Board tiles are drawn from a pre-rendered atlas in one Flame render surface.
- Parent screens use `parentTeal`, `parentSlate`, and `parentMist`; child screens use the child palette.
- Interactive child elements are at least 64×64 logical pixels including their hit area.
- Focus, selected, disabled, loading, offline, and error states are visually distinct without relying on colour alone.

## 5. Accessibility variants

Every child component and screen is verified under:

- large text at 1.3× and 1.6×;
- reduced motion;
- high contrast;
- thicker outlines and pattern fill for colour-vision support;
- left-handed HUD/gesture affordance placement;
- Lexend dyslexia-font option;
- screen-reader labels and logical traversal order;
- mute, music-only, effects-only, and spoken-output-off combinations.

Reduced motion shortens transitions; it does not remove state feedback. A tap
fallback remains for every audio-led instruction.

## 6. Audio

- Spoken output is scripted and selected from the content manifest; there is no voice input.
- Music, effects, and voice have separate persisted volumes plus a global mute.
- Essential information is never audio-only.
- Wrong attempts use a neutral, quiet response—never a buzzer or scolding line.
- Audio interruption, backgrounding, headphone changes, and mute changes must not corrupt engine state.

## 7. Offline, loading, and errors

The child can launch, restore, play, finish, and start another bundled level with
the network unavailable. Network status is not shown as a blocking child error.
Parent screens may show last-sync time and a retry action. Sync errors keep data
in the outbox and never overwrite newer local progress.

Recoverable errors use a plain explanation and one clear action. Destructive
privacy actions exist only in the parent zone, require explicit confirmation,
and explain whether the action can be undone.

## 8. Experience QA

Each screen is captured and reviewed in its default, offline, loading, empty,
error, large-text, reduced-motion, and high-contrast states. Board interaction is
tested on physical low-end Android hardware for frame pacing, missed cells,
multi-touch rejection, interruption, and rapid consecutive drags.
