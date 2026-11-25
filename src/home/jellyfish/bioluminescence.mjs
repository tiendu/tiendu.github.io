import { clamp, rotate, smoothstep } from "./math.mjs";

// Optical state only: no forces, random draws or geometry changes.
export class Bioluminescence {
  constructor() {
    this.contraction = 0;
    this.flash = null;
    this.cooldown = 0;
  }

  step(dt, jelly, previousPulse, ocean, time, visualTilt = jelly.tilt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const rate = Math.max(0, (jelly.pulse - previousPulse) / dt);
    const target = smoothstep(rate / 2.0);
    const response = target > this.contraction ? 0.085 : 0.42;
    this.contraction += (target - this.contraction) * (1 - Math.exp(-dt / response));
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.flash) {
      this.flash.age += dt;
      if (this.flash.age >= 1.6) this.flash = null;
    }
    if (this.cooldown > 0) return;

    const width = Math.max(1, jelly.bellWidth());
    const height = Math.max(1, jelly.bellHeight());
    const p = ocean.pointer;
    let strength = 0, u = 0;
    if (p && p.strength > 0.08) {
      const local = rotate(p.x - jelly.x, p.y - jelly.y, -visualTilt);
      const distance = Math.hypot(local.x / (width * 0.75),
        (local.y + height * 0.35) / (height * 1.6));
      strength = smoothstep(p.strength / 0.55) * (1 - smoothstep(distance));
      u = clamp(local.x / (width * 0.5), -0.8, 0.8);
    }

    // Detect spatial shear, not a uniform current or the animal's own wake.
    // The existing ocean samples are acceleration proxies, not SI velocities.
    const left = ocean.sample(jelly.x - width * 0.35, jelly.y, time);
    const right = ocean.sample(jelly.x + width * 0.35, jelly.y, time);
    const shear = Math.hypot(right.x - left.x, right.y - left.y);
    const shearStrength = smoothstep((shear - 9) / 13) * 0.65;
    if (shearStrength > strength) {
      strength = shearStrength;
      u = Math.hypot(left.x, left.y) > Math.hypot(right.x, right.y) ? -0.65 : 0.65;
    }
    if (strength >= 0.30) {
      this.flash = { u, strength, age: 0 };
      this.cooldown = 1.8;
    }
  }

  at(u, v) {
    // Muscle-associated glow is an artistic interpretation; the mechanical
    // disturbance wave is independent and propagates in material coordinates.
    const margin = Math.exp(-(((v + 0.075) / 0.19) ** 2));
    const squeeze = this.contraction * margin * 0.42;
    const f = this.flash;
    if (!f) return squeeze;
    const distance = Math.hypot((u - f.u) * 0.72, (v + 0.07) * 0.86);
    const front = f.age * 1.5;
    const arrival = Math.exp(-(((distance - front) / 0.24) ** 2));
    const envelope = smoothstep(f.age / 0.07) * (1 - smoothstep((f.age - 0.55) / 1.05));
    return clamp(squeeze + f.strength * arrival * envelope * 0.85, 0, 1);
  }

  rootAt(item, along) {
    const u = clamp((item.offset ?? 0) * (item.arm ? 0.35 : 0.82), -0.8, 0.8);
    return this.at(u, 0) * (1 - smoothstep(along / 0.23));
  }
}
