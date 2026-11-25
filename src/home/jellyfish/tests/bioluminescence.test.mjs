import test from "node:test";
import assert from "node:assert/strict";
import { Bioluminescence } from "../bioluminescence.mjs";

const dt = 1 / 60;
const jelly = () => ({ x: 100, y: 100, tilt: 0, pulse: 0,
  bellWidth: () => 100, bellHeight: () => 50 });
const calm = { sample: () => ({ x: 0, y: 0 }) };
const advance = (light, j, ocean, steps) => {
  for (let i = 0; i < steps; i += 1) light.step(dt, j, j.pulse, ocean, i * dt);
};

test("contraction speed, not compression, drives the muscular glow", () => {
  const light = new Bioluminescence(), j = jelly();
  for (let i = 0; i < 15; i += 1) {
    const previous = j.pulse;
    j.pulse += 0.04;
    light.step(dt, j, previous, calm, i * dt);
  }
  const bright = light.at(0, -0.075);
  assert.ok(bright > 0.25);
  assert.ok(light.at(0, -0.9) < bright * 0.01);
  advance(light, j, calm, 120);
  assert.ok(light.at(0, -0.075) < bright * 0.02);
  j.pulse = 0;
  light.step(dt, j, 0.6, calm, 3);
  assert.ok(light.at(0, -0.075) < 0.01);
});

test("uniform current and a distant pointer do not trigger a flash", () => {
  const light = new Bioluminescence(), j = jelly();
  advance(light, j, { sample: () => ({ x: 30, y: -10 }),
    pointer: { x: 900, y: 900, strength: 0.55 } }, 120);
  assert.equal(light.flash, null);
  assert.equal(light.at(0, 0), 0);
});

test("a nearby disturbance launches a traveling, decaying flash", () => {
  const light = new Bioluminescence(), j = jelly();
  const ocean = { ...calm, pointer: { x: 70, y: 83, strength: 0.55 } };
  light.step(dt, j, 0, ocean, 0);
  assert.ok(light.flash);
  assert.ok(light.flash.u < 0);
  advance(light, j, calm, 6);
  const origin = light.flash.u;
  assert.ok(light.at(origin, -0.07) > light.at(0.7, -0.07));
  advance(light, j, calm, 30);
  assert.ok(light.at(0.7, -0.07) > light.at(origin, -0.07));
  advance(light, j, calm, 100);
  assert.equal(light.flash, null);
  assert.equal(light.at(0.7, -0.07), 0);
});

test("strong spatial shear triggers a bounded response with a refractory interval", () => {
  const light = new Bioluminescence(), j = jelly();
  const ocean = { sample: x => ({ x: x < 100 ? -20 : 20, y: 0 }) };
  light.step(dt, j, 0, ocean, 0);
  const first = light.flash;
  assert.ok(first);
  advance(light, j, ocean, 30);
  assert.equal(light.flash, first);
  for (const u of [-1, 0, 1]) for (const v of [-1, -0.5, 0]) {
    const value = light.at(u, v);
    assert.ok(value >= 0 && value <= 1);
  }
  assert.equal(light.rootAt({ offset: 0.4 }, 0.5), 0);
});

test("near-pointer origin follows the visible bell tilt", () => {
  const light = new Bioluminescence(), j = jelly();
  const ocean = { ...calm, pointer: { x: 117.5, y: 130, strength: 0.55 } };
  light.step(dt, j, 0, ocean, 0, Math.PI / 2);
  assert.ok(light.flash.u > 0.4);
});
