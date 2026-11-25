import { renderFpsFor, SIMULATION } from "./config.mjs";
import { AsciiRenderer } from "./renderer.mjs";
import { JellyWorld } from "./world.mjs";
import { bindWaterInput } from "./water-input.mjs";

function seedFromSession() {
  try {
    const key = "tiendu:jellyfish-seed";
    const saved = sessionStorage.getItem(key);
    if (saved) return Number(saved) >>> 0;
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const seed = values[0] || 0x7a11f15;
    sessionStorage.setItem(key, String(seed));
    return seed;
  } catch {
    return 0x7a11f15;
  }
}

// Preserve the cadence remainder without issuing catch-up draws.
export function nextRenderTime(now, previous, fps) {
  const interval = 1000 / fps;
  const periods = Math.floor((now - previous + 0.000001) / interval);
  return periods > 0 ? previous + periods * interval : null;
}

export function mountJellyfish() {
  const root = document.querySelector("[data-ascii-ocean]");
  const canvas = root?.querySelector("[data-jelly-canvas]");
  if (!(root instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) return () => {};

  const fallback = root.querySelector("[data-jelly-fallback]");
  const showFallback = () => {
    canvas.hidden = true;
    if (fallback instanceof HTMLElement) fallback.hidden = false;
  };
  showFallback();
  let renderer;
  try {
    renderer = new AsciiRenderer(canvas);
  } catch {
    return () => {};
  }
  if (!renderer.ctx) return () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let world;
  let width = 1;
  let height = 1;
  let accumulator = 0;
  let last = performance.now();
  let lastRender = 0;
  let frame = 0;
  let running = false;
  let measurable = false;
  let contextLost = false;

  const draw = () => {
    renderer.render(world);
    if (canvas.hidden) canvas.hidden = false;
    if (fallback instanceof HTMLElement && !fallback.hidden) fallback.hidden = true;
  };

  const measure = () => {
    const rect = root.getBoundingClientRect();
    if (contextLost) return;
    if (rect.width <= 0 || rect.height <= 0) {
      measurable = false;
      stop();
      return;
    }
    const wasMeasurable = measurable;
    measurable = true;
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    if (world && Math.abs(nextWidth - width) < 1 && Math.abs(nextHeight - height) < 1
      && renderer.dpr === Math.min(globalThis.devicePixelRatio || 1, 2)) {
      if (!wasMeasurable) start();
      return;
    }
    width = nextWidth;
    height = nextHeight;
    renderer.resize(width, height);
    if (!world) {
      // Keep the session specimen, but enter the ocean at a new time on each load.
      world = new JellyWorld(width, height, seedFromSession(), Math.random() * 3600);
    } else {
      world.resize(width, height);
    }
    if (!wasMeasurable) {
      start();
      if (document.hidden) draw();
    } else {
      draw();
      lastRender = performance.now();
    }
  };

  const waterInput = bindWaterInput(canvas, {
    isActive: () => running && !!world,
    disturb: (...args) => world.disturb(...args),
  });

  const drawReduced = () => {
    if (!world) return;
    // Advance just enough to settle the initial hanging chains, then stay still.
    if (world.time === 0) {
      for (let i = 0; i < 24; i += 1) world.step(SIMULATION.fixedStep);
    }
    draw();
  };

  const tick = (now) => {
    if (!running || !world) return;
    const elapsed = Math.min(SIMULATION.maxFrameDelta, Math.max(0, (now - last) / 1000));
    last = now;
    accumulator += elapsed;

    while (accumulator >= SIMULATION.fixedStep) {
      world.step(SIMULATION.fixedStep);
      accumulator -= SIMULATION.fixedStep;
    }

    const deadline = nextRenderTime(now, lastRender, renderFpsFor(width, height));
    if (deadline !== null) {
      draw();
      lastRender = deadline;
    }
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    waterInput.reset();
    cancelAnimationFrame(frame);
  };

  const start = () => {
    waterInput.reset();
    cancelAnimationFrame(frame);
    if (document.hidden || !world || !measurable || contextLost) {
      running = false;
      return;
    }
    running = true;
    last = performance.now();
    accumulator = 0;
    lastRender = last;
    if (reduced.matches) {
      drawReduced();
      running = false;
      return;
    }
    draw();
    frame = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const onReducedChange = () => start();
  const onContextLost = () => {
    contextLost = true;
    stop();
    showFallback();
  };
  const onContextRestored = () => {
    contextLost = false;
    measurable = false;
    if (world) renderer.resize(width, height);
    measure();
  };

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  canvas.addEventListener("contextlost", onContextLost);
  canvas.addEventListener("contextrestored", onContextRestored);
  document.addEventListener("visibilitychange", onVisibility);
  reduced.addEventListener?.("change", onReducedChange);

  measure();

  return () => {
    stop();
    resizeObserver.disconnect();
    waterInput.dispose();
    canvas.removeEventListener("contextlost", onContextLost);
    canvas.removeEventListener("contextrestored", onContextRestored);
    document.removeEventListener("visibilitychange", onVisibility);
    reduced.removeEventListener?.("change", onReducedChange);
  };
}
