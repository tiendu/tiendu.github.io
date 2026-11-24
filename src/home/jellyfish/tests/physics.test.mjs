import test from "node:test";
import assert from "node:assert/strict";
import { renderFpsFor } from "../config.mjs";
import {
  bellGridScaleFor,
  bellPoreThresholdAt,
  bellProfileAt,
  bellRimAt,
  skirtMembraneAt,
  tentaclePresenceScale,
  rootEmergenceScale,
  internalRootOpacityAt,
} from "../renderer.mjs";
import { heroSizeFor, topClearanceFor } from "../jellyfish.mjs";
import { currentWeather, OceanField } from "../ocean.mjs";
import { VerletChain } from "../physics.mjs";
import { pulseEnvelope } from "../pulse.mjs";
import { JellyWorld } from "../world.mjs";

function anatomyBounds(jelly) {
  let minX = jelly.x - jelly.bellWidth() * 0.5;
  let maxX = jelly.x + jelly.bellWidth() * 0.5;
  let minY = jelly.y - jelly.bellHeight();
  let maxY = jelly.y;
  for (const item of jelly.chains) {
    for (let i = 0; i < item.chain.count; i += 1) {
      minX = Math.min(minX, item.chain.x[i]);
      maxX = Math.max(maxX, item.chain.x[i]);
      minY = Math.min(minY, item.chain.y[i]);
      maxY = Math.max(maxY, item.chain.y[i]);
    }
    for (const branch of item.branches) {
      for (let i = 0; i < branch.chain.count; i += 1) {
        minX = Math.min(minX, branch.chain.x[i]);
        maxX = Math.max(maxX, branch.chain.x[i]);
        minY = Math.min(minY, branch.chain.y[i]);
        maxY = Math.max(maxY, branch.chain.y[i]);
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function assertFiniteAnatomy(jelly) {
  assert.ok(Number.isFinite(jelly.x));
  assert.ok(Number.isFinite(jelly.y));
  for (const item of jelly.chains) {
    for (let i = 0; i < item.chain.count; i += 1) {
      assert.ok(Number.isFinite(item.chain.x[i]));
      assert.ok(Number.isFinite(item.chain.y[i]));
    }
    for (const branch of item.branches) {
      for (let i = 0; i < branch.chain.count; i += 1) {
        assert.ok(Number.isFinite(branch.chain.x[i]));
        assert.ok(Number.isFinite(branch.chain.y[i]));
      }
    }
  }
}

test("pulse contracts quickly and releases over a longer interval", () => {
  assert.ok(pulseEnvelope(0.16) > 0.9);
  assert.ok(pulseEnvelope(0.30) > pulseEnvelope(0.52));
  assert.equal(pulseEnvelope(0.8), 0);
});

test("verlet constraints keep a tentacle near its requested segment length", () => {
  const chain = new VerletChain({ anchorX: 20, anchorY: 10, segments: 18, segmentLength: 6, seed: 4 });
  for (let n = 0; n < 120; n += 1) {
    chain.step(1 / 60, 20 + Math.sin(n / 18) * 3, 10, () => ({ x: 28, y: -3 }), 6);
  }
  assert.ok(chain.maxConstraintError() < 1.0, `constraint error ${chain.maxConstraintError()}`);
});

test("bend limiting prevents a thin chain from winding into tight circles", () => {
  const chain = new VerletChain({
    anchorX: 40,
    anchorY: 18,
    segments: 52,
    segmentLength: 5,
    damping: 0.991,
    gravity: 15,
    bend: 0.55,
    bendStiffness: 0.018,
    bendFrequency: 0.82,
    bendPhase: 1.2,
    tipDrag: 0.018,
    maxBendAngle: 0.50,
    bendLimitStiffness: 0.80,
    maxTotalTurn: 2.85,
    totalTurnStiffness: 0.84,
  });
  for (let n = 0; n < 900; n += 1) {
    const phase = n / 150;
    chain.step(
      1 / 60,
      40 + Math.sin(phase * 0.7) * 4,
      18,
      (_x, _y, along) => ({
        x: Math.sin(phase + along * 2.4) * 34 * along * along,
        y: 2.5 * along * along,
      }),
      6,
    );
  }
  assert.ok(chain.maxTurnAngle() < 0.72, `turn angle ${chain.maxTurnAngle()}`);
  assert.ok(Math.abs(chain.signedTurn()) < 3.10, `signed turn ${chain.signedTurn()}`);
});


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

test("world contains one detailed specimen with long tentacles and ribbon oral arms", () => {
  const world = new JellyWorld(1200, 760, 991);
  assert.equal("jellies" in world, false);
  const jelly = world.jelly;
  const tentacles = jelly.chains.filter((item) => !item.arm);
  const arms = jelly.chains.filter((item) => item.arm);
  assert.ok(jelly.bellWidth() > 220, `bell width ${jelly.bellWidth()}`);
  assert.ok(tentacles.length >= 14, `tentacles ${tentacles.length}`);
  assert.equal(arms.length, 7);
  assert.ok(Math.max(...tentacles.map((item) => item.chain.count)) >= 50);
  assert.ok(Math.max(...arms.map((item) => item.chain.count)) >= 30);
  assert.ok(Math.min(...arms.map((item) => item.offset)) < -0.35);
  assert.ok(Math.max(...arms.map((item) => item.offset)) > 0.35);
  assert.ok(
    Math.max(...arms.map((item) => item.offset)) - Math.min(...arms.map((item) => item.offset)) > 0.82,
    "oral-arm roots should spread beyond the central bouquet",
  );
  assert.equal(arms.reduce((sum, item) => sum + item.branches.length, 0), 3);
  assert.ok(arms.every((item) => item.twistRate > 1));
  assert.ok(arms.every((item) => item.width >= 2.5));
  assert.equal(tentacles.filter((item) => item.expressiveTentacle).length, 2);
  assert.ok(tentacles.every((item) => item.chain.tipDrag >= 0.014));
  assert.ok(tentacles.every((item) => item.chain.maxBendAngle <= 0.54));
  assert.ok(tentacles.every((item) => item.chain.maxTotalTurn <= 3.02));
});

test("ocean weather has calm transitions plus meaningful left and right currents", () => {
  let minX = Infinity;
  let maxX = -Infinity;
  let calmest = Infinity;
  for (let time = 0; time <= 1800; time += 1) {
    const weather = currentWeather(time);
    minX = Math.min(minX, weather.x);
    maxX = Math.max(maxX, weather.x);
    calmest = Math.min(calmest, weather.strength);
  }
  assert.ok(minX < -10, `left current ${minX}`);
  assert.ok(maxX > 10, `right current ${maxX}`);
  assert.ok(calmest < 0.25, `calmest strength ${calmest}`);

  for (const time of [20, 220, 520, 900, 1250]) {
    const a = currentWeather(time);
    const b = currentWeather(time + 0.05);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 0.2, `weather jump at ${time}`);
  }
});

test("pointer disturbance is clamped below a disruptive impulse", () => {
  const ocean = new OceanField(1000, 600);
  const before = ocean.sample(500, 300, 100, 1);
  ocean.disturb(500, 300, 10_000, -10_000);
  const after = ocean.sample(500, 300, 100, 1);
  const delta = Math.hypot(after.x - before.x, after.y - before.y);
  assert.ok(delta < 20, `pointer impulse ${delta}`);
  assert.equal(ocean.pointer.vx, 100);
  assert.equal(ocean.pointer.vy, -100);
});

test("compact and short viewports use the lower render budget", () => {
  assert.equal(renderFpsFor(390, 700), 24);
  assert.equal(renderFpsFor(844, 270), 24);
  assert.equal(renderFpsFor(1200, 760), 30);
});

test("anatomy scales with height and survives portrait-landscape-portrait resize", () => {
  assert.ok(heroSizeFor(844, 180) < 72);
  assert.ok(heroSizeFor(844, 270) < 110);
  assert.ok(heroSizeFor(320, 420) <= 165);
  assert.ok(heroSizeFor(1200, 760) > 250);

  const world = new JellyWorld(390, 700, 42);
  for (let n = 0; n < 300; n += 1) world.step(1 / 60);
  const portraitSize = world.jelly.baseSize;

  world.resize(844, 180);
  for (let n = 0; n < 900; n += 1) world.step(1 / 60);
  assertFiniteAnatomy(world.jelly);
  const landscape = anatomyBounds(world.jelly);
  assert.ok(world.jelly.baseSize < portraitSize * 0.45, `landscape size ${world.jelly.baseSize}`);
  assert.ok(landscape.minY > -16, `landscape top ${landscape.minY}`);
  assert.ok(landscape.maxY < 180 + 18, `landscape bottom ${landscape.maxY}`);

  world.resize(390, 700);
  for (let n = 0; n < 900; n += 1) world.step(1 / 60);
  assertFiniteAnatomy(world.jelly);
  assert.ok(world.jelly.baseSize > 180, `restored size ${world.jelly.baseSize}`);
});



test("V4.5 keeps the specimen slightly smaller and the crown below the stage ceiling", () => {
  assert.ok(heroSizeFor(1200, 760) > 260 && heroSizeFor(1200, 760) < 280);
  assert.ok(heroSizeFor(390, 700) > 175 && heroSizeFor(390, 700) < 190);
  // Keep the already-stable tiny landscape scale instead of shrinking it further.
  assert.equal(heroSizeFor(844, 180), 68.4);

  const world = new JellyWorld(960, 620, 123456);
  let minCrown = Infinity;
  for (let n = 0; n < 7200; n += 1) {
    world.step(1 / 60);
    const tiltLift = Math.abs(Math.sin(world.jelly.tilt)) * world.jelly.bellWidth() * 0.50;
    minCrown = Math.min(minCrown, world.jelly.y - world.jelly.bellHeight() - tiltLift);
  }
  assert.ok(minCrown >= topClearanceFor(620) - 0.01, `crown ${minCrown}`);
});

test("V4.5 trail envelope prevents a sustained current from flinging strands above or away from the animal", () => {
  const world = new JellyWorld(1000, 700, 444);
  world.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({
    x: 60 * sensitivity,
    y: -42 * sensitivity,
  });

  for (let n = 0; n < 1200; n += 1) world.step(1 / 60);
  const jelly = world.jelly;
  assertFiniteAnatomy(jelly);

  for (const item of jelly.chains) {
    const rootX = item.chain.x[0];
    const rootY = item.chain.y[0];
    for (let i = 1; i < item.chain.count; i += 1) {
      assert.ok(item.chain.y[i] >= rootY - jelly.baseSize * 0.18, `main rise ${rootY - item.chain.y[i]}`);
      assert.ok(Math.abs(item.chain.x[i] - rootX) <= jelly.baseSize * 1.20, `main side ${Math.abs(item.chain.x[i] - rootX)}`);
    }
    for (const branch of item.branches) {
      const branchX = branch.chain.x[0];
      const branchY = branch.chain.y[0];
      for (let i = 1; i < branch.chain.count; i += 1) {
        assert.ok(branch.chain.y[i] >= branchY - jelly.baseSize * 0.18, `branch rise ${branchY - branch.chain.y[i]}`);
        assert.ok(Math.abs(branch.chain.x[i] - branchX) <= jelly.baseSize * 0.70, `branch side ${Math.abs(branch.chain.x[i] - branchX)}`);
      }
    }
  }
});

test("single jellyfish and all branch chains remain finite during a long changing-current drift", () => {
  const world = new JellyWorld(960, 620, 123456);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let n = 0; n < 7200; n += 1) {
    if (n === 900) world.disturb(480, 280, 100, -50);
    world.step(1 / 60);
    minY = Math.min(minY, world.jelly.y);
    maxY = Math.max(maxY, world.jelly.y);
  }

  const jelly = world.jelly;
  assertFiniteAnatomy(jelly);
  assert.ok(jelly.x > -80 && jelly.x < 1040, `x ${jelly.x}`);
  assert.ok(jelly.y > 20 && jelly.y < 500, `y ${jelly.y}`);
  assert.ok(maxY - minY > 6, `vertical travel ${maxY - minY}`);
  for (const item of jelly.chains) {
    assert.ok(item.chain.maxConstraintError() < 0.8, `main constraint ${item.chain.maxConstraintError()}`);
    if (!item.arm) {
      assert.ok(item.chain.maxTurnAngle() < 0.78, `tentacle turn ${item.chain.maxTurnAngle()}`);
      assert.ok(Math.abs(item.chain.signedTurn()) < 3.20, `tentacle signed turn ${item.chain.signedTurn()}`);
    }
    for (const branch of item.branches) {
      assert.ok(branch.chain.maxConstraintError() < 0.8, `branch constraint ${branch.chain.maxConstraintError()}`);
    }
  }
});

test("V4.6 gives the bell a denser sub-grid without increasing the whole-scene grid", () => {
  const desktop = bellGridScaleFor(false);
  const compact = bellGridScaleFor(true);
  assert.ok(desktop.x <= 0.64 && desktop.y <= 0.68, `desktop grid ${desktop.x},${desktop.y}`);
  assert.ok(compact.x <= 0.80 && compact.y <= 0.84, `compact grid ${compact.x},${compact.y}`);
  assert.ok(0.84 / desktop.x > 1.30, `desktop horizontal density ${0.84 / desktop.x}`);
  assert.ok(0.89 / desktop.y > 1.30, `desktop vertical density ${0.89 / desktop.y}`);
});

test("V4.6 expressive tentacles use broad shape memory without extra angular freedom", () => {
  const world = new JellyWorld(1200, 760, 991);
  const expressive = world.jelly.chains.filter((item) => item.expressiveTentacle);
  assert.equal(expressive.length, 2);
  for (const item of expressive) {
    assert.ok(item.memoryWaves <= 0.53, `memory waves ${item.memoryWaves}`);
    assert.ok(item.memoryStrength <= 2.8 * world.jelly.anatomyScale, `memory ${item.memoryStrength}`);
    assert.ok(Math.abs(item.tipHook) <= 3.3 * world.jelly.anatomyScale, `hook ${item.tipHook}`);
    assert.ok(item.forceScale <= 0.95, `force scale ${item.forceScale}`);
    assert.ok(item.chain.tipDrag >= 0.019, `tip drag ${item.chain.tipDrag}`);
    assert.ok(item.chain.maxTotalTurn <= 2.70, `total turn ${item.chain.maxTotalTurn}`);
    assert.ok(Math.abs(item.expressiveShape) > 0);
  }
});

test("V4.6 bell tilt follows sustained current with inertia and reverses gradually", () => {
  const world = new JellyWorld(1000, 700, 2026);
  world.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({ x: 18 * sensitivity, y: 0 });
  for (let n = 0; n < 120; n += 1) world.step(1 / 60);
  const rightTilt = world.jelly.tilt;
  assert.ok(rightTilt > 0.025 && rightTilt < 0.115, `right tilt ${rightTilt}`);

  world.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({ x: -18 * sensitivity, y: 0 });
  for (let n = 0; n < 20; n += 1) world.step(1 / 60);
  assert.ok(world.jelly.tilt > -0.005, `tilt reversed too quickly ${world.jelly.tilt}`);
  for (let n = 0; n < 240; n += 1) world.step(1 / 60);
  assert.ok(world.jelly.tilt < -0.025, `left tilt ${world.jelly.tilt}`);
});

test("V4.6 envelope repair keeps segment lengths coherent during hostile current", () => {
  const chain = new VerletChain({
    anchorX: 120,
    anchorY: 80,
    segments: 58,
    segmentLength: 4.8,
    damping: 0.991,
    gravity: 14,
    bend: 0.45,
    bendStiffness: 0.014,
    bendFrequency: 0.48,
    tipDrag: 0.022,
    maxBendAngle: 0.50,
    bendLimitStiffness: 0.80,
    maxTotalTurn: 2.65,
    totalTurnStiffness: 0.84,
  });
  let worst = 0;
  for (let n = 0; n < 900; n += 1) {
    chain.step(1 / 60, 120, 80, (_x, _y, along) => ({
      x: 900 * along * along,
      y: -650 * along * along,
    }), 6);
    chain.clipTrailEnvelope(120, 80, { maxRise: 20, maxSide: 70, maxDrop: 280 });
    worst = Math.max(worst, chain.maxConstraintError());
  }
  assert.ok(worst < 1.2, `worst post-envelope constraint ${worst}`);
});

test("V4.7 outer long tentacles recede without dimming central strands", () => {
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

test("V4.8 depth-aware roots emerge from the bell instead of hanging from a point", () => {
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

test("V4.6.2 skirt is broken, brightness-varied and pulse-responsive", () => {
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

