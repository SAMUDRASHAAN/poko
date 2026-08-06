# Rive-on-React-Native spike — results

|             |                                                                     |
| ----------- | ------------------------------------------------------------------- |
| **Status**  | Functional pass run on emulator. **No performance verdict.**        |
| **Purpose** | Settle the contingency in ADR-0001                                  |
| **Updated** | 2026-08-06                                                          |

> **Nothing here is an estimate.** Every row is a reading from a run that actually
> happened, or is marked not verified with the reason.

---

## Verdict

**Not reached — and cannot be, from this session.** Performance is the question
ADR-0001 turns on, and performance was not measured. What follows is functional
evidence only.

---

## Functional pass (emulator)

> ⚠️ **FUNCTIONAL ONLY — NOT A PERFORMANCE RESULT.**
> No FPS, latency or memory figure from this section belongs in a verdict. The
> emulator runs on a host GPU through a translation layer, on a different CPU
> architecture, with none of the thermal or memory pressure that decides the real
> answer. **Performance measurement remains pending on physical hardware.**

Target: `emulator-5554`, `sdk_gphone16k_arm64`, Android 16 (API 36), GPU host
acceleration, **debug** build.

| #   | Check                                   | Result             | Evidence                                                                                              |
| --- | --------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | App launches                            | ✅ **yes**         | `BUILD SUCCESSFUL in 21m 52s`; installed `com.anonymous.rivespike`; pid 9242; UI renders (screenshot)   |
| 2   | `poko.riv` loads                        | ❌ **no**          | `RiveReactNativeView.handleFileNotFound` — **the rig file does not exist**, see Blockers                |
| 3   | Four states switch from React state     | ⚠️ **partial**     | React side verified: `tap → thinking → celebrating → idle-float`, `state.applied` ~3 ms after each tap  |
| 4   | Idle loop runs continuously             | ⛔ **not verified** | requires the rig                                                                                       |
| 5   | `mouthOpen` 80 ms toggle works          | ⚠️ **partial**     | interval runs with **zero** `viseme.error`; visual effect unverifiable without the rig                 |
| 6   | 3-rig stress mode renders               | ⚠️ **partial**     | three instances mount — `state.applied` for `index` 0, 1, 2; `js.fps` reports `rigs:3`. Nothing drawn.  |
| 7   | Tap logging emits `SPIKE\|` lines        | ✅ **yes**         | `{"event":"tap","from":"thinking","to":"celebrating"}` captured via `adb logcat ReactNativeJS:V`        |
| 8   | 20-switch burst completes without crash | ✅ **yes**         | `burst.start` → `burst.end` in 3.7 s, 61 `state.applied`, **pid 9242 unchanged** (no crash or restart)  |

**Score: 3 confirmed, 3 partial, 1 blocked, 1 negative-but-explained.**

### The one negative is not a Rive failure

Check 2 fails because `assets/poko.riv` is absent. The native runtime resolved the
prop, attempted the load, and reported the miss through its own error path:

```
E RiveReactNativeView.handleFileNotFound(RiveReactNativeView.kt:959)
  RiveReactNativeView.reloadIfNeeded(RiveReactNativeView.kt:715)
LOG SPIKE|{"event":"rive.error","index":0,...}
```

That is correct behaviour for a missing asset, and it is quietly good news: the
native module **linked, initialised, received props and surfaced an error to JS**.

### The blank stage is not the emulator failure mode you warned about

The brief flagged blank-canvas as a known emulator limitation for native
renderers. That is **not** what happened here. The stage is empty because the file
is missing, evidenced by `handleFileNotFound`. Whether this emulator's translation
layer can render Rive **remains untested** — with no rig there is nothing to draw,
so the two causes cannot be told apart. Neither "emulator renders Rive fine" nor
"emulator cannot render Rive" is supported by this run.

---

## The strongest result: it builds

`rive-react-native@9.8.5` **compiled and linked against Expo 57 / RN 0.86** with
NDK 27.1.12297006, and Expo autolinking picked it up with no manual configuration.

This matters because it was the likeliest early failure. Rive's RN runtime is the
less mature of its two, and RN 0.86 with the bridgeless architecture is new. A
version incompatibility would have surfaced as a compile or link error and it did
not. Toolchain risk is materially lower than before this session.

| Step                                | Outcome                                            |
| ----------------------------------- | -------------------------------------------------- |
| `npm install` (Expo 57, RN 0.86)    | ✅ exit 0                                           |
| `rive-react-native`                 | ✅ 9.8.5                                            |
| `expo prebuild` (android)           | ✅ autolinking clean                                |
| Gradle 9.3.1 distribution           | ✅ after one network timeout, retry succeeded       |
| NDK 27.1.12297006                   | ✅ auto-installed                                   |
| `app:assembleDebug`                 | ✅ **BUILD SUCCESSFUL in 21m 52s**                  |
| Install + launch on emulator        | ✅ pid 9242                                         |

Fixes needed along the way, both environmental rather than Rive-related:

- `ANDROID_HOME` is unset on this machine — wrote `android/local.properties`.
- The Gradle distribution download timed out once; a plain retry cleared it.

---

## Deliberately excluded

The app printed `js.fps ≈ 30` throughout. **That number is excluded from every
conclusion.** It is a debug build under a Metro dev server on an emulator, and it
measures the JS thread only. It is recorded here solely so nobody later mistakes
its absence for an oversight.

---

## Blockers

**No `.riv` rig exists.** This is the single reason checks 2–6 are not green.
`App.tsx` expects `assets/poko.riv` exporting:

- state machine `State Machine 1`
- four boolean inputs: `idle-float`, `happy`, `thinking`, `celebrating`
- one boolean input: `mouthOpen`

`.riv` is a proprietary binary authored in the Rive editor and cannot be
synthesised here. Supply the file, or approve a specific community rig and its
licence.

---

## Environment

### Emulator (this run — functional only)

| | |
| --- | --- |
| AVD | `Pixel_9` → `emulator-5554` |
| Image | `sdk_gphone16k_arm64`, Android 16 (API 36) |
| GPU | host acceleration |
| Build | debug, `-PreactNativeArchitectures=arm64-v8a` |
| Screen | 1080×2424 |

### Physical device (for the performance session — NOT used here)

| | |
| --- | --- |
| Model | OnePlus **CPH2619** (`blair`), serial `869273bf` |
| Android | 16 (SDK 36) |
| SoC | **SM6375** (Snapdragon 695) |
| RAM | **7.2 GiB** |
| Display | 1080×2400, 120 Hz — **forced to 60 Hz**, verified `mActiveModeId=2`, `fps=60.000004` |

⚠️ **Not the reference device.** The brief specifies low-end, 3–4 GB, ~Rs.10k
class; this is an 8 GB-class mid-ranger on a faster SoC. When the performance
session runs: **a FAIL is conclusive**, **a PASS is provisional** and does not
discharge ADR-0001's contingency by itself.

---

## Method note — why the app reports only JS FPS

`App.tsx` counts JS-thread frames via `requestAnimationFrame`; that is the only
thread it runs on, so it is the only one it can honestly measure. UI (render
thread) FPS will be read externally from `adb shell dumpsys gfxinfo`, which
observes the real frame pipeline. Reporting a JS counter as "UI FPS" would put a
fabricated number in the document meant to settle a stack decision.

**Known defect in the harness:** `rive.error` currently logs `[object Object]`
because the handler stringifies the error object directly. Serialise the payload
before the physical-device session, or a real Rive error will be unreadable.

---

## To resume

1. Supply `assets/poko.riv` (or approve a community rig).
2. Re-run the emulator pass — checks 2–6 should then resolve, including whether
   the emulator's translation layer renders Rive at all.
3. Run the performance session on physical hardware, release build, ideally on the
   actual low-end reference device.

Reproduce from a fresh clone:

```bash
cd spikes/rive-spike
npm install
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties   # after first prebuild
npx expo run:android
```
