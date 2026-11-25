import { SIMULATION, snowCountFor } from "./config.mjs";
import { Jellyfish } from "./jellyfish.mjs";
import { Bioluminescence } from "./bioluminescence.mjs";
import { mulberry32 } from "./math.mjs";
import { stepVisualTilt, tiltTargetAt } from "./orientation.mjs";
import { MarineSnow, OceanField } from "./ocean.mjs";

export class JellyWorld {
  constructor(width, height, seed = 0x7a11f15, oceanTimeOffset = 0) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.time = 0;
    this.orientation = { tilt: 0, tiltVelocity: 0 };
    this.seed = seed >>> 0;
    this.random = mulberry32(this.seed);
    this.ocean = new OceanField(this.width, this.height, oceanTimeOffset);
    this.jelly = new Jellyfish({
      width: this.width,
      height: this.height,
      seed: this.seed,
      random: this.random,
    });
    this.jelly.light = new Bioluminescence();
    this.snow = new MarineSnow(this.width, this.height, snowCountFor(this.width, this.height), this.random);
  }

  resize(width, height) {
    width = Math.max(1, width);
    height = Math.max(1, height);
    const oldWidth = this.width;
    const oldHeight = this.height;
    this.width = width;
    this.height = height;
    this.ocean.resize(width, height);
    this.jelly.resize(oldWidth, oldHeight, width, height);
    this.snow.resize(width, height, snowCountFor(width, height));
  }

  disturb(x, y, vx, vy, impulse) {
    this.ocean.disturb(x, y, vx, vy, impulse);
  }

  step(dt = SIMULATION.fixedStep) {
    this.time += dt;
    this.ocean.step(dt);
    this.snow.step(dt, this.time, this.ocean);
    const previousPulse = this.jelly.pulse;
    this.jelly.step(dt, this.time, this.ocean, this.width, this.height);
    const flowX = this.ocean.weatherAt(this.time).x;
    this.orientation = stepVisualTilt(this.orientation, tiltTargetAt(flowX), dt);
    this.jelly.light.step(dt, this.jelly, previousPulse, this.ocean, this.time, this.orientation.tilt);
  }
}
