import { clamp, rotate, smoothstep } from "./math.mjs";

// Optical state only: no forces, random draws or geometry changes.
export class Bioluminescence {
  constructor() {
    this.contraction = 0;
    this.flash = null;
    this.cooldown = 0;
    this.contactCooldown = 0;
  }

  // Direct contact is a distinct mechanical stimulus, not an accumulated
  // ocean impulse. A forgiving hit region covers the bell and its margin.
  stimulate(x, y, jelly, visualTilt = jelly.tilt) {
    if (this.contactCooldown > 0) return false;
    const width = Math.max(1, jelly.bellWidth());
    const height = Math.max(1, jelly.bellHeight());
    const local = rotate(x - jelly.x, y - jelly.y, -visualTilt);
    const distance = Math.hypot(local.x / (width * 0.66),
      (local.y + height * 0.45) / (height * 0.78));
    if (!(distance <= 1)) return false;
    this.flash = {
      u: clamp(local.x / (width * 0.5), -0.85, 0.85),
      v: clamp(local.y / height, -1.04, 0.035),
      strength: 1, age: 0, contact: true,
    };
    this.cooldown = this.contactCooldown = 1.8;
    return true;
  }

  step(dt, jelly, previousPulse, ocean, time, visualTilt = jelly.tilt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const rate = Math.max(0, (jelly.pulse - previousPulse) / dt);
    const target = smoothstep(rate / 2.0);
    const response = target > this.contraction ? 0.085 : 0.42;
    this.contraction += (target - this.contraction) * (1 - Math.exp(-dt / response));
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
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

  at(u, v, wave = this.flashAt(u, v)) {
    // Muscle-associated glow is an artistic interpretation; the mechanical
    // disturbance wave is independent and propagates in material coordinates.
    const margin = Math.exp(-(((v + 0.075) / 0.19) ** 2));
    const squeeze = this.contraction * margin * 0.42;
    return clamp(squeeze + wave, 0, 1);
  }

  flashAt(u, v) {
    const f = this.flash;
    if (!f) return 0;
    const distance = Math.hypot((u - f.u) * 0.72, (v - (f.v ?? -0.07)) * 0.86);
    const front = f.age * (f.contact ? 1.0 : 1.5);
    const arrival = Math.exp(-(((distance - front) / (f.contact ? 0.34 : 0.24)) ** 2));
    const envelope = smoothstep(f.age / 0.07) * (1 - smoothstep((f.age - 0.55) / 1.05));
    return f.strength * arrival * envelope * (f.contact ? 1 : 0.85);
  }

  rootAt(item, along) {
    const u = clamp((item.offset ?? 0) * (item.arm ? 0.35 : 0.82), -0.8, 0.8);
    return this.at(u, 0) * (1 - smoothstep(along / 0.23));
  }
}
