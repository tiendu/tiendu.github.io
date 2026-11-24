import { hypot2, TAU } from "./math.mjs";

export class VerletChain {
  constructor({
    anchorX,
    anchorY,
    segments,
    segmentLength,
    damping = 0.988,
    gravity = 16,
    seed = 0,
    bend = 0,
    bendStiffness = 0,
    bendFrequency = 1,
    bendPhase = seed,
    tipDrag = 0,
    maxBendAngle = Math.PI,
    bendLimitStiffness = 0.72,
    maxTotalTurn = Math.PI,
    totalTurnStiffness = 0.76,
  }) {
    this.segmentLength = segmentLength;
    this.damping = damping;
    this.gravity = gravity;
    this.seed = seed;
    this.bend = bend;
    this.bendStiffness = bendStiffness;
    this.bendFrequency = bendFrequency;
    this.bendPhase = bendPhase;
    this.tipDrag = Math.max(0, tipDrag);
    this.maxBendAngle = maxBendAngle;
    this.bendLimitStiffness = bendLimitStiffness;
    this.maxTotalTurn = maxTotalTurn;
    this.totalTurnStiffness = totalTurnStiffness;
    this.count = segments + 1;
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.px = new Float32Array(this.count);
    this.py = new Float32Array(this.count);

    for (let i = 0; i < this.count; i += 1) {
      const sway = Math.sin(seed * 1.73 + i * 0.58)
        * Math.min(segmentLength * 0.95, i * segmentLength * 0.036);
      const x = anchorX + sway;
      const y = anchorY + i * segmentLength;
      this.x[i] = this.px[i] = x;
      this.y[i] = this.py[i] = y;
    }
  }

  setAnchor(x, y) {
    this.x[0] = this.px[0] = x;
    this.y[0] = this.py[0] = y;
  }

  translate(dx, dy) {
    for (let i = 0; i < this.count; i += 1) {
      this.x[i] += dx;
      this.px[i] += dx;
      this.y[i] += dy;
      this.py[i] += dy;
    }
  }

  scaleAround(cx, cy, factor) {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    this.segmentLength *= factor;
    this.bend *= factor;
    for (let i = 0; i < this.count; i += 1) {
      this.x[i] = cx + (this.x[i] - cx) * factor;
      this.y[i] = cy + (this.y[i] - cy) * factor;
      this.px[i] = cx + (this.px[i] - cx) * factor;
      this.py[i] = cy + (this.py[i] - cy) * factor;
    }
  }

  #applyDistanceConstraints(anchorX, anchorY) {
    this.x[0] = anchorX;
    this.y[0] = anchorY;

    for (let i = 0; i < this.count - 1; i += 1) {
      const j = i + 1;
      const dx = this.x[j] - this.x[i];
      const dy = this.y[j] - this.y[i];
      const distance = hypot2(dx, dy) || 0.0001;
      const error = (distance - this.segmentLength) / distance;

      if (i === 0) {
        this.x[j] -= dx * error;
        this.y[j] -= dy * error;
      } else {
        const correctionX = dx * error * 0.5;
        const correctionY = dy * error * 0.5;
        this.x[i] += correctionX;
        this.y[i] += correctionY;
        this.x[j] -= correctionX;
        this.y[j] -= correctionY;
      }
    }
  }

  #applyBendMemory() {
    if (this.bendStiffness <= 0 || this.bend === 0 || this.count < 4) return;

    for (let i = 1; i < this.count - 1; i += 1) {
      const u = i / (this.count - 1);
      const px = this.x[i - 1];
      const py = this.y[i - 1];
      const nxp = this.x[i + 1];
      const nyp = this.y[i + 1];
      const chordX = nxp - px;
      const chordY = nyp - py;
      const chord = hypot2(chordX, chordY) || 1;
      const normalX = -chordY / chord;
      const normalY = chordX / chord;
      const envelope = 0.18 + u * u * 0.82;
      const preferred = Math.sin(this.bendPhase + u * this.bendFrequency * TAU) * this.bend * envelope;
      const targetX = (px + nxp) * 0.5 + normalX * preferred;
      const targetY = (py + nyp) * 0.5 + normalY * preferred;
      const correctionX = (targetX - this.x[i]) * this.bendStiffness;
      const correctionY = (targetY - this.y[i]) * this.bendStiffness;
      this.x[i] += correctionX;
      this.y[i] += correctionY;
      if (i > 1) {
        this.x[i - 1] -= correctionX * 0.12;
        this.y[i - 1] -= correctionY * 0.12;
      }
      if (i + 1 < this.count - 1) {
        this.x[i + 1] -= correctionX * 0.12;
        this.y[i + 1] -= correctionY * 0.12;
      }
    }
  }

  #applyBendLimit() {
    if (!(this.maxBendAngle > 0 && this.maxBendAngle < Math.PI) || this.count < 3) return;

    for (let i = 1; i < this.count - 1; i += 1) {
      const prevX = this.x[i - 1];
      const prevY = this.y[i - 1];
      const x = this.x[i];
      const y = this.y[i];
      const nextX = this.x[i + 1];
      const nextY = this.y[i + 1];
      const incoming = Math.atan2(y - prevY, x - prevX);
      const outgoing = Math.atan2(nextY - y, nextX - x);
      let delta = outgoing - incoming;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      if (Math.abs(delta) <= this.maxBendAngle) continue;

      const length = hypot2(nextX - x, nextY - y) || this.segmentLength;
      const targetAngle = incoming + Math.sign(delta) * this.maxBendAngle;
      const targetX = x + Math.cos(targetAngle) * length;
      const targetY = y + Math.sin(targetAngle) * length;
      this.x[i + 1] += (targetX - nextX) * this.bendLimitStiffness;
      this.y[i + 1] += (targetY - nextY) * this.bendLimitStiffness;
    }
  }

  #limitVelocityHistory() {
    const maxDisplacement = this.segmentLength * 1.4;
    for (let i = 1; i < this.count; i += 1) {
      const dx = this.x[i] - this.px[i];
      const dy = this.y[i] - this.py[i];
      const distance = hypot2(dx, dy);
      if (!(distance > maxDisplacement)) continue;
      const scale = maxDisplacement / distance;
      this.px[i] = this.x[i] - dx * scale;
      this.py[i] = this.y[i] - dy * scale;
    }
  }

  #applyTotalTurnLimit() {
    if (!(this.maxTotalTurn > 0 && this.maxTotalTurn < TAU) || this.count < 4) return;

    let previousAngle = Math.atan2(this.y[1] - this.y[0], this.x[1] - this.x[0]);
    let cumulative = 0;

    for (let i = 1; i < this.count - 1; i += 1) {
      const x = this.x[i];
      const y = this.y[i];
      const nextX = this.x[i + 1];
      const nextY = this.y[i + 1];
      let angle = Math.atan2(nextY - y, nextX - x);
      let delta = angle - previousAngle;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;

      const proposed = cumulative + delta;
      if (Math.abs(proposed) > this.maxTotalTurn) {
        const remaining = Math.sign(proposed) * this.maxTotalTurn - cumulative;
        const targetAngle = previousAngle + remaining;
        const length = hypot2(nextX - x, nextY - y) || this.segmentLength;
        const targetX = x + Math.cos(targetAngle) * length;
        const targetY = y + Math.sin(targetAngle) * length;
        this.x[i + 1] += (targetX - nextX) * this.totalTurnStiffness;
        this.y[i + 1] += (targetY - nextY) * this.totalTurnStiffness;

        angle = Math.atan2(this.y[i + 1] - y, this.x[i + 1] - x);
        delta = angle - previousAngle;
        while (delta > Math.PI) delta -= TAU;
        while (delta < -Math.PI) delta += TAU;
      }

      cumulative += delta;
      previousAngle = angle;
    }
  }

  step(dt, anchorX, anchorY, forceAt, iterations = 4) {
    this.setAnchor(anchorX, anchorY);
    const dt2 = dt * dt;

    for (let i = 1; i < this.count; i += 1) {
      const x = this.x[i];
      const y = this.y[i];
      const along = i / (this.count - 1);
      const retention = Math.max(0.90, this.damping - this.tipDrag * along * along);
      let vx = (x - this.px[i]) * retention;
      let vy = (y - this.py[i]) * retention;
      const displacement = hypot2(vx, vy);
      const maxDisplacement = this.segmentLength * 1.4;
      if (displacement > maxDisplacement) {
        const scale = maxDisplacement / displacement;
        vx *= scale;
        vy *= scale;
      }
      const force = forceAt(x, y, along);
      this.px[i] = x;
      this.py[i] = y;
      this.x[i] = x + vx + force.x * dt2;
      this.y[i] = y + vy + (force.y + this.gravity) * dt2;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.#applyDistanceConstraints(anchorX, anchorY);
      if (n < 2) this.#applyBendMemory();
      if (n < 3) this.#applyBendLimit();
      if (n < 3) this.#applyTotalTurnLimit();
    }

    // Re-tighten after angular corrections so the anti-loop constraints never
    // create elastic-looking segment stretch.
    this.#applyDistanceConstraints(anchorX, anchorY);
    this.#applyBendLimit();
    this.#applyTotalTurnLimit();
    this.#applyDistanceConstraints(anchorX, anchorY);
    this.x[0] = anchorX;
    this.y[0] = anchorY;
    this.#limitVelocityHistory();
  }

  #projectTrailEnvelope(anchorX, anchorY, rise, side, drop) {
    let clipped = false;
    for (let i = 1; i < this.count; i += 1) {
      const along = i / (this.count - 1);
      const minY = anchorY - rise * (0.42 + along * 0.58);
      const maxY = anchorY + drop * (0.12 + along * 0.88);
      const allowedSide = side * (0.20 + Math.pow(along, 0.72) * 0.80);
      let x = this.x[i];
      let y = this.y[i];

      if (y < minY) y = minY;
      if (y > maxY) y = maxY;
      const dx = x - anchorX;
      if (Math.abs(dx) > allowedSide) x = anchorX + Math.sign(dx) * allowedSide;

      if (x !== this.x[i] || y !== this.y[i]) {
        this.x[i] = x;
        this.y[i] = y;
        clipped = true;
      }
    }
    return clipped;
  }

  #settleTrail(anchorX, anchorY, side) {
    // This is an emergency pose, not normal animation. If a chain reaches the
    // safety envelope with too much stored strain, preserving that momentum is
    // exactly what causes the explosive V4.6 failure. Rebuild a gentle hanging
    // S-curve with exact segment lengths and make it the new Verlet history.
    this.x[0] = anchorX;
    this.y[0] = anchorY;
    const amplitude = Math.min(side * 0.15, this.segmentLength * 2.5);
    const phase = (this.seed * 1.73) % TAU;

    for (let i = 1; i < this.count; i += 1) {
      const along = i / (this.count - 1);
      const wave = Math.sin(along * Math.PI * 1.55 + phase) * Math.sin(Math.PI * along);
      const targetX = anchorX + amplitude * wave;
      let dx = targetX - this.x[i - 1];
      dx = Math.max(-this.segmentLength * 0.65, Math.min(this.segmentLength * 0.65, dx));
      const dy = Math.sqrt(Math.max(
        0.0001,
        this.segmentLength * this.segmentLength - dx * dx,
      ));
      this.x[i] = this.x[i - 1] + dx;
      this.y[i] = this.y[i - 1] + dy;
    }

    for (let i = 0; i < this.count; i += 1) {
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
    }
  }

  clipTrailEnvelope(anchorX, anchorY, { maxRise, maxSide, maxDrop } = {}) {
    const rise = Math.max(this.segmentLength * 1.5, maxRise ?? this.segmentLength * 4);
    const side = Math.max(this.segmentLength * 3, maxSide ?? this.segmentLength * (this.count - 1) * 0.76);
    const drop = Math.max(this.segmentLength * 4, maxDrop ?? this.segmentLength * (this.count - 1) * 1.05);
    const clipped = this.#projectTrailEnvelope(anchorX, anchorY, rise, side, drop);
    let error = this.maxConstraintError();

    // Also catch a strained chain that is technically still inside the visual
    // envelope. That is how a nearly straight strand can hide enormous spring
    // energy without looking out of bounds yet.
    const needsRepair = clipped || !Number.isFinite(error) || error > 1.0;
    if (needsRepair) {
      // Alternate the two simple, stable constraints. Do not run bend-memory or
      // total-turn corrections here: on a heavily clipped chain those angular
      // solvers can amplify the correction and create the billion-pixel blowup.
      for (let n = 0; n < 16; n += 1) {
        this.#applyDistanceConstraints(anchorX, anchorY);
        this.#projectTrailEnvelope(anchorX, anchorY, rise, side, drop);
      }

      error = this.maxConstraintError();
      const repairLimit = Math.min(0.75, this.segmentLength * 0.16);
      if (!Number.isFinite(error) || error > repairLimit) {
        this.#settleTrail(anchorX, anchorY, side);
      } else {
        // Safety intervention is allowed to dissipate momentum. The repaired
        // pose becomes the new history, so there is no snap-back next frame.
        for (let i = 0; i < this.count; i += 1) {
          this.px[i] = this.x[i];
          this.py[i] = this.y[i];
        }
      }
    }

    this.x[0] = this.px[0] = anchorX;
    this.y[0] = this.py[0] = anchorY;
    return clipped;
  }

  maxConstraintError() {
    let max = 0;
    for (let i = 0; i < this.count - 1; i += 1) {
      const distance = hypot2(this.x[i + 1] - this.x[i], this.y[i + 1] - this.y[i]);
      max = Math.max(max, Math.abs(distance - this.segmentLength));
    }
    return max;
  }

  maxTurnAngle() {
    let max = 0;
    for (let i = 1; i < this.count - 1; i += 1) {
      const incoming = Math.atan2(this.y[i] - this.y[i - 1], this.x[i] - this.x[i - 1]);
      const outgoing = Math.atan2(this.y[i + 1] - this.y[i], this.x[i + 1] - this.x[i]);
      let delta = outgoing - incoming;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      max = Math.max(max, Math.abs(delta));
    }
    return max;
  }

  signedTurn() {
    let total = 0;
    for (let i = 1; i < this.count - 1; i += 1) {
      const incoming = Math.atan2(this.y[i] - this.y[i - 1], this.x[i] - this.x[i - 1]);
      const outgoing = Math.atan2(this.y[i + 1] - this.y[i], this.x[i + 1] - this.x[i]);
      let delta = outgoing - incoming;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      total += delta;
    }
    return total;
  }
}
