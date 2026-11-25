import { ASCII } from "./config.mjs";
import { ambientEddyAt } from "./fluid.mjs";
import { clamp, range, smoothstep, TAU } from "./math.mjs";

// Long-period current "weather". The signed horizontal carrier naturally
// passes through calm water before reversing, so meaningful left- and
// right-flowing episodes both occur without discrete state changes.
export function currentWeather(time) {
  const carrier =
    Math.sin(time * 0.016 + 0.42) +
    Math.sin(time * 0.0063 - 1.15) * 0.34;
  const signed = clamp(carrier / 1.22, -1, 1);
  const magnitude = Math.abs(signed);
  const swell = 0.54 + 0.46 * (0.5 + 0.5 * Math.sin(time * 0.0105 + 1.8));
  const calmGate = smoothstep(clamp(magnitude * 1.35, 0, 1));
  const horizontal = signed * (2.2 + 17.0 * calmGate * swell);
  const vertical =
    Math.sin(time * 0.012 - 0.65) * 4.2 * magnitude * swell +
    Math.sin(time * 0.0048 + 2.1) * 0.55 * magnitude;
  const strength = Math.hypot(horizontal, vertical);
  return {
    heading: Math.atan2(vertical, horizontal || 0.0001),
    strength,
    x: horizontal,
    y: vertical,
  };
}

export class OceanField {
  constructor(width, height, timeOffset = 0) {
    this.timeOffset = timeOffset;
    this.width = width;
    this.height = height;
    this.pointer = { x: width * 0.5, y: height * 0.5, vx: 0, vy: 0, strength: 0 };
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  disturb(x, y, vx = 0, vy = 0) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.vx = clamp(vx, -100, 100);
    this.pointer.vy = clamp(vy, -100, 100);
    this.pointer.strength = Math.min(0.55, this.pointer.strength + 0.22);
  }

  step(dt) {
    this.pointer.strength *= Math.exp(-2.35 * dt);
    this.pointer.vx *= Math.exp(-6.2 * dt);
    this.pointer.vy *= Math.exp(-6.2 * dt);
  }

  weatherAt(time) {
    return currentWeather(time + this.timeOffset);
  }

  sample(x, y, time, sensitivity = 1) {
    const nx = x / this.width;
    const ny = y / this.height;
    const waterTime = time + this.timeOffset;
    const slow = waterTime * 0.16;
    const weather = this.weatherAt(time);
    const ambient = ambientEddyAt(nx, ny, waterTime);

    // Macro weather sets direction; broad local eddies bend neighboring tissue
    // differently; the weak ambient field prevents perfectly static calm.
    // Amplitudes remain bounded so none of these layers overwhelms the others.
    let fx =
      weather.x
      + Math.sin(ny * 7.8 + slow * 1.2) * 6.4
      + Math.sin((nx + ny) * 5.4 - slow * 0.7) * 4.1
      + Math.cos(ny * 2.9 - slow * 0.31) * 2.8
      + ambient.x;
    let fy =
      weather.y
      + Math.cos(nx * 7.1 - slow) * 3.4
      + Math.sin(nx * 3.4 - ny * 4.3 + slow * 0.66) * 2.6
      + ambient.y;

    const p = this.pointer;
    if (p.strength > 0.002) {
      const dx = x - p.x;
      const dy = y - p.y;
      const r2 = dx * dx + dy * dy;
      const radius = Math.max(90, Math.min(this.width, this.height) * 0.22);
      if (r2 < radius * radius) {
        const r = Math.sqrt(r2) || 1;
        const falloff = (1 - r / radius) ** 2 * p.strength;
        // Pointer motion displaces water; it should never overpower the ocean.
        const swirl = 22 * falloff;
        fx += (-dy / r) * swirl + p.vx * 0.18 * falloff;
        fy += (dx / r) * swirl + p.vy * 0.18 * falloff;
      }
    }

    return { x: fx * sensitivity, y: fy * sensitivity };
  }
}

export class MarineSnow {
  constructor(width, height, count, random) {
    this.random = random;
    this.width = width;
    this.height = height;
    this.items = Array.from({ length: count }, () => this.#make(true));
  }

  #make(anywhere = false) {
    const depth = range(this.random, 0.25, 1);
    return {
      x: range(this.random, 0, this.width),
      y: anywhere ? range(this.random, 0, this.height) : range(this.random, -36, -5),
      depth,
      drift: range(this.random, -2.6, 2.6),
      fall: range(this.random, 3.5, 9.5) * (0.45 + depth * 0.8),
      phase: range(this.random, 0, TAU),
      glyph: ASCII.snow[Math.floor(this.random() * ASCII.snow.length)],
      alpha: range(this.random, 0.05, 0.18) * (0.45 + depth * 0.5),
    };
  }

  resize(width, height, targetCount) {
    const sx = width / Math.max(1, this.width);
    const sy = height / Math.max(1, this.height);
    this.width = width;
    this.height = height;
    for (const p of this.items) {
      p.x *= sx;
      p.y *= sy;
    }
    while (this.items.length < targetCount) this.items.push(this.#make(true));
    if (this.items.length > targetCount) this.items.length = targetCount;
  }

  step(dt, time, ocean) {
    for (const p of this.items) {
      const flow = ocean.sample(p.x, p.y, time, 0.18 + p.depth * 0.2);
      p.x += (p.drift + flow.x * 0.045 + Math.sin(time * 0.36 + p.phase) * 0.8) * dt;
      p.y += (p.fall + flow.y * 0.025) * dt;

      if (p.y > this.height + 8) {
        Object.assign(p, this.#make(false));
      } else if (p.x < -12) {
        p.x = this.width + 6;
      } else if (p.x > this.width + 12) {
        p.x = -6;
      }
    }
  }
}
