/**
 * Rive-on-React-Native spike — throwaway.
 *
 * Answers one question: can `rive-react-native` drive our character animation on
 * our minimum hardware well enough to build on? The output is a verdict, not a
 * feature. See ADR-0001 and spikes/rive-spike/RESULTS.md.
 *
 * Measurement notes
 * -----------------
 * JS FPS is counted here, in JS, via requestAnimationFrame. That is the only
 * thread this code runs on, so it is the only one it can honestly measure.
 *
 * UI (render thread) FPS is NOT measured here. A JS-side counter cannot observe
 * the render thread, and reporting one as though it could would be a fabricated
 * number. It is taken externally from `adb shell dumpsys gfxinfo <pkg>`, which
 * reads the real frame pipeline. Both appear in RESULTS.md, labelled by source.
 *
 * Every log line is prefixed SPIKE| so `adb logcat` can filter cleanly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Rive, { Alignment, Fit, type RiveRef } from 'rive-react-native';

/**
 * Which rig the harness drives.
 *
 * Every rig-specific name lives in this one object. The first version hardcoded
 * Poko's names throughout, which meant the spike could not run against ANY file
 * except one that did not exist yet — so a blocker on unpublished character art
 * was also blocking the question ADR-0001 actually turns on, which is whether the
 * runtime holds frame rate at all. Any rig answers that; only Poko's rig answers
 * whether OUR state machine drives correctly. Separating them costs one object.
 *
 * `source` is either a bundled asset or a URL, matching the two forms
 * `rive-react-native` accepts. A URL avoids committing a binary to the repo,
 * which is the lighter option for a rig we are only borrowing.
 *
 * `attribution` is not decoration. Rive Community files are CC BY 4.0, which
 * requires credit; recording it next to the file it applies to is the only way it
 * survives to whoever reads RESULTS.md later.
 */
type RigDescriptor = {
  readonly label: string;
  readonly source: { readonly resourceName: string } | { readonly url: string };
  /**
   * Used only if the primary source fails to load. A bundled rig makes the APK
   * runnable with no network; the URL is the safety net for a build where the raw
   * resource did not make it in — `expo prebuild` regenerates `android/` and wipes
   * `res/raw`, which is exactly the kind of silent loss worth surviving.
   */
  readonly fallbackUrl?: string;
  /** Some files export several artboards; omitted means the file's default. */
  readonly artboard?: string;
  /**
   * Omitted means "let the file pick", and `rive.play` then REPORTS the name it
   * chose. That is the discovery path for a borrowed file whose state machine name
   * is not documented — guessing it wrong fails the load outright.
   */
  readonly stateMachine?: string;
  /**
   * Input names to probe at startup. `getBooleanState`/`getNumberState` resolve to
   * null for an input that does not exist, so this reports which of a candidate
   * list the file ACTUALLY exposes instead of trusting documentation.
   */
  readonly probeInputs?: readonly string[];
  /** Boolean inputs, one per state. Set true one at a time, others false. */
  readonly states: readonly string[];
  /** Input toggled rapidly as a lip-sync proxy; null if the rig has none. */
  readonly viseme: { readonly name: string; readonly kind: 'boolean' | 'number' } | null;
  /** Required credit for a borrowed rig; empty for our own. */
  readonly attribution: string;
};

/**
 * Poko's own rig. Not yet authored — kept here as the target configuration so the
 * swap back is a one-line change once `assets/poko.riv` exists.
 */
const POKO_RIG: RigDescriptor = {
  label: 'poko',
  source: { resourceName: 'poko' },
  stateMachine: 'State Machine 1',
  states: ['idle-float', 'happy', 'thinking', 'celebrating'],
  viseme: { name: 'mouthOpen', kind: 'boolean' },
  attribution: '',
};

/**
 * A rig with INPUTS, to reach checks 3 and 5.
 *
 * Nothing measured with a borrowed rig describes Poko's rig, and no number taken
 * from one belongs in a performance verdict.
 *
 * The emoji rig settled that the runtime draws and animates, but it exposed no
 * documented inputs, so state switching and the rapid toggle stayed unverified.
 * This one is widely documented as carrying `isChecking`, `isHandsUp` and
 * `numLook` — but documentation is not evidence, so `probeInputs` checks each name
 * against the loaded file and the run reports which ones are real.
 *
 * `stateMachine` is deliberately omitted: naming it wrong fails the load, and
 * `rive.play` reports the name the file actually chose.
 */
const BORROWED_RIG: RigDescriptor = {
  label: 'rive-community-animated-login',
  // Bundled: android/app/src/main/res/raw/login_teddy.riv, copied from
  // assets/login_teddy.riv (the canonical copy, with its licence beside it).
  source: { resourceName: 'login_teddy' },
  fallbackUrl:
    'https://public.rive.app/community/runtime-files/2244-4463-animated-login-screen.riv',
  // Discovered from `rive.play`, not guessed: the run reported "Login Machine".
  stateMachine: 'Login Machine',
  // Confirmed present by the probe: both booleans read back false on a fresh load.
  states: ['isChecking', 'isHandsUp'],
  // Confirmed present as a NUMBER, so the rapid toggle drives 0/100 rather than a bool.
  viseme: { name: 'numLook', kind: 'number' },
  probeInputs: ['isChecking', 'isHandsUp', 'numLook', 'trigSuccess', 'trigFail'],
  attribution: 'Rive Community, CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
};

/** Settled that the emulator renders and animates Rive; no usable inputs. */
const EMOJI_RIG: RigDescriptor = {
  label: 'rive-animated-emojis',
  source: { url: 'https://static.rive.app/rivs/rives_animated_emojis.riv' },
  artboard: 'Emoji_package',
  stateMachine: 'State Machine 1',
  states: [],
  viseme: null,
  attribution: 'Rive (static.rive.app), CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
};
void EMOJI_RIG;

/**
 * First borrowed rig tried, kept for the record.
 *
 * It loaded and drew, but its stage was byte-identical across five frames over
 * 3.5s — it is a REDUCED-MOTION demo, so a still frame is plausibly what it is
 * demonstrating, and it cannot distinguish "the runtime animates" from "the
 * runtime drew once and stopped". Emulator animation scales were confirmed normal
 * (window/transition = 1.0), so the stillness was not the OS suppressing motion.
 * A poor instrument for the question, not a Rive failure.
 */
const FIRST_BORROWED_RIG: RigDescriptor = {
  label: 'rive-accessibility-reduced-motion',
  source: { url: 'https://static.rive.app/rivs/accessibility_reduced_motion.riv' },
  stateMachine: 'State Machine 1',
  states: [],
  viseme: null,
  attribution: 'Rive (static.rive.app), CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
};
void FIRST_BORROWED_RIG;

const RIG: RigDescriptor = BORROWED_RIG;

// Referenced so the target configuration cannot rot unnoticed while it is unused.
void POKO_RIG;

type RigState = string;

const VISEME_INTERVAL_MS = 80;

/** Settling time before reading an input back; see `state.readback`. */
const READBACK_SETTLE_MS = 250;

/** Number-input rigs get an on/off pair rather than a boolean. */
const VISEME_NUMBER_ON = 100;
const VISEME_NUMBER_OFF = 0;

function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(`SPIKE|${JSON.stringify({ t: Date.now(), event, ...data })}`);
}

/**
 * Renders an unknown thrown/emitted value as something readable.
 *
 * `String(error)` on a plain object yields `[object Object]`, which is what the
 * first emulator run produced for every `rive.error` — the one line that would
 * have told us what the Rive runtime objected to, and it said nothing. Rive
 * reports through React Native's synthetic event shape, so the useful payload is
 * nested under `nativeEvent`.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'object' && error !== null) {
    // Unwrap the RN synthetic event; fall back to the object itself.
    const payload =
      'nativeEvent' in error ? (error as { nativeEvent: unknown }).nativeEvent : error;
    try {
      const json = JSON.stringify(payload);
      // JSON.stringify returns undefined for functions/symbols.
      if (json !== undefined && json !== '{}') return json;
    } catch {
      // Circular structure — fall through to the tag below.
    }
    return Object.prototype.toString.call(payload);
  }

  return String(error);
}

/** One rig instance. `index` distinguishes instances in the stress case. */
function Rig({ index, state }: { index: number; state: RigState }) {
  const riveRef = useRef<RiveRef>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const source = usingFallback && RIG.fallbackUrl ? { url: RIG.fallbackUrl } : RIG.source;

  // Drive the named state from React state, so a switch is a genuine
  // React render -> native bridge hop, which is what the product would do.
  useEffect(() => {
    const machine = RIG.stateMachine;
    if (machine) {
      for (const candidate of RIG.states) {
        try {
          riveRef.current?.setInputState(machine, candidate, candidate === state);
        } catch (error) {
          log('setInputState.error', { index, candidate, message: describeError(error) });
        }
      }
    }
    log('state.applied', { index, state });

    /**
     * Read the inputs back after setting them.
     *
     * "setInputState did not throw" is not evidence the state changed — the call
     * is fire-and-forget across the bridge, and a wrong input name is silently
     * accepted. Reading the value back is the difference between check 3 being
     * verified and merely being attempted.
     */
    if (machine && RIG.states.length > 0 && index === 0) {
      void (async () => {
        // Wait before reading. `setInputState` is fire-and-forget across the
        // bridge and the getters are async, so an immediate read returns the
        // PREVIOUS value — measured, not assumed: without this delay every
        // readback lagged the state by exactly one transition, which looks like a
        // failure and is actually a race in the instrument.
        await new Promise((resolve) => setTimeout(resolve, READBACK_SETTLE_MS));

        const readback: Record<string, boolean | null> = {};
        for (const candidate of RIG.states) {
          readback[candidate] = (await riveRef.current?.getBooleanState(candidate)) ?? null;
        }
        const expected = Object.fromEntries(RIG.states.map((s) => [s, s === state]));
        const matches = RIG.states.every((s) => readback[s] === expected[s]);
        log('state.readback', { index, state, readback, expected, matches });
      })();
    }
  }, [state, index]);

  /**
   * Ask the loaded file which of the candidate inputs exist.
   *
   * Both getters resolve to null for an unknown input, so a non-null answer is
   * positive evidence the input is really there — the difference between "the docs
   * say isChecking" and "this file has isChecking". Runs once, after a short delay
   * so the URL fetch and artboard bind have completed.
   */
  useEffect(() => {
    const names = RIG.probeInputs;
    if (!names || names.length === 0 || index !== 0) return;

    const timer = setTimeout(() => {
      void (async () => {
        for (const name of names) {
          try {
            const asBoolean = await riveRef.current?.getBooleanState(name);
            const asNumber = await riveRef.current?.getNumberState(name);
            const kind =
              asBoolean !== null && asBoolean !== undefined
                ? 'boolean'
                : asNumber !== null && asNumber !== undefined
                  ? 'number'
                  : 'absent';
            log('probe.input', { name, kind, boolean: asBoolean ?? null, number: asNumber ?? null });
          } catch (error) {
            log('probe.error', { name, message: describeError(error) });
          }
        }
        log('probe.done', { probed: names.length });
      })();
    }, 4000);

    return () => clearTimeout(timer);
  }, [index]);

  // Viseme proxy: toggle one input rapidly for the whole run.
  useEffect(() => {
    const viseme = RIG.viseme;
    if (!viseme) {
      // Said once, not silently skipped: a rig with no rapid-toggle input leaves
      // check 5 unverified, and that must be visible in the log, not inferred
      // from an absence of viseme lines.
      log('viseme.skipped', { index, reason: 'rig exposes no viseme input' });
      return;
    }

    let open = false;
    const timer = setInterval(() => {
      open = !open;
      try {
        const value =
          viseme.kind === 'boolean' ? open : open ? VISEME_NUMBER_ON : VISEME_NUMBER_OFF;
        if (RIG.stateMachine) riveRef.current?.setInputState(RIG.stateMachine, viseme.name, value);
      } catch (error) {
        log('viseme.error', { index, message: describeError(error) });
      }
    }, VISEME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [index]);

  return (
    <Rive
      ref={riveRef}
      {...source}
      {...(RIG.artboard ? { artboardName: RIG.artboard } : {})}
      {...(RIG.stateMachine ? { stateMachineName: RIG.stateMachine } : {})}
      fit={Fit.Contain}
      alignment={Alignment.Center}
      autoplay
      style={styles.rig}
      onError={(error: unknown) => {
        const message = describeError(error);
        log('rive.error', { index, message, usingFallback });
        // Only a missing or unreadable FILE justifies switching source. This rig
        // emits a DataBindingError on every successful load, and falling back on
        // that would trade a working bundled file for a network fetch every run.
        if (!usingFallback && RIG.fallbackUrl && /FileNotFound|not found|Unable|Malformed/i.test(message)) {
          log('rive.fallback', { index, reason: message, to: RIG.fallbackUrl });
          setUsingFallback(true);
        }
      }}
      onPlay={(animation: unknown) => log('rive.play', { index, animation: describeError(animation) })}
    />
  );
}

export default function App() {
  const [state, setState] = useState<RigState>(RIG.states[0] ?? '');
  const [stress, setStress] = useState(false);
  const [jsFps, setJsFps] = useState(0);

  // JS-thread frame counter, sampled every second. The 60s run is aggregated
  // from these samples externally.
  useEffect(() => {
    let frames = 0;
    let last = Date.now();
    let raf = 0;

    const tick = () => {
      frames += 1;
      const now = Date.now();
      if (now - last >= 1000) {
        const fps = (frames * 1000) / (now - last);
        setJsFps(fps);
        log('js.fps', { fps: Number(fps.toFixed(2)), rigs: stress ? 3 : 1 });
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stress]);

  // Log the rig under test at startup. Which file produced a reading is exactly
  // the detail that goes missing between a run and the write-up, and a borrowed
  // rig's numbers must never be filed as if they came from Poko's.
  useEffect(() => {
    log('app.ready', {
      rig: RIG.label,
      source: RIG.source,
      stateMachine: RIG.stateMachine,
      states: RIG.states,
      viseme: RIG.viseme,
      attribution: RIG.attribution,
    });
  }, []);

  // Tap -> state change. Both timestamps are logged so input-to-animation
  // latency is a subtraction, not an impression.
  const onTapCharacter = useCallback(() => {
    const tappedAt = Date.now();
    if (RIG.states.length === 0) {
      // Recorded rather than ignored: with no declared states there is nothing to
      // switch, and check 3 is unverified for this rig — which the log must say.
      log('tap.noStates', { tappedAt, rig: RIG.label });
      return;
    }
    const next = RIG.states[(RIG.states.indexOf(state) + 1) % RIG.states.length] as RigState;
    log('tap', { tappedAt, from: state, to: next });
    setState(next);
  }, [state]);

  const rigCount = stress ? 3 : 1;

  return (
    <View style={styles.root}>
      <View style={styles.overlay}>
        <Text style={styles.metric}>JS {jsFps.toFixed(1)} fps</Text>
        <Text style={styles.metric}>
          {rigCount} rig{rigCount > 1 ? 's' : ''} · {state}
        </Text>
        <Text style={styles.hint}>UI fps read externally via adb dumpsys gfxinfo</Text>
      </View>

      <Pressable onPress={onTapCharacter} style={styles.stage} testID="character">
        <View style={styles.row}>
          {Array.from({ length: rigCount }, (_, index) => (
            <Rig key={index} index={index} state={state} />
          ))}
        </View>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          testID="stress"
          onPress={() => {
            setStress((current) => !current);
            log('stress.toggle', { rigs: stress ? 1 : 3 });
          }}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>{stress ? 'Back to 1 rig' : 'Stress: 3 rigs'}</Text>
        </Pressable>

        <Pressable
          testID="switch20"
          onPress={async () => {
            // Scripted burst: 20 state switches, for the dropped-frame count.
            log('burst.start', { switches: 20 });
            for (let i = 0; i < 20; i += 1) {
              if (RIG.states.length === 0) break;
              setState(RIG.states[i % RIG.states.length] as RigState);
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
            log('burst.end', {});
          }}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>20 rapid switches</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1B2A' },
  overlay: { paddingTop: 48, paddingHorizontal: 16 },
  metric: { color: '#8FE3FF', fontSize: 18, fontVariant: ['tabular-nums'] },
  hint: { color: '#5C7A94', fontSize: 12, marginTop: 4 },
  stage: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  rig: { width: 160, height: 220 },
  controls: { flexDirection: 'row', gap: 12, padding: 16 },
  button: { flex: 1, backgroundColor: '#1E3A52', padding: 16, borderRadius: 12 },
  buttonLabel: { color: '#E8F4FF', textAlign: 'center', fontSize: 15 },
});
