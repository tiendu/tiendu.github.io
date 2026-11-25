import test from "node:test";
import assert from "node:assert/strict";
import { JellyWorld } from "../world.mjs";
import { AsciiRenderer } from "../renderer.mjs";
import { appendageProjectionFor, bellScaleFor, MAX_VISUAL_YAW, stepVisualYaw, visualDepthFor } from "../orientation.mjs";
import { ribbonMaterialAt, skirtLobeAt, tissuePresence } from "../material.mjs";

function snapshot(world) {
  const { jelly, snow } = world;
  return {
    body: [jelly.x, jelly.y, jelly.vx, jelly.vy, jelly.tilt, jelly.pulse],
    chains: jelly.chains.flatMap(item => [item, ...item.branches]).map(({ chain }) =>
      [chain.x, chain.y, chain.px, chain.py].map(values => Array.from(values))),
    snow: structuredClone(snow.items),
  };
}

test("orientation has a neutral projection and mirrored depth parallax", () => {
  const world = new JellyWorld(960, 620, 1234);
  assert.equal(bellScaleFor(0), 1);
  assert.ok(bellScaleFor(MAX_VISUAL_YAW) > 0.85);
  assert.equal(bellScaleFor(MAX_VISUAL_YAW), bellScaleFor(-MAX_VISUAL_YAW));
  for (const item of world.jelly.chains) {
    const neutral = appendageProjectionFor(world.jelly, item, 0);
    assert.ok(Math.abs(neutral.x) + Math.abs(neutral.y) < 1e-9);
    assert.equal(neutral.light, 1);
    assert.equal(neutral.width, 1);
    assert.equal(neutral.depth, item.layer);
    const left = appendageProjectionFor(world.jelly, item, -0.78);
    const right = appendageProjectionFor(world.jelly, item, 0.78);
    assert.ok(Math.abs(left.x + right.x) + Math.abs(left.y + right.y) < 1e-9);
    assert.ok(Math.hypot(right.x, right.y) <= world.jelly.bellWidth() * 0.12);
  }
  assert.ok(visualDepthFor({ layer: 0, offset: 1 }, 0.5) > visualDepthFor({ layer: 0, offset: -1 }, 0.5));
});

test("turning has inertia and reverses without snapping", () => {
  let state = { yaw: 0, velocity: 0 };
  for (let i = 0; i < 20 * 60; i += 1) {
    const previous = state.yaw;
    state = stepVisualYaw(state, 0.7, 1 / 60);
    assert.ok(Math.abs(state.yaw - previous) <= 0.001000001);
  }
  assert.ok(state.yaw > 0.45 && state.yaw < 0.72, `yaw ${state.yaw}`);
  const before = state.yaw;
  state = stepVisualYaw(state, -0.7, 1 / 60);
  assert.ok(Math.abs(state.yaw - before) < 0.002);
  for (let i = 0; i < 60 * 60; i += 1) state = stepVisualYaw(state, -10, 1 / 60);
  assert.ok(state.yaw < -0.6 && state.yaw >= -MAX_VISUAL_YAW);
});

test("visual orientation never changes the fluid simulation or its random stream", () => {
  const a = new JellyWorld(960, 620, 1234);
  const b = new JellyWorld(960, 620, 1234);
  for (let i = 0; i < 180; i += 1) {
    b.orientation = { yaw: i % 2 ? -0.78 : 0.78, velocity: 0 };
    if (i === 60) {
      a.resize(390, 720);
      b.resize(390, 720);
    }
    a.step();
    b.step();
  }
  assert.deepEqual(snapshot(a), snapshot(b));
  assert.equal(a.random(), b.random());
});

// Execute the actual renderer, including masks and embedded roots. A minimal
// Canvas recorder catches invalid coordinates, unbalanced state and mutation.
function recordingCanvas() {
  const calls = [];
  let depth = 0;
  const ctx = {
    save() { depth += 1; },
    restore() { depth -= 1; assert.ok(depth >= 0); },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  for (const name of ["setTransform", "translate", "rotate", "scale", "ellipse", "fillRect", "moveTo", "lineTo", "fillText", "beginPath", "fill", "stroke"]) {
    ctx[name] = (...args) => {
      for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), name);
      if (name === "translate" || name === "scale" || name === "fillText") calls.push([name, ...args]);
    };
  }
  return { canvas: { style: {}, getContext: () => ctx }, calls, balanced: () => depth === 0 };
}

test("the complete renderer turns at both viewport sizes without touching chain history", () => {
  for (const [width, height] of [[960, 620], [390, 720]]) {
    const world = new JellyWorld(width, height, 1234);
    const before = snapshot(world);
    const recorder = recordingCanvas();
    const renderer = new AsciiRenderer(recorder.canvas);
    renderer.resize(width, height);
    const frames = [];
    for (const yaw of [0, -0.78, 0.78]) {
      recorder.calls.length = 0;
      renderer.render({ ...world, orientation: { yaw, velocity: 0 } });
      assert.ok(recorder.balanced());
      assert.ok(recorder.calls.filter(call => call[0] === "fillText").length > 100);
      frames.push(JSON.stringify(recorder.calls));
      assert.deepEqual(snapshot(world), before);
    }
    assert.notEqual(frames[0], frames[1]);
    assert.notEqual(frames[1], frames[2]);
  }
});

test("material variation leaves soft scallops, varied visibility and delicate tips", () => {
  const lobes = Array.from({ length: 121 }, (_, i) => skirtLobeAt(-0.9 + 1.8 * i / 120, 1.2));
  assert.ok(Math.max(...lobes.map(lobe => lobe.drop)) > 0.015);
  assert.ok(lobes[0].drop < 0.002 && lobes.at(-1).drop < 0.002);
  const world = new JellyWorld(960, 620, 1234);
  for (const arm of [false, true]) {
    const items = world.jelly.chains.filter(item => item.arm === arm);
    const values = items.map(item => tissuePresence(item, 0.55));
    assert.ok(Math.max(...values) - Math.min(...values) > 0.25);
  }
  const item = world.jelly.chains.find(item => item.arm);
  assert.ok(ribbonMaterialAt(item, 1).fray < ribbonMaterialAt(item, 0.5).fray);
  assert.ok(ribbonMaterialAt(item, 1).width < ribbonMaterialAt(item, 0).width);
});
