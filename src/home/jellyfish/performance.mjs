import { canvasPixelRatio } from "./render-quality.mjs";

// One rolling interval of counters; no per-frame arrays or DOM writes.
export class PerformanceWindow {
  constructor(now = 0) { this.reset(now); }

  reset(now) {
    this.start = now;
    this.frames = this.ticks = this.steps = this.physics = this.render = 0;
  }

  record(now, steps, physicsMs, drew, renderMs) {
    this.ticks++;
    this.steps += steps;
    this.physics += physicsMs;
    if (drew) { this.frames++; this.render += renderMs; }
    const elapsed = now - this.start;
    if (elapsed < 1000) return null;
    const result = {
      fps: this.frames * 1000 / elapsed,
      raf: this.ticks * 1000 / elapsed,
      steps: this.steps * 1000 / elapsed,
      physicsMs: this.physics / Math.max(1, this.steps),
      physicsLoad: this.physics / elapsed,
      renderMs: this.render / Math.max(1, this.frames),
    };
    this.reset(now);
    return result;
  }
}

export class AdaptiveResolution {
  constructor() { this.cap = Infinity; this.resetStreak(); }

  resetStreak() { this.slow = this.fast = 0; }

  ratio(width, height) { return Math.min(this.cap, canvasPixelRatio(width, height)); }

  observe(stats, target, current, ceiling) {
    // Lower only the backing store, never the anatomy or simulation rate.
    // Avoid degrading detail when physics itself occupies most wall time.
    const slow = stats.fps < target * 0.84 && stats.physicsLoad < 0.55;
    const fast = stats.fps >= target * 0.95 && stats.physicsLoad < 0.40
      && stats.renderMs < 450 / target;
    this.slow = slow ? this.slow + 1 : 0;
    this.fast = fast ? this.fast + 1 : 0;
    const floor = Math.min(1.5, ceiling);
    if (this.slow >= 2 && current > floor) {
      this.cap = Math.max(floor, current - 0.25);
      this.resetStreak();
    } else if (this.fast >= 6 && current < ceiling) {
      const next = Math.min(ceiling, current + 0.25);
      this.cap = next >= ceiling ? Infinity : next;
      this.resetStreak();
    }
  }
}

export function createPerformanceOverlay(root, search = globalThis.location?.search ?? "") {
  if (new URLSearchParams(search).get("debug") !== "1") return null;
  const node = root.ownerDocument?.createElement("pre");
  if (!node) return null;
  node.setAttribute("aria-hidden", "true");
  Object.assign(node.style, {
    position: "absolute", top: "8px", left: "8px", zIndex: "3", margin: "0",
    padding: "6px 8px", background: "rgba(0,2,4,.78)", color: "#a7d7bc",
    font: "11px/1.4 monospace", pointerEvents: "none", userSelect: "none",
  });
  root.append(node);
  node.textContent = "Collecting samples...";
  return {
    update(stats, target, ratio, atlas, mode = "native") {
      const rate = atlas ? 100 * atlas.hits / Math.max(1, atlas.hits + atlas.misses) : 0;
      node.textContent = `DRAW ${stats.fps.toFixed(1)}/${target} fps\n`
        + `RAF  ${stats.raf.toFixed(1)} Hz\n`
        + `STEP ${stats.steps.toFixed(1)}/60 s⁻¹\n`
        + `PHYS ${stats.physicsMs.toFixed(1)} ms/step\n`
        + `DRAW ${stats.renderMs.toFixed(1)} ms/submit\n`
        + `DPR  ${ratio.toFixed(2)}×  ${mode.toUpperCase()}${atlas ? ` ${rate.toFixed(0)}% hit` : ""}`;
    },
    pause() { node.textContent = "Animation paused"; },
    dispose() { node.remove(); },
  };
}
