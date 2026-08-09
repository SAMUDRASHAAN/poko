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

/** Must match the state machine exported in the .riv file. */
const STATE_MACHINE = 'State Machine 1';

/** Named states the rig exposes, switched from React state. */
const STATES = ['idle-float', 'happy', 'thinking', 'celebrating'] as const;
type RigState = (typeof STATES)[number];

/** Boolean input driven rapidly as a lip-sync proxy. */
const VISEME_INPUT = 'mouthOpen';
const VISEME_INTERVAL_MS = 80;

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

  // Drive the named state from React state, so a switch is a genuine
  // React render -> native bridge hop, which is what the product would do.
  useEffect(() => {
    for (const candidate of STATES) {
      try {
        riveRef.current?.setInputState(STATE_MACHINE, candidate, candidate === state);
      } catch (error) {
        log('setInputState.error', { index, candidate, message: describeError(error) });
      }
    }
    log('state.applied', { index, state });
  }, [state, index]);

  // Viseme proxy: toggle a boolean input rapidly for the whole run.
  useEffect(() => {
    let open = false;
    const timer = setInterval(() => {
      open = !open;
      try {
        riveRef.current?.setInputState(STATE_MACHINE, VISEME_INPUT, open);
      } catch (error) {
        log('viseme.error', { index, message: describeError(error) });
      }
    }, VISEME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [index]);

  return (
    <Rive
      ref={riveRef}
      resourceName="poko"
      stateMachineName={STATE_MACHINE}
      fit={Fit.Contain}
      alignment={Alignment.Center}
      autoplay
      style={styles.rig}
      onError={(error: unknown) => log('rive.error', { index, message: describeError(error) })}
      onPlay={(animation: unknown) => log('rive.play', { index, animation: describeError(animation) })}
    />
  );
}

export default function App() {
  const [state, setState] = useState<RigState>('idle-float');
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

  useEffect(() => {
    log('app.ready', {});
  }, []);

  // Tap -> state change. Both timestamps are logged so input-to-animation
  // latency is a subtraction, not an impression.
  const onTapCharacter = useCallback(() => {
    const tappedAt = Date.now();
    const next = STATES[(STATES.indexOf(state) + 1) % STATES.length] as RigState;
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
              setState(STATES[i % STATES.length] as RigState);
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
