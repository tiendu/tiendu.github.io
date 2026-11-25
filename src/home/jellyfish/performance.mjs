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

export class SimulationProfile {
  constructor() { this.reset(); }
  reset() { this.contact = this.field = this.solver = this.steps = this.repairs = this.skipped = this.rebuilds = 0; }
  take() {
    const n = Math.max(1, this.steps);
    const result = { contact: this.contact / n, field: this.field / n, solver: this.solver / n,
      repairs: this.repairs, skipped: this.skipped, rebuilt: this.rebuilds / n };
    this.reset();
    return result;
  }
}

export class AdaptiveResolution {
  constructor() { this.cap = Infinity; this.cooldown = 0; this.resetStreak(); }

  resetStreak() {
    if (this.trial) this.cap = this.trial.previousCap;
    this.trial = null;
    this.slow = this.fast = 0;
  }

  ratio(width, height) { return Math.min(this.cap, canvasPixelRatio(width, height)); }

  observe(stats, target, current, ceiling) {
    if (this.ceiling !== ceiling) {
      this.resetStreak();
      this.cap = Infinity;
      this.cooldown = 0;
      this.ceiling = ceiling;
    }
    // Only probe lower resolution when draw submissions are expensive and
    // simulation is keeping up. FPS alone cannot identify a pixel bottleneck.
    const slow = stats.fps < target * 0.90 && stats.physicsLoad < 0.35
      && stats.steps >= 55 && stats.renderMs > 450 / target;
    if (this.trial) {
      const trial = this.trial;
      // First interval after resize can include the backing-store allocation.
      if (current !== trial.ratio) return;
      if (++trial.windows < 2) return;
      const gain = stats.fps - trial.fps >= Math.max(1, target * 0.05)
        || (stats.fps >= target * 0.95 && stats.renderMs <= trial.renderMs * 0.85);
      if (!gain || stats.physicsLoad >= 0.45 || stats.steps < 55) {
        this.cap = trial.previousCap;
        this.cooldown = 10;
      }
      this.trial = null;
      this.slow = this.fast = 0;
      return;
    }
    if (this.cooldown > 0) this.cooldown--;
    const fast = stats.fps >= target * 0.95 && stats.physicsLoad < 0.40
      && stats.renderMs < 450 / target;
    this.slow = slow && !this.cooldown ? this.slow + 1 : 0;
    this.fast = fast ? this.fast + 1 : 0;
    const floor = Math.min(2, ceiling);
    if (this.slow >= 2 && current > floor) {
      const ratio = Math.max(floor, current - 0.25);
      this.trial = { previousCap: this.cap, ratio, fps: stats.fps, renderMs: stats.renderMs, windows: 0 };
      this.cap = ratio;
      this.slow = this.fast = 0;
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
    position: "absolute", bottom: "8px", left: "8px", zIndex: "3", margin: "0",
    padding: "6px 8px", background: "transparent", color: "#a7d7bc",
    textShadow: "0 1px 2px #000",
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
        + (stats.simulation ? ` CNT ${stats.simulation.contact.toFixed(1)} FIELD ${stats.simulation.field.toFixed(1)}\n`
          + ` SOL ${stats.simulation.solver.toFixed(1)} ms/step\n`
          + `FIELD ${Math.round(stats.simulation.rebuilt * 100)}%  FIX ${stats.simulation.repairs}/win\n`
          + `SKIP ${stats.simulation.skipped}/win\n` : "")
        + `DRAW ${stats.renderMs.toFixed(1)} ms/submit\n`
        + `DPR  ${ratio.toFixed(2)}×  ${mode.toUpperCase()}${atlas ? ` ${rate.toFixed(0)}% hit` : ""}`;
    },
    pause() { node.textContent = "Animation paused"; },
    dispose() { node.remove(); },
  };
}
