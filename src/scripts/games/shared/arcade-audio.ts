import { mountGameSound } from "./game-sound";

/** Frame-driven ambience: no background timers or accumulating loop sources. */
export function mountArcadeAudio(root: HTMLElement, game: string) {
  const audio = mountGameSound(root, game);
  let nextPulse = 0;
  let scene: "chase" | "crane" | null = null;
  const stop = () => { scene = null; nextPulse = 0; audio.stop(); };
  window.addEventListener("blur", stop);
  const ambience = (kind: typeof scene, intensity: number) => {
    if (!kind || root.hidden || document.hidden || !audio.isEnabled()) { scene = null; nextPulse = 0; return; }
    const now = performance.now();
    if (scene !== kind) { scene = kind; nextPulse = now + 300; }
    if (now < nextPulse) return;
    const stress = Math.max(0, Math.min(1, intensity));
    audio.play(kind === "chase" ? "pulse" : "strain", stress);
    nextPulse = now + (kind === "chase" ? 650 - stress * 430 : 1400 - stress * 1000);
  };
  return { play: audio.play, stop, ambience };
}
