import { clamp, smoothstep } from "./math.mjs";

const MAX_PACKETS = 12;
const LIFETIME = 3.6;
const MAX_FORCE = 12;

// Compact, smoothly vanishing support. All sampled values are acceleration
// inputs for the existing Verlet model, not measured water velocities.
function kernel(r2) {
  const t = Math.max(0, 1 - r2);
  return t * t;
}

export class PropulsionWake {
  constructor() {
    this.reset();
  }

  reset() {
    this.packets = [];
    this.pending = 0;
    this.sign = 0;
    this.source = null;
  }

  step(dt, bell, pulseDelta, ocean, time) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const width = Math.max(1, bell.bellWidth());
    const scale = clamp(bell.baseSize / 250, 0.30, 1.28);
    const tilt = bell.tilt;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    // Mouth axis in world coordinates; positive local y points downstream.
    const mouth = { x: bell.x - s * width * 0.035, y: bell.y + c * width * 0.035 };
    const rate = pulseDelta / dt;
    this.source = { ...mouth, width, scale, c, s, rate };

    // Previously shed circulation stays in water space. A bounded empirical
    // drift converts the ambient acceleration proxy to a packet travel speed.
    for (const p of this.packets) {
      p.age += dt;
      const flow = ocean.sample(p.x, p.y, time, 1);
      const driftLimit = p.width * 0.18;
      p.x += (p.vx + clamp(flow.x * 0.85, -driftLimit, driftLimit)) * dt;
      p.y += (p.vy + clamp(flow.y * 0.85, -driftLimit, driftLimit)) * dt;
    }
    this.packets = this.packets.filter(p => p.age < LIFETIME);

    // Emit by displaced pulse fraction, not frame count. Release creates
    // weaker opposite circulation; the local refill field acts immediately.
    const sign = Math.sign(pulseDelta);
    if (sign !== this.sign) this.pending = 0;
    this.sign = sign;
    this.pending += Math.abs(pulseDelta);
    const quantum = sign > 0 ? 0.20 : 0.33;
    while (sign && this.pending >= quantum - 1e-9) {
      this.pending = Math.max(0, this.pending - quantum);
      const speed = width * (sign > 0 ? 0.62 : 0.35);
      this.packets.push({
        x: mouth.x - s * width * 0.12, y: mouth.y + c * width * 0.12,
        vx: -s * speed, vy: c * speed, c, s, width, age: 0,
        strength: scale * (sign > 0 ? 6.5 : -2.2),
      });
      if (this.packets.length > MAX_PACKETS) this.packets.shift();
    }
  }

  sample(x, y) {
    let fx = 0, fy = 0;
    const src = this.source;
    if (src) {
      const dx = x - src.x, dy = y - src.y;
      const u = (dx * src.c + dy * src.s) / src.width;
      const v = (-dx * src.s + dy * src.c) / src.width;
      const footprint = kernel((u / 0.49) ** 2 + ((v - 0.15) / 0.35) ** 2)
        * smoothstep((v + 0.04) / 0.09);
      const drive = src.rate >= 0 ? clamp(src.rate / 2.2, 0, 1) * 8
        : -clamp(-src.rate / 1.7, 0, 1) * 3.8;
      const axial = drive * footprint * src.scale;
      const lateral = axial * u * 0.85;
      fx += lateral * src.c - axial * src.s;
      fy += lateral * src.s + axial * src.c;
    }

    // Each packet represents a cross-section of a vortex ring, with opposite
    // circulation on its two sides. The core expands and fades as it travels.
    for (const p of this.packets) {
      const dx = x - p.x, dy = y - p.y;
      const u = (dx * p.c + dy * p.s) / p.width;
      const v = (-dx * p.s + dy * p.c) / p.width;
      const spread = 0.43 + p.age * 0.085;
      if (Math.abs(u) > spread + 0.23 || Math.abs(v) > spread) continue;
      const ageWeight = smoothstep(p.age / 0.12)
        * (1 - smoothstep(p.age / LIFETIME));
      const strength = p.strength * ageWeight;
      const left = u + 0.23, right = u - 0.23;
      const a = kernel((left * left + v * v) / (spread * spread));
      const b = kernel((right * right + v * v) / (spread * spread));
      const lateral = strength * v * (b - a) / spread;
      const axial = strength * (left * a - right * b) / spread;
      fx += lateral * p.c - axial * p.s;
      fy += lateral * p.s + axial * p.c;
    }
    const length = Math.hypot(fx, fy);
    const limit = MAX_FORCE * (src?.scale ?? 1);
    const factor = length > limit ? limit / length : 1;
    return { x: fx * factor, y: fy * factor };
  }
}

// Keep ambient sampling unchanged for the bell itself. Both main chains and
// branches receive this same local field, scaled by their existing sensitivity.
export function appendageFlow(ocean, propulsion, x, y, time, sensitivity) {
  const flow = ocean.sample(x, y, time, sensitivity);
  const wake = propulsion.sample(x, y);
  const wx = wake.x * sensitivity, wy = wake.y * sensitivity;
  return { x: flow.x + wx, y: flow.y + wy,
    wakeWeight: smoothstep(Math.hypot(wx, wy) / 6) };
}
