import test from "node:test";
import assert from "node:assert/strict";
import {
  bellGridScaleFor,
  bellPoreThresholdAt,
  bellProfileAt,
  bellRimAt,
  bellTransmissionAt,
  internalRootOpacityAt,
  rootEmergenceScale,
  skirtDepthLightAt,
  skirtMembraneAt,
  tentacleAccentStrength,
  tentaclePresenceScale,
} from "../renderer.mjs";

test("bell profile rounds into a narrower skirt with a porous lower membrane", () => {
  const crown = bellProfileAt(-0.90, 0.1, 1.2);
  const shoulder = bellProfileAt(-0.42, 0.1, 1.2);
  const lower = bellProfileAt(-0.10, 0.1, 1.2);
  const skirt = bellProfileAt(0.015, 0.1, 1.2);
  assert.equal(bellProfileAt(-1.065, 0.1, 1.2), 0);
  assert.ok(crown > 0.35 && crown < 0.55, `crown ${crown}`);
  assert.ok(shoulder > crown + 0.35, `shoulder ${shoulder}`);
  assert.ok(shoulder < 0.925, `shoulder too wide ${shoulder}`);
  assert.ok(lower < shoulder - 0.04 && lower > 0.72, `lower ${lower} shoulder ${shoulder}`);
  assert.ok(skirt < lower, `skirt ${skirt} lower ${lower}`);

  const rim = [];
  for (let u = -0.9; u <= 0.9; u += 0.05) rim.push(bellRimAt(u, 0.4, 2.1));
  const span = Math.max(...rim) - Math.min(...rim);
  assert.ok(span > 0.035 && span < 0.08, `rim span ${span}`);
  assert.ok(bellRimAt(0, 0.4, 2.1) > bellRimAt(0.85, 0.4, 2.1) + 0.01);

  const upperPore = bellPoreThresholdAt(-0.80, 0.30, 0.10);
  const lowerPore = bellPoreThresholdAt(-0.10, 0.30, 0.10);
  assert.ok(lowerPore < upperPore - 0.08, `upper ${upperPore} lower ${lowerPore}`);
});

test("bell uses a denser sub-grid without increasing the whole-scene grid", () => {
  const desktop = bellGridScaleFor(false);
  const compact = bellGridScaleFor(true);
  assert.ok(desktop.x <= 0.64 && desktop.y <= 0.68, `desktop grid ${desktop.x},${desktop.y}`);
  assert.ok(compact.x <= 0.80 && compact.y <= 0.84, `compact grid ${compact.x},${compact.y}`);
  assert.ok(0.84 / desktop.x > 1.30, `desktop horizontal density ${0.84 / desktop.x}`);
  assert.ok(0.89 / desktop.y > 1.30, `desktop vertical density ${0.89 / desktop.y}`);
});

test("outer long tentacles recede without dimming central strands", () => {
  const central = tentaclePresenceScale({
    arm: false,
    offset: 0.18,
    chain: { count: 76 },
  });
  const outerLong = tentaclePresenceScale({
    arm: false,
    offset: 0.94,
    chain: { count: 76 },
  });
  const outerShort = tentaclePresenceScale({
    arm: false,
    offset: 0.94,
    chain: { count: 54 },
  });
  assert.equal(central, 1);
  assert.ok(outerLong < 0.76, `outer long scale ${outerLong}`);
  assert.ok(outerShort > outerLong + 0.18, `outer short ${outerShort} vs long ${outerLong}`);
});

test("material transmission increases toward the lower bell", () => {
  const crown = bellTransmissionAt(-0.90);
  const middle = bellTransmissionAt(-0.50);
  const lower = bellTransmissionAt(-0.10);
  assert.ok(crown < 0.07, `crown transmission ${crown}`);
  assert.ok(middle > crown + 0.06, `middle ${middle} crown ${crown}`);
  assert.ok(lower > 0.22, `lower transmission ${lower}`);
});

test("thin-tentacle cyan accents are sparse, stable and non-periodic", () => {
  const item = { phase: 2.3, offset: -0.6 };
  assert.equal(tentacleAccentStrength(item, 0.40, 30), 0);

  const accents = [];
  for (let i = 42; i < 76; i += 1) {
    const along = i / 75;
    accents.push(tentacleAccentStrength(item, along, i));
  }
  const visible = accents.filter((value) => value > 0.10);
  assert.ok(visible.length >= 2 && visible.length <= 8, `accent count ${visible.length}`);
  assert.ok(Math.max(...visible) > 0.70, `strongest accent ${Math.max(...visible)}`);
  assert.equal(
    tentacleAccentStrength(item, 60 / 75, 60),
    tentacleAccentStrength(item, 60 / 75, 60),
  );
});

test("skirt depth lighting creates stable foreground and rear fragments", () => {
  const samples = [];
  for (let i = 0; i <= 120; i += 1) {
    const u = -0.89 + (1.78 * i) / 120;
    samples.push(skirtDepthLightAt(u, 1.2));
  }
  assert.ok(Math.min(...samples) < 0.66, `minimum depth light ${Math.min(...samples)}`);
  assert.ok(Math.max(...samples) > 1.02, `maximum depth light ${Math.max(...samples)}`);
  assert.ok(
    Math.max(...samples) - Math.min(...samples) > 0.40,
    "skirt depth field should have visible range",
  );
  assert.equal(skirtDepthLightAt(0.31, 1.2), skirtDepthLightAt(0.31, 1.2));
});

test("depth-aware roots emerge from the bell instead of hanging from a point", () => {
  const rear = { arm: false, layer: -0.7 };
  const middle = { arm: false, layer: 0.1 };
  const front = { arm: false, layer: 0.8 };
  assert.ok(rootEmergenceScale(rear, 0) < rootEmergenceScale(middle, 0));
  assert.ok(rootEmergenceScale(middle, 0) < rootEmergenceScale(front, 0));
  assert.ok(rootEmergenceScale(rear, 0.18) > 0.95);
  assert.ok(rootEmergenceScale(middle, 0.20) > 0.95);

  const rearTentacle = internalRootOpacityAt(rear, -0.10);
  const rearArm = internalRootOpacityAt({ arm: true, layer: -0.7 }, -0.10);
  const middleTentacle = internalRootOpacityAt(middle, -0.10);
  assert.ok(rearTentacle > 0.08, `rear tentacle opacity ${rearTentacle}`);
  assert.ok(rearArm > rearTentacle, `rear arm ${rearArm} tentacle ${rearTentacle}`);
  assert.ok(middleTentacle > 0 && middleTentacle < rearTentacle);
  assert.equal(internalRootOpacityAt(front, -0.10), 0);
  assert.equal(internalRootOpacityAt(rear, -0.50), 0);
});

test("skirt membrane stays broken, brightness-varied and pulse-responsive", () => {
  const samples = [];
  for (let i = 0; i <= 120; i += 1) {
    const u = -0.89 + (1.78 * i) / 120;
    samples.push(skirtMembraneAt(u, 0.25, 1.2, 20, 0.08));
  }
  const visible = samples.filter((sample) => sample.visible);
  const ratio = visible.length / samples.length;
  assert.ok(ratio > 0.62 && ratio < 0.82, `visible ratio ${ratio}`);

  const intensities = visible.map((sample) => sample.intensity);
  const span = Math.max(...intensities) - Math.min(...intensities);
  assert.ok(span > 0.32, `intensity span ${span}`);
  assert.ok(visible.filter((sample) => sample.frill).length >= 3, "expected sparse frills");

  const relaxed = skirtMembraneAt(0.28, 0, 1.2, 20, 0.08);
  const contracted = skirtMembraneAt(0.28, 1, 1.2, 20, 0.08);
  assert.ok(
    contracted.offset < relaxed.offset - 0.007,
    `pulse offsets ${contracted.offset}, ${relaxed.offset}`,
  );

  const middleEdge = skirtMembraneAt(0.64, 0.2, 1.2, 20, 0.04);
  const outerEdge = skirtMembraneAt(0.89, 0.2, 1.2, 20, 0.04);
  assert.ok(
    !outerEdge.visible || outerEdge.intensity < middleEdge.intensity * 0.45,
    `skirt edge did not fade: outer=${outerEdge.intensity} middle=${middleEdge.intensity}`,
  );

  const calm = skirtMembraneAt(0.72, 0.2, 1.2, 20, 0);
  const current = skirtMembraneAt(0.72, 0.2, 1.2, 20, 0.11);
  assert.ok(
    Math.abs(current.offset - calm.offset) > 0.001,
    `current response ${current.offset - calm.offset}`,
  );
});
