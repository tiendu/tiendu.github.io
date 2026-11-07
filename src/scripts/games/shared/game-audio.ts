import { effects, type GameSound } from "./sound-effects";


/** Small synthesized effects; audio remains optional and never blocks gameplay. */
export function createGameAudio(storageKey: string) {
  let enabled = false;
  try { enabled = localStorage.getItem(storageKey) === "on"; } catch { /* Optional storage. */ }
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let resuming: Promise<void> | undefined;
  let generation = 0;
  const sources = new Set<AudioScheduledSourceNode>();
  const stop = () => {
    generation++;
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } }
    sources.clear();
  };
  const setSessionType = (type: "playback" | "auto") => {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== type) session.type = type;
    } catch { /* Older browsers can continue using ordinary Web Audio. */ }
  };
  const unlock = () => {
    if (!enabled || document.hidden) return;
    // Treat explicitly enabled game sound as media playback on iPhone.
    setSessionType("playback");
    try {
      if (context?.state === "closed") {
        context = undefined; master = undefined; noise = undefined; resuming = undefined;
        generation++;
      }
      context ??= new AudioContext();
      if (!master) {
        master = context.createGain();
        master.gain.value = 0.35;
        master.connect(context.destination);
      }
      if (context.state !== "running") {
        // Retry on each gesture: an earlier resume may still be waiting for permission.
        const attempt = context.resume().catch(() => {}).finally(() => {
          if (resuming === attempt) resuming = undefined;
        });
        resuming = attempt;
      }
    } catch { /* Unsupported or blocked audio: continue silently. */ }
  };
  const play = (kind: GameSound, intensity = 0) => {
    if (!enabled || document.hidden) return;
    unlock();
    if (!context || !master) return;
    const requested = performance.now();
    const requestedGeneration = generation;
    const requestedContext = context;
    const maxDelay = kind === "explode" || kind === "confirm" ? 1500 : 500;
    const emit = () => {
      if (!enabled || document.hidden || context?.state !== "running" || !master || requestedGeneration !== generation || context !== requestedContext || performance.now() - requested > maxDelay) return;
      const audio = context;
      const at = audio.currentTime;
      const tone = (frequency: number, end: number, duration: number, offset = 0, volume = 0.12, wave: OscillatorType = "square") => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency, at + offset);
        oscillator.frequency.exponentialRampToValueAtTime(end, at + offset + duration);
        gain.gain.setValueAtTime(0, at + offset);
        gain.gain.linearRampToValueAtTime(volume, at + offset + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, at + offset + duration);
        oscillator.connect(gain).connect(master!);
        sources.add(oscillator);
        oscillator.start(at + offset);
        oscillator.stop(at + offset + duration + 0.01);
        oscillator.onended = () => { sources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      };
      const noiseBurst = () => {
        if (!noise) {
          noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.32), audio.sampleRate);
          const samples = noise.getChannelData(0);
          for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        }
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        source.buffer = noise;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, at);
        filter.frequency.exponentialRampToValueAtTime(120, at + 0.3);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.35, at + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
        source.connect(filter).connect(gain).connect(master!);
        sources.add(source);
        source.start(at);
        source.onended = () => { sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
      };
      effects[kind](tone, Math.max(0, Math.min(1, intensity)), noiseBurst);
    };
    if (context.state !== "running" && resuming) void resuming.then(emit).catch(() => {});
    else { try { emit(); } catch { /* Audio failures must not interrupt a turn. */ } }
  };
  const toggle = () => {
    enabled = !enabled;
    stop();
    if (master && context) master.gain.setValueAtTime(enabled ? 0.35 : 0, context.currentTime);
    try { localStorage.setItem(storageKey, enabled ? "on" : "off"); } catch { /* Optional storage. */ }
    if (enabled) { unlock(); play("confirm"); }
    else setSessionType("auto");
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else unlock();
  });
  window.addEventListener("pageshow", unlock);
  window.addEventListener("pagehide", () => { stop(); setSessionType("auto"); });
  return { isEnabled: () => enabled, unlock, play, toggle, stop };
}
