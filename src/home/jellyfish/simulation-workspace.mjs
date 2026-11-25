import { buildContactForces } from "./interaction.mjs";
import { TissueFlow } from "./hydrodynamics.mjs";

// Owned by one specimen; discarded on a viewport resize.
export class SimulationWorkspace {
  constructor() { this.contactWorkspace = {}; this.water = null; }

  prepare(chains, dt, scale, ocean, propulsion, time, pulseDelta, flow, profile) {
    let stamp = profile ? performance.now() : 0;
    this.contacts = buildContactForces(chains, scale, this.contactWorkspace);
    if (profile) { profile.contact += performance.now() - stamp; stamp = performance.now(); }
    const current = ocean.weatherAt?.(time) ?? flow;
    const previous = this.previousCurrent ?? current;
    const calm = (ocean.pointer?.strength ?? 0) < 0.08 && Math.abs(pulseDelta) < 0.018
      && Math.hypot(current.x - previous.x, current.y - previous.y) < 0.8;
    this.previousCurrent = { x: current.x, y: current.y };
    this.water = this.water
      ? this.water.update(chains, dt, scale, ocean, propulsion, time, calm)
      : new TissueFlow(chains, dt, scale, ocean, propulsion, time);
    if (profile) {
      profile.field += performance.now() - stamp;
      profile.rebuilds += Number(this.water.rebuilt);
      this.solverStart = performance.now();
    }
    return this;
  }

  record(chain, profile) {
    profile.repairs += Number(chain.lastRepair);
    profile.skipped += chain.lastSkipped;
  }

  finish(profile) {
    profile.solver += performance.now() - this.solverStart;
    profile.steps++;
  }
}
