import { JellyWorld } from "./world.mjs";

export const STORAGE_KEY = "tiendu:jellyfish-state";
const VERSION = 1;
const MAX_BYTES = 1024 * 1024;
const BODY = ["x", "y", "vx", "vy", "phase", "pulse", "previousPulse", "tilt", "baseSize", "anatomyScale"];
const TRAIL = ["x", "y", "px", "py"];
const ITEMS = ["width", "memoryStrength", "tipHook"];
const finite = (value, limit = 1e6) => Number.isFinite(value) && Math.abs(value) <= limit;
const dimensions = value => Array.isArray(value) && value.length === 2
  && value.every(n => finite(n, 16384) && n >= 1);
const members = jelly => jelly.chains.flatMap(item => [item, ...item.branches]);

function captureMember(item) {
  const { chain } = item;
  return {
    scale: ITEMS.map(key => item[key] ?? null),
    length: chain.segmentLength,
    bend: chain.bend,
    points: TRAIL.map(key => Array.from(chain[key])),
  };
}

export function snapshotWorld(world) {
  const { jelly } = world;
  return {
    version: VERSION,
    seed: world.seed,
    origin: world.origin.slice(),
    viewport: [world.width, world.height],
    time: world.time,
    oceanTime: world.ocean.timeOffset,
    body: BODY.map(key => jelly[key]),
    orientation: [world.orientation.tilt, world.orientation.tiltVelocity],
    glow: jelly.light.contraction,
    trails: members(jelly).map(captureMember),
  };
}

function validMember(saved, item, limit) {
  return saved && Array.isArray(saved.scale) && saved.scale.length === ITEMS.length
    && saved.scale.every((n, i) => item[ITEMS[i]] === undefined ? n === null : finite(n, 1e4))
    && saved.scale[0] > 0 && finite(saved.length, 1e4) && saved.length > 0
    && finite(saved.bend, 1e4)
    && Array.isArray(saved.points) && saved.points.length === TRAIL.length
    && saved.points.every(row => Array.isArray(row) && row.length === item.chain.count
      && row.every(n => finite(n, limit)));
}

function hydrate(saved, width, height) {
  if (!saved || saved.version !== VERSION || !Number.isInteger(saved.seed)
    || saved.seed < 0 || saved.seed > 0xffffffff
    || !dimensions(saved.origin) || !dimensions(saved.viewport)
    || !finite(saved.time, 1e9) || saved.time < 0 || !finite(saved.oceanTime, 1e9)
    || !Array.isArray(saved.body) || saved.body.length !== BODY.length
    || !saved.body.every(n => finite(n))
    || !Array.isArray(saved.orientation) || saved.orientation.length !== 2
    || !saved.orientation.every(n => finite(n, 0.32))
    || !finite(saved.glow, 1) || saved.glow < 0) return null;
  const [x, y, vx, vy, phase, pulse, previousPulse, tilt, size, anatomyScale] = saved.body;
  const limit = Math.max(...saved.viewport, size) * 8;
  if (!finite(x, limit) || !finite(y, limit) || !finite(vx, 100) || !finite(vy, 100)
    || phase < 0 || phase >= 1 || pulse < 0 || pulse > 1 || previousPulse < 0 || previousPulse > 1
    || !finite(tilt, 0.12) || size < 1 || size > 1000 || anatomyScale < 0.30 || anatomyScale > 1.28) return null;

  // Recreate anatomy at its original dimensions, then restore exact scaled
  // chain lengths and positions. No elapsed wall-clock time is simulated.
  const world = new JellyWorld(...saved.origin, saved.seed, saved.oceanTime);
  if (world.width !== saved.viewport[0] || world.height !== saved.viewport[1]) world.resize(...saved.viewport);
  const items = members(world.jelly);
  if (!Array.isArray(saved.trails) || saved.trails.length !== items.length
    || !saved.trails.every((trail, i) => validMember(trail, items[i], limit))) return null;

  BODY.forEach((key, i) => { world.jelly[key] = saved.body[i]; });
  world.time = saved.time;
  [world.orientation.tilt, world.orientation.tiltVelocity] = saved.orientation;
  world.jelly.light.contraction = saved.glow;
  items.forEach((item, i) => {
    const trail = saved.trails[i];
    ITEMS.forEach((key, j) => { if (trail.scale[j] !== null) item[key] = trail.scale[j]; });
    item.chain.segmentLength = trail.length;
    item.chain.bend = trail.bend;
    TRAIL.forEach((key, j) => item.chain[key].set(trail.points[j]));
    item.chain.hasBefore = false;
  });
  // Viewport-relative body position and isotropic chain scaling use the same
  // resize path as a live rotation. The original pose is exact at equal size.
  if (width !== world.width || height !== world.height) world.resize(width, height);
  return world;
}

export function restoreWorld(width, height, storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY);
    if (typeof raw !== "string" || raw.length > MAX_BYTES) return null;
    return hydrate(JSON.parse(raw), width, height);
  } catch {
    return null;
  }
}

export function saveWorld(world, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    const raw = JSON.stringify(snapshotWorld(world));
    if (raw.length > MAX_BYTES) return false;
    target.setItem(STORAGE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
