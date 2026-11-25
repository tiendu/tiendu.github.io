import test from "node:test";
import assert from "node:assert/strict";
import { JellyWorld } from "../world.mjs";
import { AsciiRenderer } from "../renderer.mjs";
import { bellOcclusionContour, skirtRimAt, visibleAttachmentFor } from "../geometry.mjs";
import { rotate } from "../math.mjs";
import {
  keepTrailDirection, MAX_VISUAL_TILT, stepVisualTilt, tiltTargetAt,
} from "../orientation.mjs";
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

test("visual orientation never changes the fluid simulation or its random stream", () => {
  const a = new JellyWorld(960, 620, 1234);
  const b = new JellyWorld(960, 620, 1234);
  for (let i = 0; i < 180; i += 1) {
    b.orientation = { tilt: i % 2 ? -0.31 : 0.31, tiltVelocity: 0 };
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
  for (const name of ["setTransform", "translate", "rotate", "scale", "ellipse", "fillRect", "moveTo", "lineTo", "fillText", "beginPath", "fill", "stroke", "rect", "closePath", "clip"]) {
    ctx[name] = (...args) => {
      for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), name);
      if (name === "translate" || name === "rotate" || name === "scale" || name === "fillText" || name === "clip") calls.push([name, ...args]);
    };
  }
  return { canvas: { style: {}, getContext: () => ctx }, calls, balanced: () => depth === 0 };
}

test("the complete renderer leans at both viewport sizes without touching chain history", () => {
  for (const [width, height] of [[960, 620], [390, 720]]) {
    const world = new JellyWorld(width, height, 1234);
    const before = snapshot(world);
    const recorder = recordingCanvas();
    const renderer = new AsciiRenderer(recorder.canvas);
    renderer.resize(width, height);
    const frames = [];
    for (const tilt of [0, -0.15, 0.15, -0.31, 0.31]) {
      recorder.calls.length = 0;
      renderer.render({ ...world, orientation: { tilt, tiltVelocity: 0 } });
      assert.ok(recorder.balanced());
      assert.equal(recorder.calls.filter(call => call[0] === "clip").length, 0,
        "external tissue must not use Canvas clipping");
      assert.ok(recorder.calls.filter(call => call[0] === "fillText").length > 100);
      frames.push(JSON.stringify(recorder.calls));
      assert.deepEqual(snapshot(world), before);
    }
    assert.notEqual(frames[0], frames[1]);
    assert.notEqual(frames[1], frames[2]);
    assert.notEqual(frames[2], frames[3]);
    assert.notEqual(frames[3], frames[4]);
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


test("visual lean follows current strength, retains inertia and settles in calm", () => {
  assert.equal(Math.abs(tiltTargetAt(0)), 0);
  assert.ok(tiltTargetAt(18) < tiltTargetAt(5));
  assert.equal(tiltTargetAt(18), -tiltTargetAt(-18));
  let state = { tilt: 0, tiltVelocity: 0 };
  const advance = (flow, seconds) => {
    for (let i = 0; i < seconds * 60; i++) {
      const previous = state.tilt;
      state = stepVisualTilt(state, tiltTargetAt(flow), 1 / 60);
      assert.ok(Math.abs(state.tilt) <= MAX_VISUAL_TILT);
      assert.ok(Math.abs(state.tilt - previous) < 0.0015);
    }
  };
  advance(18, 8);
  assert.ok(state.tilt < -0.24);
  advance(-18, 2);
  assert.ok(state.tilt < -0.08, "bell retains old attitude after reversal");
  advance(-18, 10);
  assert.ok(state.tilt > 0.24);
  advance(0, 16);
  assert.ok(Math.abs(state.tilt) < 0.005);
});

// Minimal affine Canvas model: the multiplication order matches Canvas 2D.
function affineRecorder() {
  let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
  return {
    translate(x, y) { e += a * x + c * y; f += b * x + d * y; },
    rotate(t) {
      const cos = Math.cos(t), sin = Math.sin(t);
      [a, b, c, d] = [a * cos + c * sin, b * cos + d * sin,
        c * cos - a * sin, d * cos - b * sin];
    },
    scale(x, y) { a *= x; b *= x; c *= y; d *= y; },
    point(x, y) { return [a * x + c * y + e, b * x + d * y + f]; },
  };
}

test("extra lean rotates the root with the skirt but preserves the entire trail vector", () => {
  const { jelly } = new JellyWorld(960, 620, 1234);
  const near = (a, b) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8);
  for (const extra of [-0.35, 0, 0.35]) {
    for (const item of jelly.chains) {
      const frame = tilt => {
        const ctx = affineRecorder();
        ctx.translate(jelly.x, jelly.y);
        ctx.rotate(jelly.tilt + tilt);
        ctx.rotate(-jelly.tilt);
        ctx.translate(-jelly.x, -jelly.y);
        return ctx;
      };
      const baseline = frame(0);
      const tilted = frame(extra);
      const root = [item.chain.x[0], item.chain.y[0]];
      const skirtRoot = tilted.point(...root);
      keepTrailDirection(tilted, item, extra);
      near(tilted.point(...root), skirtRoot);
      const delta = (ctx, x, y) => {
        const p = ctx.point(x, y), r = ctx.point(...root);
        return [p[0] - r[0], p[1] - r[1]];
      };
      const tail = [item.chain.x.at(-1), item.chain.y.at(-1)];
      near(delta(tilted, ...tail), delta(baseline, ...tail));
      for (const branch of item.branches) {
        const end = [branch.chain.x.at(-1), branch.chain.y.at(-1)];
        near(delta(tilted, ...end), delta(baseline, ...end));
      }
    }
  }
});

// Ray casting is independent of the Canvas implementation used by the renderer.
function insideContour(point, contour) {
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i], b = contour[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

test("visible tentacle origins stay tucked inside the scalloped skirt and oral arms stay central", () => {
  for (const [width, height] of [[960, 620], [390, 720]]) {
    for (const seed of [1234, 991, 52]) {
      const world = new JellyWorld(width, height, seed);
      const { jelly } = world;
      for (const [pulse, physicalTilt, time] of [[0, -0.115, 0], [0.5, 0, 12], [1, 0.115, 27]]) {
        jelly.pulse = pulse;
        jelly.tilt = physicalTilt;
        const before = snapshot(world);
        const contour = bellOcclusionContour(jelly, time);
        for (const item of jelly.chains) {
          const root = visibleAttachmentFor(jelly, item, time);
          const local = rotate(root.rootX - jelly.x, root.rootY - jelly.y, -jelly.tilt);
          const v = local.y / jelly.bellHeight();
          assert.ok(Math.abs(v - root.v) < 1e-9);
          assert.ok(Math.abs(root.u) <= (item.arm ? 0.29 : 0.76) + 1e-9);
          assert.ok(Math.abs(item.chain.x[0] + root.x - root.rootX) < 1e-9);
          assert.ok(Math.abs(item.chain.y[0] + root.y - root.rootY) < 1e-9);
          const rim = skirtRimAt(jelly, root.u, time);
          assert.ok(Math.abs(v - rim - (item.arm ? 0.035 : -0.018)) < 1e-9);
          if (!item.arm) assert.ok(insideContour({ x: root.rootX, y: root.rootY }, contour), `seed ${seed} u ${root.u} v ${v}`);
        }
        assert.deepEqual(snapshot(world), before);
      }
    }
  }
});

test("corrected visible roots follow the skirt and lean without rotating their trails", () => {
  const { jelly } = new JellyWorld(390, 720, 1234);
  const near = (a, b) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8);
  for (const extra of [-0.35, 0, 0.35]) {
    for (const item of jelly.chains) {
      const attachment = visibleAttachmentFor(jelly, item, 17);
      const frame = tilt => {
        const ctx = affineRecorder();
        ctx.translate(jelly.x, jelly.y);
        ctx.rotate(jelly.tilt + tilt);
        ctx.rotate(-jelly.tilt);
        ctx.translate(-jelly.x, -jelly.y);
        return ctx;
      };
      const skirt = frame(extra);
      const trail = frame(extra);
      trail.translate(attachment.x, attachment.y);
      keepTrailDirection(trail, item, extra);
      const base = frame(0);
      const root = [item.chain.x[0], item.chain.y[0]];
      const end = [item.chain.x.at(-1), item.chain.y.at(-1)];
      near(trail.point(...root), skirt.point(attachment.rootX, attachment.rootY));
      const delta = ctx => {
        const a = ctx.point(...root), b = ctx.point(...end);
        return [b[0] - a[0], b[1] - a[1]];
      };
      near(delta(trail), delta(base));
    }
  }
});
