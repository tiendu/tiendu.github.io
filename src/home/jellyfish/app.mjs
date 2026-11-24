import { renderFpsFor, SIMULATION } from "./config.mjs";
import { AsciiRenderer } from "./renderer.mjs";
import { JellyWorld } from "./world.mjs";

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

export function mountJellyfish() {
  const root = document.querySelector("[data-ascii-ocean]");
  const canvas = root?.querySelector("[data-jelly-canvas]");
  if (!(root instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) return () => {};

  const fallback = root.querySelector("[data-jelly-fallback]");
  const renderer = new AsciiRenderer(canvas);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(pointer: fine)");
  let world;
  let width = 1;
  let height = 1;
  let accumulator = 0;
  let last = performance.now();
  let lastRender = 0;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTime = performance.now();
  let pointerActive = false;
  let running = false;


  const measure = () => {
    const rect = root.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    if (Math.abs(nextWidth - width) < 1 && Math.abs(nextHeight - height) < 1) return;
    width = nextWidth;
    height = nextHeight;
    renderer.resize(width, height);
    if (!world) world = new JellyWorld(width, height, seedFromSession());
    else world.resize(width, height);
    renderer.render(world);
  };

  const onPointerMove = (event) => {
    if (!world || !finePointer.matches) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();
    const dt = Math.max(16, now - pointerTime) / 1000;
    const vx = pointerActive ? Math.max(-100, Math.min(100, (x - pointerX) / dt)) : 0;
    const vy = pointerActive ? Math.max(-100, Math.min(100, (y - pointerY) / dt)) : 0;
    pointerX = x;
    pointerY = y;
    pointerTime = now;
    pointerActive = true;
    world.disturb(x, y, vx, vy);
  };

  const onPointerLeave = () => {
    pointerActive = false;
  };

  const drawReduced = () => {
    if (!world) return;
    // Advance just enough to settle the initial hanging chains, then stay still.
    for (let i = 0; i < 24; i += 1) world.step(SIMULATION.fixedStep);
    renderer.render(world);
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

    const renderInterval = 1000 / renderFpsFor(width, height);
    if (now - lastRender >= renderInterval) {
      renderer.render(world);
      lastRender = now;
    }
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const start = () => {
    cancelAnimationFrame(frame);
    if (document.hidden || !world) {
      running = false;
      return;
    }
    running = true;
    last = performance.now();
    accumulator = 0;
    if (reduced.matches) {
      drawReduced();
      running = false;
      return;
    }
    frame = requestAnimationFrame(tick);
  };


  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const onReducedChange = () => start();

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  reduced.addEventListener?.("change", onReducedChange);

  measure();
  if (fallback instanceof HTMLElement) fallback.hidden = true;
  canvas.hidden = false;
  start();

  return () => {
    stop();
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    reduced.removeEventListener?.("change", onReducedChange);
  };
}
