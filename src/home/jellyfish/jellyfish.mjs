import { JELLY_PALETTE, SIMULATION } from "./config.mjs";
import { fluidSensitivityFor, oralArmBillowAt } from "./fluid.mjs";
import { clamp, invLerp, lerp, mulberry32, range, rotate, smoothstep, TAU } from "./math.mjs";
import { pulseEnvelope, pulseVelocity } from "./pulse.mjs";
import { VerletChain } from "./physics.mjs";

export function heroSizeFor(width, height) {
  if (height < 420) {
    const widthFactor = width < 620 ? 0.50 : 0.265;
    return clamp(Math.min(width * widthFactor, height * 0.38), 64, 296);
  }
  const widthFactor = width < 620 ? 0.47 : 0.245;
  // V4.5 backs the specimen off by roughly 7–8% in normal viewports while
  // preserving the already-stable compact-landscape anatomy scale.
  return clamp(Math.min(width * widthFactor, height * 0.355), 64, 296);
}

export function topClearanceFor(height) {
  return clamp(height * 0.055, 18, 56);
}

function homeYFor(width, height) {
  if (height < 420) return height * 0.34;
  return height * (width < 620 ? 0.31 : 0.35);
}

function bellAnchor(jelly, offset, yOffset = 0) {
  const width = jelly.bellWidth();
  const local = rotate(offset * width * 0.43, jelly.bellHeight() * (0.02 + yOffset), jelly.tilt);
  return { x: jelly.x + local.x, y: jelly.y + local.y };
}

const TENTACLE_PATTERN = Object.freeze([
  -0.95, -0.84, -0.79, -0.63, -0.51, -0.44, -0.22, -0.10,
   0.04,  0.24,  0.31,  0.47,  0.61,  0.70,  0.86,  0.94,
]);

const DEPTH_PATTERN = Object.freeze([-1.15, -0.65, 0.18, 0.92, -0.28, 0.54]);

export class Jellyfish {
  constructor({ width, height, seed = 1, random = mulberry32(seed) }) {
    this.random = random;
    this.seed = seed;
    this.baseSize = heroSizeFor(width, height) * range(random, 0.985, 1.02);
    this.anatomyScale = clamp(this.baseSize / 250, 0.30, 1.28);
    this.aspect = range(random, 1.13, 1.19);
    this.homeX = width * 0.5;
    this.homeY = homeYFor(width, height);
    this.x = this.homeX + range(random, -width * 0.018, width * 0.018);
    this.y = this.homeY + range(random, -height * 0.018, height * 0.018);
    this.vx = range(random, -1.8, 1.8);
    this.vy = range(random, -1.2, 1.2);
    this.tilt = range(random, -0.03, 0.03);
    this.phase = random();
    this.period = range(random, 3.15, 4.35);
    this.previousPulse = pulseEnvelope(this.phase);
    this.pulse = this.previousPulse;
    this.thrust = range(random, 8.8, 11.6);
    this.settle = range(random, 1.08, 1.38);
    this.twist = range(random, 0, TAU);
    this.anatomyPhase = range(random, 0, TAU);
    this.palette = JELLY_PALETTE;
    this.chains = [];
    this.#buildChains();
  }

  bellWidth() {
    return this.baseSize * this.aspect * (1 - 0.18 * this.pulse);
  }

  bellHeight() {
    return this.baseSize * (0.50 + 0.095 * this.pulse);
  }

  #makeBranch(parent, branchIndex) {
    const random = this.random;
    const branchAt = range(random, 0.38, 0.66);
    const anchorIndex = Math.max(2, Math.min(parent.chain.count - 3, Math.round(branchAt * (parent.chain.count - 1))));
    const anchorX = parent.chain.x[anchorIndex];
    const anchorY = parent.chain.y[anchorIndex];
    const side = random() < 0.5 ? -1 : 1;
    const chain = new VerletChain({
      anchorX,
      anchorY,
      segments: Math.round(range(random, 10, 18)),
      segmentLength: range(random, 4.4, 5.7) * this.anatomyScale,
      damping: range(random, 0.985, 0.991),
      gravity: range(random, 7.0, 9.5),
      seed: this.seed + 700 + branchIndex * 23.7,
      bend: range(random, 0.5, 1.3) * side * this.anatomyScale,
      bendStiffness: range(random, 0.028, 0.052),
      bendFrequency: range(random, 0.7, 1.35),
      bendPhase: range(random, 0, TAU),
    });
    return {
      chain,
      anchorIndex,
      branchAt,
      side,
      width: parent.width * range(random, 0.36, 0.58),
      phase: range(random, 0, TAU),
      bright: parent.bright * range(random, 0.72, 0.95),
      layer: parent.layer + side * 0.08,
      forceScale: parent.forceScale * range(random, 0.94, 1.16),
      twistRate: range(random, 1.6, 3.4),
      twistPhase: range(random, 0, TAU),
      ruffleLeft: range(random, 0.8, 1.45),
      ruffleRight: range(random, 0.8, 1.45),
    };
  }

  #addChain({ arm, offset, index, layer, branch = false }) {
    const random = this.random;
    const segments = arm
      ? Math.round(range(random, 30, 43))
      : Math.round(range(random, 50, 76));
    const segmentLength = (arm
      ? range(random, 4.6, 6.1)
      : range(random, 4.35, 5.55)) * this.anatomyScale;
    const armLengthBias = arm
      ? smoothstep(invLerp(
          this.baseSize * 0.58,
          this.baseSize * 0.92,
          segments * segmentLength,
        ))
      : 0;
    const anchor = bellAnchor(this, offset, arm ? 0.052 : 0.014);
    const expressiveTentacle = !arm && (index === 3 || index === 11);
    const hookSign = random() < 0.5 ? -1 : 1;
    const chain = new VerletChain({
      anchorX: anchor.x,
      anchorY: anchor.y,
      segments,
      segmentLength,
      damping: arm ? range(random, 0.984, 0.990) : range(random, 0.9885, 0.9925),
      gravity: arm ? range(random, 7.8, 10.6) : range(random, 13.5, 18.0),
      seed: this.seed + index * 13.17,
      bend: (arm
        ? range(random, -0.65, 0.65)
        : range(random, expressiveTentacle ? 0.30 : 0.18, expressiveTentacle ? 0.56 : 0.62)
          * (random() < 0.5 ? -1 : 1)) * this.anatomyScale,
      bendStiffness: arm
        ? range(random, 0.007, 0.016)
        : range(random, expressiveTentacle ? 0.008 : 0.010, expressiveTentacle ? 0.014 : 0.020),
      bendFrequency: arm
        ? range(random, 0.52, 0.88)
        : range(random, expressiveTentacle ? 0.36 : 0.62, expressiveTentacle ? 0.52 : 0.96),
      bendPhase: range(random, 0, TAU),
      tipDrag: arm
        ? range(random, 0.002, 0.005)
        : range(random, expressiveTentacle ? 0.020 : 0.014, expressiveTentacle ? 0.026 : 0.021),
      // Oral arms stay much freer than thin tentacles, but long sheets
      // need progressively stronger protection against hairpins/self-wrapping.
      maxBendAngle: arm
        ? lerp(1.18, 0.94, armLengthBias) * range(random, 0.96, 1.04)
        : range(random, 0.43, expressiveTentacle ? 0.50 : 0.54),
      bendLimitStiffness: arm
        ? lerp(0.18, 0.28, armLengthBias) * range(random, 0.95, 1.05)
        : range(random, 0.72, 0.84),
      maxTotalTurn: arm
        ? Math.PI * lerp(1.38, 1.08, armLengthBias) * range(random, 0.97, 1.03)
        : range(random, expressiveTentacle ? 2.48 : 2.42, expressiveTentacle ? 2.68 : 2.72),
      totalTurnStiffness: arm
        ? lerp(0.14, 0.24, armLengthBias) * range(random, 0.95, 1.05)
        : range(random, 0.78, 0.88),
    });
    const item = {
      chain,
      arm,
      offset,
      layer,
      phase: range(random, 0, TAU),
      forceScale: arm
        ? range(random, 0.64, 0.90)
        : range(random, expressiveTentacle ? 0.72 : 0.82, expressiveTentacle ? 0.94 : 1.18),
      lengthBias: arm ? armLengthBias : 0,
      width: (arm ? range(random, 3.0, 5.15) : range(random, 0.70, 1.04)) * this.anatomyScale,
      curl: range(random, -1, 1),
      bright: arm ? range(random, 0.78, 1.09) : range(random, 0.56, 1.03),
      fray: range(random, 0.5, 1),
      memoryPhase: range(random, 0, TAU),
      memoryWaves: arm
        ? range(random, 0.48, 0.82)
        : range(random, expressiveTentacle ? 0.38 : 0.55, expressiveTentacle ? 0.52 : 0.84),
      memoryStrength: (arm
        ? range(random, 2.2, 4.5)
        : range(random, expressiveTentacle ? 1.8 : 1.1, expressiveTentacle ? 2.7 : 2.5)) * this.anatomyScale,
      tipHook: (arm
        ? range(random, -4, 4) * lerp(1, 0.35, armLengthBias)
        : hookSign * range(random, expressiveTentacle ? 1.8 : 1.2, expressiveTentacle ? 3.2 : 3.4)) * this.anatomyScale,
      expressiveTentacle,
      expressiveShape: expressiveTentacle ? hookSign * 2.6 * this.anatomyScale : 0,
      twistRate: arm ? range(random, 1.35, 3.35) : 0,
      twistPhase: arm ? range(random, 0, TAU) : 0,
      ruffleLeft: arm ? range(random, 0.95, 1.72) : 0,
      ruffleRight: arm ? range(random, 0.95, 1.72) : 0,
      edgePhaseLeft: arm ? range(random, 0, TAU) : 0,
      edgePhaseRight: arm ? range(random, 0, TAU) : 0,
      branches: [],
    };
    this.chains.push(item);
    if (arm && branch) item.branches.push(this.#makeBranch(item, index));
    return item;
  }

  #buildChains() {
    const random = this.random;
    const tentacleCount = 15 + Math.floor(random() * 2);
    const armCount = 7;
    let index = 0;

    // Uneven roots create clusters and gaps like the reference. Even spacing is
    // one of the quickest ways for generated tentacles to reveal themselves.
    const start = tentacleCount === 15 ? 1 : 0;
    for (let i = 0; i < tentacleCount; i += 1) {
      const patternIndex = Math.min(TENTACLE_PATTERN.length - 1, i + start);
      const offset = TENTACLE_PATTERN[patternIndex] + range(random, -0.018, 0.018);
      const layer = DEPTH_PATTERN[i % DEPTH_PATTERN.length] + range(random, -0.10, 0.10);
      this.#addChain({ arm: false, offset, index: index++, layer });
    }

    // Oral-arm roots are intentionally not a fan. The uneven placement and
    // depth ordering make the central tissue hard to count at a glance.
    const armOffsets = [-0.43, -0.30, -0.125, 0.015, 0.17, 0.32, 0.43];
    const branchingArms = new Set([1, 3, 5]);
    for (let i = 0; i < armCount; i += 1) {
      const offset = armOffsets[i] + range(random, -0.018, 0.018);
      const layer = [-0.42, 0.74, -0.08, 0.96, 0.18, -0.62, 0.52][i];
      this.#addChain({ arm: true, offset, index: index++, layer, branch: branchingArms.has(i) });
    }
  }

  trailLength() {
    let longest = 0;
    for (const item of this.chains) {
      longest = Math.max(longest, (item.chain.count - 1) * item.chain.segmentLength);
    }
    return longest;
  }

  resize(oldWidth, oldHeight, width, height) {
    const sx = width / Math.max(1, oldWidth);
    const sy = height / Math.max(1, oldHeight);
    const oldX = this.x;
    const oldY = this.y;
    this.x *= sx;
    this.y *= sy;
    this.homeX = width * 0.5;
    this.homeY = homeYFor(width, height);
    const dx = this.x - oldX;
    const dy = this.y - oldY;
    for (const item of this.chains) {
      item.chain.translate(dx, dy);
      for (const branch of item.branches) branch.chain.translate(dx, dy);
    }

    const target = heroSizeFor(width, height);
    const factor = clamp(target / this.baseSize, 0.30, 3.20);
    if (Math.abs(factor - 1) > 0.02) {
      for (const item of this.chains) {
        item.chain.scaleAround(this.x, this.y, factor);
        item.width *= factor;
        item.memoryStrength *= factor;
        item.tipHook *= factor;
        for (const branch of item.branches) {
          branch.chain.scaleAround(this.x, this.y, factor);
          branch.width *= factor;
        }
      }
      this.baseSize *= factor;
      this.anatomyScale = clamp(this.baseSize / 250, 0.30, 1.28);
    }
  }

  #chainForce(item, anchor, ocean, time, x, y, along) {
    const armLengthBias = item.arm ? (item.lengthBias ?? 0) : 0;
    const sensitivity = fluidSensitivityFor(item, along);
    const localFlow = ocean.sample(x, y, time, sensitivity);
    const loosen = along * along;

    // Wake motion stays broad and slow. The water field provides the fine
    // variation; this term only preserves a readable trailing rhythm.
    const distalEase = item.arm
      ? 1 - armLengthBias * smoothstep(invLerp(0.72, 1, along)) * 0.08
      : 1;
    const wake = Math.sin(
      time * (item.arm ? 0.44 : 0.68)
        + item.phase
        + along * (item.arm ? 3.4 : 5.6),
    ) * (item.arm ? 4.0 : 4.7) * loosen * this.anatomyScale * distalEase;
    const billow = oralArmBillowAt(item, time, along, this.anatomyScale);

    // Thin tentacles keep a stable broad memory curve. Oral arms instead carry
    // that memory slowly downstream, so their whole body billows rather than
    // holding one leaf-like pose indefinitely.
    const memoryPhase = item.memoryPhase + (item.arm ? time * 0.20 : 0);
    const memory = Math.sin(memoryPhase + along * item.memoryWaves * TAU)
      * item.memoryStrength
      * smoothstep(along)
      * (0.30 + along * 0.50)
      * (item.arm ? lerp(1, 0.96, armLengthBias * smoothstep(along)) : 1);
    const expressiveShape = item.expressiveTentacle
      ? Math.sin((along - 0.18) * Math.PI * 1.55 + item.memoryPhase * 0.18)
        * item.expressiveShape * Math.sin(Math.PI * along)
      : 0;
    const tip = smoothstep(clamp((along - 0.72) / 0.28, 0, 1));
    const tipHook = item.tipHook * tip * tip;
    const curl = item.curl * Math.sin(along * Math.PI) * (item.arm ? 4.3 : 2.2) * this.anatomyScale;
    const trailingBias = item.arm ? 0 : 3.8 * along * along * this.anatomyScale;
    const guard = this.#trailGuard(item, anchor, x, y, along);

    return {
      x:
        localFlow.x
        + wake
        + billow
        + memory
        + expressiveShape
        + tipHook
        + curl
        + guard.x,
      y: localFlow.y + Math.max(0, -this.vy) * 0.66 * along + trailingBias + guard.y,
    };
  }

  #trailGuard(item, anchor, x, y, along) {
    const length = (item.chain.count - 1) * item.chain.segmentLength;
    const maxRise = this.baseSize * (item.arm ? 0.15 : 0.11);
    const maxSide = Math.min(
      length * (item.arm ? 0.68 : 0.76),
      this.baseSize * (item.arm ? 0.96 : 1.14),
    );
    const riseAllowance = maxRise * (0.42 + along * 0.58);
    const sideAllowance = maxSide * (0.20 + Math.pow(along, 0.72) * 0.80);
    const riseDelta = anchor.y - y;
    const sideDelta = x - anchor.x;
    const riseRatio = Math.max(0, riseDelta) / Math.max(1, riseAllowance);
    const sideRatio = Math.abs(sideDelta) / Math.max(1, sideAllowance);
    const riseSoft = smoothstep(invLerp(0.72, 1.02, riseRatio));
    const sideSoft = smoothstep(invLerp(0.74, 1.02, sideRatio));
    const riseExcess = Math.max(0, riseDelta - riseAllowance);
    const sideExcess = Math.max(0, Math.abs(sideDelta) - sideAllowance);

    // Apply resistance before the hard envelope. clipTrailEnvelope remains the
    // emergency boundary, but normal motion should feel like water resistance
    // rather than a chain suddenly hitting an invisible wall.
    return {
      x:
        -Math.sign(sideDelta)
        * (
          sideSoft * (item.arm ? 4.2 : 5.2)
          + Math.min(24, sideExcess * (item.arm ? 1.7 : 2.2))
        ),
      y:
        riseSoft * (item.arm ? 4.5 : 5.8)
        + Math.min(24, riseExcess * (item.arm ? 1.9 : 2.5)),
    };
  }

  step(dt, time, ocean, width, height) {
    this.phase = (this.phase + dt / this.period) % 1;
    const pulse = pulseEnvelope(this.phase);
    const pulseDelta = pulseVelocity(this.previousPulse, pulse);
    this.previousPulse = pulse;
    this.pulse = pulse;

    const flow = ocean.sample(this.x, this.y, time, 0.13);

    // The bell is the heaviest part of the animal: current direction influences
    // its attitude, but only after a slow inertial lag. Tentacles/ribbons still
    // reveal a reversal first; the bell commits last and settles upright in calm.
    const targetTilt = clamp(flow.x * 0.032 + this.vx * 0.0035, -0.115, 0.115);
    this.tilt += (targetTilt - this.tilt) * (1 - Math.exp(-0.62 * dt));

    this.vx += flow.x * 0.030 * dt;
    this.vy += (this.settle + flow.y * 0.018) * dt;
    if (pulseDelta > 0) this.vy -= pulseDelta * this.thrust;

    const targetX = this.homeX + Math.sin(time * 0.038 + this.twist) * width * 0.032;
    const targetY = this.homeY + Math.sin(time * 0.049 + this.anatomyPhase) * height * 0.032;
    this.vx += (targetX - this.x) * 0.0080 * dt;
    this.vy += (targetY - this.y) * 0.030 * dt;

    const topClearance = topClearanceFor(height);
    const tiltLift = Math.abs(Math.sin(this.tilt)) * this.bellWidth() * 0.50;
    const minimumCenterY = this.bellHeight() + topClearance + tiltLift;
    const softCeilingY = minimumCenterY + Math.max(26, this.bellHeight() * 0.30);
    if (this.y < softCeilingY) {
      const proximity = 1 - clamp((this.y - minimumCenterY) / Math.max(1, softCeilingY - minimumCenterY), 0, 1);
      this.vy += (7 + 16 * proximity) * proximity * dt;
    }

    this.vx *= Math.exp(-0.22 * dt);
    this.vy *= Math.exp(-0.115 * dt);
    this.vx = clamp(this.vx, -10.5, 10.5);
    this.vy = clamp(this.vy, -13.2, 9.3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const marginX = this.bellWidth() * 0.6;
    const minX = marginX;
    const maxX = width - marginX;
    if (this.x < minX) this.vx += (minX - this.x) * 0.06 * dt;
    if (this.x > maxX) this.vx -= (this.x - maxX) * 0.06 * dt;
    const minY = minimumCenterY;
    const maxY = Math.max(minY, height - this.trailLength() * 0.82);
    if (this.y < minY) {
      this.y = minY;
      if (this.vy < 0) this.vy = 0;
    }
    if (this.y > maxY) this.vy -= (this.y - maxY) * 0.14 * dt;

    for (const item of this.chains) {
      const anchor = bellAnchor(this, item.offset, item.arm ? 0.052 : 0.014);
      item.chain.step(
        dt,
        anchor.x,
        anchor.y,
        (x, y, along) => this.#chainForce(item, anchor, ocean, time, x, y, along),
        SIMULATION.constraintIterations,
      );
      const chainLength = (item.chain.count - 1) * item.chain.segmentLength;
      item.chain.clipTrailEnvelope(anchor.x, anchor.y, {
        maxRise: this.baseSize * (item.arm ? 0.15 : 0.11),
        maxSide: Math.min(
          chainLength * (item.arm ? 0.68 : 0.76),
          this.baseSize * (item.arm ? 0.96 : 1.14),
        ),
        maxDrop: chainLength * 1.05,
      });

      for (const branch of item.branches) {
        const i = Math.min(item.chain.count - 1, branch.anchorIndex);
        const bx = item.chain.x[i];
        const by = item.chain.y[i];
        branch.chain.step(
          dt,
          bx,
          by,
          (x, y, along) => {
            const flow = ocean.sample(x, y, time, lerp(0.30, branch.forceScale, along * along));
            const sideWave =
              branch.side
              * Math.sin(branch.phase + time * 0.46 + along * 6.2)
              * 4.5
              * along
              * this.anatomyScale;
            const branchLength = (branch.chain.count - 1) * branch.chain.segmentLength;
            const maxSide = Math.min(branchLength * 0.74, this.baseSize * 0.62);
            const riseAllowance = this.baseSize * 0.13 * (0.42 + along * 0.58);
            const sideAllowance = maxSide * (0.20 + Math.pow(along, 0.72) * 0.80);
            const riseExcess = Math.max(0, by - y - riseAllowance);
            const sideDelta = x - bx;
            const sideExcess = Math.max(0, Math.abs(sideDelta) - sideAllowance);
            return {
              x: flow.x + sideWave + branch.side * 5.5 * smoothstep(along) * this.anatomyScale
                - Math.sign(sideDelta) * Math.min(28, sideExcess * 2.4),
              y: flow.y + Math.max(0, -this.vy) * 0.52 * along + Math.min(28, riseExcess * 2.6),
            };
          },
          Math.max(4, SIMULATION.constraintIterations - 1),
        );
        const branchLength = (branch.chain.count - 1) * branch.chain.segmentLength;
        branch.chain.clipTrailEnvelope(bx, by, {
          maxRise: this.baseSize * 0.13,
          maxSide: Math.min(branchLength * 0.74, this.baseSize * 0.62),
          maxDrop: branchLength * 1.05,
        });
      }
    }
  }
}
