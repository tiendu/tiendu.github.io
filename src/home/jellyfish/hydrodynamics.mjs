import { clamp, smoothstep } from "./math.mjs";
import { appendageFlow } from "./propulsion.mjs";

// The ocean and bell wake supply acceleration proxies, not measured fluid
// velocities. This empirical response time converts them for relative drag.
const RESPONSE_TIME = 1;
const MAX_FEEDBACK = 3.0;

function bounded(x, y, limit) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length)) return { x: 0, y: 0 };
  const k = length > limit ? limit / length : 1;
  return { x: x * k, y: y * k };
}

// A frozen, local approximation of water displaced by moving tissue. There
// are no persistent tissue vortices, pressure solver or same-step feedback.
// The bell's persistent wake remains owned by PropulsionWake.
export class TissueFlow {
  constructor(items, dt, anatomyScale, ocean, propulsion, time) {
    this.scale = clamp(anatomyScale, 0.30, 1.28);
    this.cell = 24 * this.scale;
    this.grid = new Map();
    this.bodies = new Map();
    this.ocean = ocean;
    this.propulsion = propulsion;
    this.time = time;
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    for (const item of items) {
      this.add(item, item, item.arm, dt);
      for (const branch of item.branches ?? []) this.add(branch, item, true, dt);
    }
  }

  add(item, family, arm, dt) {
    const { chain } = item;
    if (!chain || chain.count < 2) return;
    const { scale } = this;
    const body = { family, arm, layer: item.layer ?? family.layer ?? 0,
      vx: new Float64Array(chain.count), vy: new Float64Array(chain.count) };
    this.bodies.set(chain, body);
    const radius = arm ? clamp((item.width ?? 3 * scale) * 3.6, 10 * scale, 22 * scale) : 7 * scale;
    const spacing = Math.max(radius * 0.46, 1);
    let next = 0;
    for (let i = 1; i < chain.count; i += 1) {
      const x = chain.x[i], y = chain.y[i];
      const v = bounded((x - chain.px[i]) / dt, (y - chain.py[i]) / dt, 36 * scale);
      body.vx[i] = v.x;
      body.vy[i] = v.y;
      const along = i / (chain.count - 1);
      const distance = i * chain.segmentLength;
      if (along < 0.12 || distance < next || !Number.isFinite(x + y)) continue;
      next = distance + spacing;
      const gx = Math.floor(x / this.cell), gy = Math.floor(y / this.cell);
      if (!Number.isSafeInteger(gx) || !Number.isSafeInteger(gy)) continue;
      const base = appendageFlow(this.ocean, this.propulsion, x, y, this.time, 1);
      const slip = bounded(v.x - base.x * RESPONSE_TIME, v.y - base.y * RESPONSE_TIME, 22 * scale);
      const freedom = smoothstep((along - 0.12) / 0.18);
      const area = arm ? (0.45 + 0.55 * Math.sin(Math.PI * along)) : 0.12;
      const coverage = clamp(Math.max(spacing, chain.segmentLength) / radius, 0.35, 1);
      const source = { body, x, y, radius, slipX: slip.x, slipY: slip.y,
        weight: freedom * area * coverage };
      const key = `${gx},${gy}`;
      let bucket = this.grid.get(key);
      if (!bucket) this.grid.set(key, bucket = []);
      bucket.push(source);
    }
  }

  // Compact support, approximate depth separation and weighted averaging
  // prevent a dense cluster from multiplying the available fluid energy.
  disturbance(chain, x, y, base) {
    const body = this.bodies.get(chain);
    if (!body || !Number.isFinite(x + y)) return { x: 0, y: 0, shelter: 0 };
    const gx = Math.floor(x / this.cell), gy = Math.floor(y / this.cell);
    if (!Number.isSafeInteger(gx) || !Number.isSafeInteger(gy)) return { x: 0, y: 0, shelter: 0 };
    const speed = Math.hypot(base.x, base.y);
    let vx = 0, vy = 0, total = 0, shelter = 0;
    for (let ix = -1; ix <= 1; ix += 1) {
      for (let iy = -1; iy <= 1; iy += 1) {
        const bucket = this.grid.get(`${gx + ix},${gy + iy}`);
        if (!bucket) continue;
        for (const s of bucket) {
          if (s.body.family === body.family) continue;
          const depth = 1 - smoothstep((Math.abs(s.body.layer - body.layer) - 0.10) / 0.55);
          if (!depth) continue;
          const dx = x - s.x, dy = y - s.y;
          const r2 = (dx * dx + dy * dy) / (s.radius * s.radius);
          if (r2 >= 1) continue;
          const weight = (1 - r2) ** 2 * depth * s.weight;
          vx += s.slipX * weight;
          vy += s.slipY * weight;
          total += weight;
          if (s.body.arm && speed > 0.01) {
            const downstream = (dx * base.x + dy * base.y) / (speed * s.radius);
            shelter = Math.max(shelter, weight * smoothstep(downstream / 0.35));
          }
        }
      }
    }
    const velocity = bounded(vx * 0.62 / Math.max(1, total), vy * 0.62 / Math.max(1, total), 10 * this.scale);
    return { ...velocity, shelter: Math.min(0.18, shelter * 0.55) };
  }

  sample(chain, along, x, y, sensitivity) {
    const base = appendageFlow(this.ocean, this.propulsion, x, y, this.time, sensitivity);
    const body = this.bodies.get(chain);
    if (!body) return base;
    const t = clamp(along, 0, 1);
    const i = Math.round(t * (chain.count - 1));
    const freedom = smoothstep((t - 0.08) / 0.22);
    if (!freedom) return base;
    const local = this.disturbance(chain, x, y, base);
    // Replace a small part of the old acceleration with relative drag rather
    // than adding a second full-strength ambient force. The existing Verlet
    // damping, bell wake, and direct contact remain independent.
    const rate = (body.arm ? 0.22 : 0.16) * freedom;
    const shelteredX = base.x * (1 - local.shelter * freedom);
    const shelteredY = base.y * (1 - local.shelter * freedom);
    const dragX = rate * (shelteredX * RESPONSE_TIME + local.x * sensitivity - body.vx[i]);
    const dragY = rate * (shelteredY * RESPONSE_TIME + local.y * sensitivity - body.vy[i]);
    const delta = bounded(shelteredX * (1 - rate * RESPONSE_TIME) + dragX - base.x,
      shelteredY * (1 - rate * RESPONSE_TIME) + dragY - base.y, MAX_FEEDBACK * this.scale);
    return { x: base.x + delta.x, y: base.y + delta.y, wakeWeight: base.wakeWeight };
  }
}
