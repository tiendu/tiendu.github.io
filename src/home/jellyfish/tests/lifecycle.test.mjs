import test from "node:test";
import assert from "node:assert/strict";
import { mountJellyfish, nextRenderTime } from "../app.mjs";
import { AsciiRenderer } from "../renderer.mjs";
import { OceanField, currentWeather } from "../ocean.mjs";

test("render cadence retains fractional intervals and skips missed frames", () => {
  for (const refresh of [60, 90, 120, 144]) {
    for (const fps of [24, 30]) {
      let deadline = 0, count = 0;
      for (let i = 1; i <= refresh * 10; i += 1) {
        const next = nextRenderTime(i * 1000 / refresh, deadline, fps);
        if (next !== null) { deadline = next; count += 1; }
      }
      assert.equal(count, fps * 10, `${refresh} Hz at ${fps} fps`);
    }
  }
  assert.equal(nextRenderTime(20, 0, 24), null);
  assert.equal(nextRenderTime(1000, 0, 24), 1000);
  assert.equal(nextRenderTime(1001, 1000, 24), null);
});

test("weather is cached for one water time and invalidated by time or offset", () => {
  const ocean = new OceanField(390, 565, 360);
  const a = ocean.weatherAt(0);
  assert.deepEqual(a, currentWeather(360));
  assert.equal(ocean.weatherAt(0), a);
  ocean.sample(100, 200, 0);
  assert.equal(ocean.weatherAt(0), a);
  assert.notEqual(ocean.weatherAt(1 / 60), a);
  ocean.timeOffset = 120;
  assert.deepEqual(ocean.weatherAt(0), currentWeather(120));
});

// Exercise the real mount/resize/visibility logic without a browser dependency.
function harness(t, { available = true, reduced = false, width = 390, height = 565 } = {}) {
  class Element extends EventTarget {
    hidden = false;
    attributes = new Set();
    toggleAttribute(name, force) {
      const present = force ?? !this.attributes.has(name);
      if (present) this.attributes.add(name);
      else this.attributes.delete(name);
      return present;
    }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
  }
  class Canvas extends Element {
    style = {};
    getContext() { return available ? { setTransform() {} } : null; }
  }
  const canvas = new Canvas(), fallback = new Element(), root = new Element();
  canvas.hidden = true;
  const doc = new EventTarget();
  doc.hidden = false;
  doc.querySelector = () => root;
  root.querySelector = selector => selector.includes("canvas") ? canvas : fallback;
  root.getBoundingClientRect = () => ({ width, height });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  const host = new EventTarget();
  const viewport = new EventTarget();
  viewport.scale = 1;
  host.visualViewport = viewport;
  const motion = new EventTarget();
  motion.matches = reduced;
  const frames = new Map();
  let next = 0, resize, disconnected = false, clock = 0;
  const draws = [];
  const globals = {
    HTMLElement: Element, HTMLCanvasElement: Canvas, document: doc,
    window: host, visualViewport: viewport, devicePixelRatio: 3,
    performance: { now: () => clock },
    matchMedia: query => query.includes("reduced-motion") ? motion : { matches: true },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(fn) { resize = fn; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  };
  const restore = [];
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    restore.push(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  t.mock.method(AsciiRenderer.prototype, "render", world => draws.push(world.time));
  let dispose = () => {};
  t.after(() => {
    try { dispose(); } finally { restore.forEach(fn => fn()); }
  });
  dispose = mountJellyfish();
  return { doc, canvas, fallback, motion, frames, draws, dispose,
    advance(ms) {
      assert.equal(frames.size, 1);
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      clock += ms;
      callback(clock);
    },
    resize(w, h) { width = w; height = h; resize(); },
    zoom(scale) { viewport.scale = scale; viewport.dispatchEvent(new Event("resize")); },
    visible(value) { doc.hidden = !value; doc.dispatchEvent(new Event("visibilitychange")); },
    disconnected: () => disconnected };
}

test("missing Canvas context leaves the fallback visible without scheduling work", t => {
  const h = harness(t, { available: false });
  assert.equal(h.canvas.hidden, true);
  assert.equal(h.fallback.hidden, false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.draws.length, 0);
});

test("reduced motion settles only once and ignores visibility and resize resumes", t => {
  const h = harness(t, { reduced: true });
  assert.ok(Math.abs(h.draws[0] - 0.4) < 1e-9);
  assert.equal(h.frames.size, 0);
  h.visible(false);
  h.visible(true);
  h.resize(400, 600);
  h.motion.dispatchEvent(new Event("change"));
  assert.ok(h.draws.every(time => time === h.draws[0]));
  assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.hidden, false);
  assert.equal(h.fallback.hidden, true);
});

test("zero-sized stages and context loss suspend rendering and resume once", t => {
  const h = harness(t, { width: 0, height: 0 });
  assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.hidden, true);
  h.resize(390, 565);
  assert.equal(h.frames.size, 1);
  assert.equal(h.canvas.hidden, false);
  h.resize(0, 0);
  assert.equal(h.frames.size, 0);
  h.resize(390, 565);
  assert.equal(h.frames.size, 1);
  h.canvas.dispatchEvent(new Event("contextlost"));
  assert.equal(h.frames.size, 0);
  assert.equal(h.fallback.hidden, false);
  h.canvas.dispatchEvent(new Event("contextrestored"));
  assert.equal(h.frames.size, 1);
  assert.equal(h.fallback.hidden, true);
  h.visible(false);
  assert.equal(h.frames.size, 0);
  h.visible(true);
  assert.equal(h.frames.size, 1);
  h.dispose();
  assert.equal(h.frames.size, 0);
  assert.ok(h.disconnected());
});


test("zoom changes backing resolution without advancing reduced-motion simulation", t => {
  const h = harness(t, { reduced: true });
  const settled = h.draws[0];
  assert.equal(h.canvas.width, 390 * 3);
  assert.equal(h.canvas.height, 565 * 3);
  h.zoom(2);
  assert.equal(h.canvas.width, 390 * 4);
  assert.equal(h.canvas.height, 565 * 4);
  assert.equal(h.canvas.style.width, "390px");
  assert.ok(h.canvas.hasAttribute("data-water-zoomed"));
  h.zoom(1);
  assert.equal(h.canvas.width, 390 * 3);
  assert.ok(!h.canvas.hasAttribute("data-water-zoomed"));
  assert.ok(h.draws.every(time => time === settled));
  assert.equal(h.frames.size, 0);
});

test("zoom preserves the running frame loop and listeners are removed on disposal", t => {
  const h = harness(t);
  assert.equal(h.frames.size, 1);
  h.zoom(2);
  assert.equal(h.frames.size, 1);
  assert.equal(h.canvas.width, 390 * 4);
  h.dispose();
  const count = h.draws.length;
  h.zoom(1);
  assert.equal(h.draws.length, count);
  assert.equal(h.canvas.width, 390 * 4);
  assert.equal(h.frames.size, 0);
  assert.ok(!h.canvas.hasAttribute("data-water-zoomed"));
});


test("sustained slow frames reduce backing resolution without restarting the world", t => {
  const h = harness(t);
  for (let i = 0; i < 20; i++) h.advance(100);
  assert.equal(h.canvas.width, 390 * 3);
  h.advance(100);
  assert.equal(h.canvas.width, Math.floor(390 * 2.75));
  assert.equal(h.canvas.style.width, "390px");
  assert.equal(h.frames.size, 1);
  assert.ok(Math.abs(h.draws.at(-1) - 1.05) < 1e-9);
  h.visible(false);
  assert.equal(h.frames.size, 0);
  h.visible(true);
  assert.equal(h.frames.size, 1);
  assert.equal(h.canvas.width, Math.floor(390 * 2.75));
});
