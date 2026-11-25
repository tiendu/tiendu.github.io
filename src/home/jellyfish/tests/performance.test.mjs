import test from "node:test";
import assert from "node:assert/strict";
import { AdaptiveResolution, PerformanceWindow, SimulationProfile, createPerformanceOverlay } from "../performance.mjs";

const slow = { fps: 12, physicsLoad: 0.20, steps: 60, renderMs: 60 };
const fast = { fps: 24, physicsLoad: 0.20, steps: 60, renderMs: 8 };

test("performance window reports draw submissions, steps and average CPU timings", () => {
  const monitor = new PerformanceWindow(0);
  let summary;
  for (let i = 1; i <= 60; i++) {
    summary = monitor.record(i * 1000 / 60, 1, 2, i % 2 === 0, 8);
    if (i < 60) assert.equal(summary, null);
  }
  assert.equal(summary.fps, 30);
  assert.equal(summary.raf, 60);
  assert.equal(summary.steps, 60);
  assert.equal(summary.physicsMs, 2);
  assert.equal(summary.renderMs, 8);
  assert.equal(summary.physicsLoad, 0.12);
  monitor.reset(6000);
  assert.equal(monitor.record(6010, 1, 1, false, 0), null);
});

test("ineffective resolution trials restore the previous ratio", () => {
  const quality = new AdaptiveResolution();
  quality.observe(slow, 24, 3, 3);
  quality.observe(slow, 24, 3, 3);
  assert.equal(quality.cap, 2.75);
  quality.observe(slow, 24, 2.75, 3);
  quality.observe(slow, 24, 2.75, 3);
  assert.equal(quality.cap, Infinity);
  for (let i = 0; i < 8; i++) quality.observe(slow, 24, 3, 3);
  assert.equal(quality.cap, Infinity);
});

test("successful pixel trial is retained and healthy rendering recovers native DPR", () => {
  const quality = new AdaptiveResolution();
  quality.observe(slow, 24, 3, 3);
  quality.observe(slow, 24, 3, 3);
  const improved = { ...slow, fps: 15, renderMs: 42 };
  quality.observe(improved, 24, 2.75, 3);
  quality.observe(improved, 24, 2.75, 3);
  assert.equal(quality.cap, 2.75);
  for (let i = 0; i < 6; i++) quality.observe(fast, 24, 2.75, 3);
  assert.equal(quality.cap, Infinity);
});

test("recorded iPhone physics-bound metrics do not sacrifice Retina quality", () => {
  const quality = new AdaptiveResolution();
  for (let i = 0; i < 20; i++) quality.observe({ fps: 20, steps: 60, physicsLoad: 0.48, renderMs: 14.5 }, 24, 3, 3);
  assert.equal(quality.cap, Infinity);
});

test("simulation profile reports stage means and clears window counters", () => {
  const profile = new SimulationProfile();
  Object.assign(profile, { steps: 4, contact: 4, field: 2, solver: 12, repairs: 2, skipped: 8, rebuilds: 3 });
  assert.deepEqual(profile.take(), { contact: 1, field: 0.5, solver: 3, repairs: 2, skipped: 8, rebuilt: 0.75 });
  assert.equal(profile.steps, 0);
});

test("one slow interval or a physics-bound interval does not reduce resolution", () => {
  const quality = new AdaptiveResolution();
  for (let i = 0; i < 4; i++) {
    quality.observe(slow, 24, 3, 3);
    quality.observe(fast, 24, 3, 3);
  }
  for (let i = 0; i < 4; i++) quality.observe({ ...slow, physicsLoad: 0.8 }, 24, 3, 3);
  assert.equal(quality.cap, Infinity);
  quality.observe(slow, 24, 3, 3);
  quality.resetStreak();
  quality.observe(slow, 24, 3, 3);
  assert.equal(quality.cap, Infinity);
  for (let i = 0; i < 6; i++) quality.observe(slow, 24, 1, 1);
  assert.equal(quality.cap, Infinity);
});

test("debug overlay is opt-in, pointer-transparent and removable", () => {
  let count = 0, removed = false;
  const node = { style: {}, setAttribute() {}, remove() { removed = true; } };
  const root = { ownerDocument: { createElement() { count++; return node; } }, append() {} };
  assert.equal(createPerformanceOverlay(root, ""), null);
  assert.equal(createPerformanceOverlay(root, "?debug=0"), null);
  assert.equal(count, 0);
  const overlay = createPerformanceOverlay(root, "?debug=1");
  assert.equal(node.style.pointerEvents, "none");
  overlay.update({ ...fast, steps: 60, raf: 60, physicsMs: 2 }, 24, 3, { hits: 99, misses: 1 }, "atlas");
  assert.match(node.textContent, /24\.0\/24 fps/);
  assert.match(node.textContent, /ATLAS 99% hit/);
  overlay.pause();
  assert.equal(node.textContent, "Animation paused");
  overlay.dispose();
  assert.ok(removed);
});
