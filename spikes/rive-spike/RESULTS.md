# Rive-on-React-Native spike — results

|             |                                                                     |
| ----------- | ------------------------------------------------------------------- |
| **Status**  | Provisional physical pass on non-reference hardware. **No ADR verdict.** |
| **Purpose** | Settle the contingency in ADR-0001                                  |
| **Updated** | 2026-08-13                                                          |

> **Nothing here is an estimate.** Every row is a reading from a run that actually
> happened, or is marked not verified with the reason.

---

## Verdict

**Not reached.** Performance is the question ADR-0001 turns on. Both the legacy and
current new-architecture runtimes now build, render, accept input, and survive the
stress harness on physical hardware. That phone is an 8 GB Snapdragon 695
mid-ranger rather than the required 3–4 GB, ~Rs.10k reference device. A failure
here would have been conclusive; the observed passes are provisional and do not
discharge the ADR's low-end-device contingency.

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

SPIKE|{"event":"rive.error","index":0,"message":
  "{\"type\":\"FileNotFound\",\"message\":\"File resource not found.
    You must provide correct url or resourceName!\"}"}
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

> **Resolved on 2026-08-10.** It renders, and it animates. See the run below.

---

## Run 2 (2026-08-10) — borrowed rig, emulator

> ⚠️ **STILL FUNCTIONAL ONLY, AND STILL NOT POKO'S RIG.**
> This run answers "does the runtime draw and animate here". It says nothing about
> Poko's state machine, and nothing about performance.

`poko.riv` still does not exist. To stop an unwritten art asset from also blocking
the question ADR-0001 turns on, the harness was made rig-agnostic — every
rig-specific name now sits in one `RigDescriptor` — and pointed at a borrowed file.

**Rig under test:** `rives_animated_emojis.riv`, artboard `Emoji_package`, state
machine `State Machine 1`, loaded **by URL** from `static.rive.app` so no borrowed
binary enters the repo.
**Licence:** Rive Community files are CC BY 4.0. Credit: *Rive (static.rive.app),
CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/*.

### The emulator renders Rive, and animates it

| Question                | Result             | Evidence                                                                        |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------- |
| File loads over URL     | ✅ **yes**         | `rive.play` for `State Machine 1`; **no** `FileNotFound`                          |
| Anything is drawn       | ✅ **yes**         | screenshot shows the rig on stage                                                 |
| It animates             | ✅ **yes**         | **5 of 5** consecutive frames differ, 50,530–73,465 px changed per frame           |
| Three instances draw    | ✅ **yes**         | `rive.play` for `index` 0, 1, 2; all three visible; pid 4253 unchanged             |

Motion was measured on the **stage region only** (x 160–920, y 970–1535). Hashing
the whole screen would have been worthless — the FPS counter in the overlay changes
every second and would report "animating" on a completely frozen rig.

That trap caught the first rig tried. `accessibility_reduced_motion.riv` loaded and
drew, but its stage was **byte-identical across 5 frames over 3.5 s**. It is a
reduced-motion demo, so a still frame is plausibly the point; either way it cannot
tell "the runtime animates" from "the runtime drew once and stopped". Emulator
animation scales were checked and are normal (`window` and `transition` = 1.0), so
the stillness was not the OS suppressing motion. Poor instrument, not a Rive fault.

### One non-fatal error, recorded rather than swallowed

```
SPIKE|{"event":"rive.error","index":0,
  "message":"{\"type\":\"DataBindingError\",
    \"message\":\"No default ViewModel found for artboard Emoji_package.\"}"}
```

This rig expects a data-binding ViewModel the harness does not supply. It did
**not** prevent loading, drawing or animating — all four rows above hold with this
error present. It is a property of the borrowed file, not of `rive-react-native`.

---

## Run 3 (2026-08-10) — a rig with inputs, closing checks 3 and 5

> ⚠️ **STILL FUNCTIONAL ONLY, AND STILL NOT POKO'S RIG.**

**Rig:** Rive Community "animated login screen" (the teddy), artboard `Teddy`, by URL.
**Licence:** CC BY 4.0 — *Rive Community, https://creativecommons.org/licenses/by/4.0/*.

### Names were discovered, not assumed

The state machine name was **not** configured. Naming it wrong fails the load, so the
harness omitted it and read the name back from `rive.play`: **`Login Machine`**.

Input names were then **probed** rather than trusted. `getBooleanState` and
`getNumberState` resolve to null for an input that does not exist, which turns
"the docs say `isChecking`" into "this file has `isChecking`":

| Probed        | Result                | Reading on a fresh load |
| ------------- | --------------------- | ----------------------- |
| `isChecking`  | ✅ **boolean**         | `false`                 |
| `isHandsUp`   | ✅ **boolean**         | `false`                 |
| `numLook`     | ✅ **number**          | `0`                     |
| `trigSuccess` | — not boolean/number  | `null`                  |
| `trigFail`    | — not boolean/number  | `null`                  |

**The last two rows are not evidence of absence.** Triggers are a third input kind,
fired via `fireState` with no getter, so these probes cannot see them. Documentation
describes both as triggers, which is consistent with what was measured; the probe
simply cannot confirm or deny it.

### Check 3 — four states switch from React state ✅ **verified**

Not "no error was thrown". `setInputState` is fire-and-forget across the bridge and
silently accepts an unknown input name, so the harness sets the input, waits, reads
it back, and compares against what was expected:

| Condition                                  | Matches | Mismatches |
| ------------------------------------------ | ------: | ---------: |
| Deliberate switches, 2.5 s apart            |   **7** |      **0** |
| During the 20-switch burst (150 ms apart)   |       1 |         18 |

Every mismatch is inside the burst, and the cause is the instrument: the readback
settles for 250 ms while the burst switches every 150 ms, so it necessarily reads a
state that has already moved on. Outside the burst the agreement is exact.

**Confirmed visually too:** with `isHandsUp` set, the bear is drawn covering its
eyes and the HUD reads `isHandsUp`. The input set is the pose rendered.

### The readback needed a settle, and that is itself a finding

The first version read the inputs back immediately and reported `matches:false`
every time — while showing, in each case, *exactly the previous state*. The values
were correct; the read was racing the write. A 250 ms settle turned 0/7 into 7/7.

Worth recording because the failing version looked exactly like a broken state
machine, and "the state machine does not apply inputs" is precisely the wrong
conclusion to carry into an ADR.

### Check 5 — rapid input toggle ✅ **runs clean**

`numLook` driven 0 ↔ 100 every 80 ms for the whole session: **0** `viseme.error`,
**0** `setInputState.error`. The input is confirmed real by the probe, so this is no
longer a call into the void as it was when the rig was missing.

### Check 8 — 20-switch burst ✅ **no crash**

`burst.start` → `burst.end` in **3.3 s**, 26 `state.applied`, pid **5748 unchanged**.

### What this run does NOT establish

| Check                             | Status                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 3 — four states switch from React | ✅ **verified in Run 3** on a borrowed rig — two boolean states, not Poko's four                          |
| 5 — 80 ms input toggle            | ✅ **runs clean in Run 3** on `numLook`, not Poko's `mouthOpen`                                           |
| Poko's own state machine          | ⛔ **unverified and unverifiable** until `assets/poko.riv` exists — a borrowed rig cannot stand in for it |
| Any performance figure            | ⛔ **not measured** — emulator, debug build, no reference device                                          |

`js.fps` read **46.9 with three rigs** against ~20 with one. That is not a
performance result and is not treated as one — a load figure that *improves* under
more load is a good demonstration of why this counter was excluded from every
conclusion in the first place.

---

## Run 4 (2026-08-13) — physical release build, provisional performance pass

> ⚠️ **PHYSICAL, BUT NOT THE REFERENCE DEVICE.**
> This run can conclusively fail the stack, but it cannot conclusively pass it.

The same borrowed input-bearing rig ran in an ARM64 **release** APK on a OnePlus
CPH2619 (`SM6375`, Snapdragon 695, 7.2 GiB RAM), with the 120 Hz panel forced to
60 Hz and verified as active mode 2 at 60.000004 Hz. The app rendered three Rive
instances while each drove `numLook` 0 ↔ 100 every 80 ms.

Android's own `dumpsys gfxinfo` summary supplied the render-thread measurements:

| Load | Frames | Jank | p50 | p90 | p95 | p99 | Worst observed bucket |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Three rigs, sustained 45 s | 2,701 | **0 / 0.00%** | 5 ms | 5 ms | 6 ms | 8 ms | 13 ms |
| Three rigs + 20-switch burst | 742 | **0 / 0.00%** | 5 ms | 6 ms | 7 ms | 10 ms | 14 ms |

The burst completed in 3.3 s, the final readback matched `isHandsUp`, and PID
`14135` was unchanged. Android reported zero missed vsyncs, zero slow UI-thread
frames, zero slow draw-command frames and zero missed frame deadlines in both
captures. At the end of the run the process used 141,289 KiB total PSS and 60,116
KiB graphics PSS. Battery temperature was 34.4 °C, effectively unchanged from the
34.3 °C sustained-run reading.

### Compatibility warning found on the physical run

`rive-react-native@9.8.5` is the latest release of the **legacy** runtime. Under
Expo 57 / React Native 0.86 bridgeless mode it repeatedly calls the deprecated
`RCTEventEmitter` path from `RiveReactNativeView.onPlay`, producing non-fatal
`Unhandled SoftException` entries:

```text
getJSModule(RCTEventEmitter) is not recommended in the new architecture and
will stop working with interop disabled. Please use UIManagerHelper.getEventDispatcher instead
```

The app kept rendering at the figures above and produced no fatal exception,
`viseme.error`, or `setInputState.error`, but this is not a production-clean
integration. Rive now publishes its new-architecture runtime separately as
`@rive-app/react-native` (current stable: 0.4.19); the dependency decision should
evaluate that package instead of promoting the legacy spike dependency unchanged.

### Run 4 conclusion

**Provisional physical pass, final verdict still open.** The runtime drew three
simultaneous rigs and handled state/input stress comfortably on this device. The
current new-architecture package comparison is recorded below; the actual low-end
device result remains open.

---

## Run 5 (2026-08-13) — current Nitro runtime, physical release build

> ⚠️ **PHYSICAL AND PRODUCTION-RELEVANT, BUT STILL NOT THE REFERENCE DEVICE.**
> This closes the new-architecture compatibility check, not the ADR verdict.

The same borrowed teddy, state machine, two boolean inputs, 80 ms `numLook`
changes, three-rig load, and 20-switch burst were repeated in an isolated ARM64
release scaffold using Expo 57.0.12, React Native 0.86.2,
`@rive-app/react-native@0.4.19`, and `react-native-nitro-modules@0.35.10`.

The scaffold was deliberately kept outside the repository. No package manifest or
lockfile was changed before the phase owner has approved the dependency through
the ADR/serialized dependency path. TypeScript passed, Expo prebuild autolinked
the Nitro module, and `app:assembleRelease` succeeded in 3m 55s with NDK
27.0.12077973; the incremental rebuild after the readback fix took 5s.

| Load | Frames | Jank | p50 | p90 | p95 | p99 | Worst observed bucket |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Three rigs, sustained 45 s | 2,714 | **0 / 0.00%** | 5 ms | 16 ms | 17 ms | 18 ms | 21 ms |
| Three rigs + 20-switch burst | 748 | **0 / 0.00%** | 5 ms | 6 ms | 8 ms | 11 ms | 13 ms |

Both captures reported zero missed vsyncs, zero slow UI-thread frames, zero slow
draw-command frames, and zero missed frame deadlines. PID `21974` remained stable.
All three rigs rendered, every settled boolean readback matched, the 20-switch
burst finished, and the JS counter remained near 60 fps (observed tail range
58.89–59.96).

There were **zero** fatal exceptions, **zero** `Unhandled SoftException` entries,
and **zero** harness `rive.error`, `state.error`, `readback.error`, or
`viseme.error` events. Startup did emit the generic React Native reflection
fallback warning `Could not find generated setter for class
com.rive.RiveViewManager`; the same warning was emitted for multiple Expo and
React Native view managers, occurred only during manager discovery, and did not
repeat during input or render stress.

At the end of the run the Nitro process used 146,246 KiB total PSS and 65,052 KiB
graphics PSS. Against Run 4 that is +4,957 KiB (+3.5%) total and +4,936 KiB (+8.2%)
graphics. Battery temperature was 34.7 °C.

### Run 5 conclusion

**The Nitro runtime is the production-compatible candidate, conditional on the
reference-device result.** It removes the legacy runtime's deprecated event path
and passed every functional/stability check here. It also has materially less
frame-time margin in the sustained three-rig capture: p90 reached 16 ms and p95
17 ms, versus 5 ms and 6 ms for the legacy package. Zero jank on this mid-range
phone is encouraging, but those percentiles are too close to a 60 Hz frame budget
to infer a low-end pass. Do not promote either dependency until Run 5 is repeated
on the specified 3–4 GB device and ADR-0001 records the decision.

---

## Both native runtimes build

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
| Incremental rebuild (after fix)     | ✅ **16s** — cold build cost does not recur         |

Run 5 separately establishes that the current Nitro replacement also compiles,
autolinks, installs, and launches under the same Expo/RN generation. It is not
represented in the repository's manifests yet; that remains an explicit ADR and
phase-owner decision.

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

> **Narrowed on 2026-08-10.** This section described one blocker; it is two, with
> very different costs. A borrowed rig has since cleared the runtime half — the
> emulator renders and animates Rive — so what remains below is scoped to Poko's
> own state machine, plus the hardware the verdict actually needs.
>
> | Blocker | Blocks | Owner |
> | --- | --- | --- |
> | `assets/poko.riv` does not exist | checks 3 and 5 — **our** state machine | design |
> | No reference device (~Rs.10k, 3–4 GB class) | the final performance verdict, and so ADR-0001 | procurement |
>
> Those remaining inputs need design/procurement action. The current runtime
> evaluation is complete on the connected phone, and the physical harness is
> ready to repeat on the reference device.

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

### Physical device (used for Runs 4 and 5 — provisional only)

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

**Harness defect — found and fixed.** `rive.error` originally logged
`[object Object]`: the handler called `String(error)` on a plain object, so the one
line that should have explained what Rive objected to said nothing. Rive reports
through React Native's synthetic event shape, so the payload sits under
`nativeEvent`. `describeError()` now unwraps that and serialises it, handling
`Error` instances, circular structures and primitives.

Verified by rebuild — same condition, same run, readable output:

| | |
| --- | --- |
| before | `"[object Object]"` |
| after | `{"type":"FileNotFound","message":"File resource not found. You must provide correct url or resourceName!"}` |

The fixed message also independently confirms the diagnosis in check 2: Rive is
reporting a missing asset, not a rendering or runtime defect.

---

## To resume

1. Obtain the actual 3–4 GB, ~Rs.10k reference Android device and repeat Run 5;
   repeat Run 4 as the baseline comparison if time permits.
2. Supply `assets/poko.riv` to verify Poko's own state machine and `mouthOpen`
   input. The borrowed rig is sufficient for runtime performance, not content
   correctness.
3. Record the final runtime/dependency decision in ADR-0001, then let the phase
   owner apply the serialized manifest and lockfile change.

Reproduce from a fresh clone:

```bash
cd spikes/rive-spike
npm install
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties   # after first prebuild
npx expo run:android
```
