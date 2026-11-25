import { clamp, smoothstep } from "./math.mjs";

// Layer is an approximate depth coordinate, not a real 3D collision shape.
// Contact is deliberately compliant: overlap is allowed, and there are no
// position projections, friction constraints, knots or persistent locks.
function rootFreedom(along) {
  return smoothstep((along - 0.08) / 0.16);
}

function radiusAt(body, along) {
  return body.radius * (body.arm ? 0.45 + 0.55 * Math.sin(Math.PI * along) : 1 - along * 0.35);
}

function addBody(bodies, item, family, arm, scale) {
  const chain = item.chain;
  if (!chain || chain.count < 2) return;
  const width = item.width ?? 3 * scale;
  bodies.push({ chain, family, arm, layer: item.layer ?? family.layer ?? 0,
    radius: arm ? clamp(width * 1.25, 1.5 * scale, 5.8 * scale) : 0.75 * scale,
    inverseMass: arm ? 0.24 : 1,
    x: new Float64Array(chain.count), y: new Float64Array(chain.count) });
}

function contactStrength(a, b) {
  return a.arm && b.arm ? 13 : a.arm || b.arm ? 23 : 3.5;
}

function depthWeight(a, b) {
  return 1 - smoothstep((Math.abs(a.layer - b.layer) - 0.12) / 0.38);
}

// All forces are gathered before any Verlet chain is advanced. Segment
// buckets and nearest-per-body queries avoid all-pairs point comparisons and
// prevent adjacent segments of the same ribbon from stacking contact forces.
// The optional workspace belongs to one specimen with fixed topology.
// Callers without one still receive independent snapshots.
export function buildContactForces(items, anatomyScale = 1, workspace = {}) {
  const scale = clamp(anatomyScale, 0.3, 1.28);
  if (workspace.items !== items || workspace.scale !== scale) {
    const bodies = [];
    for (const item of items) {
      addBody(bodies, item, item, item.arm, scale);
      for (const branch of item.branches ?? []) addBody(bodies, branch, item, true, scale);
    }
    for (const body of bodies) {
      const { chain } = body;
      body.radii = Float64Array.from({ length: chain.count }, (_, i) => radiusAt(body, i / (chain.count - 1)));
      body.freedom = Float64Array.from({ length: chain.count }, (_, i) => rootFreedom(i / (chain.count - 1)));
      body.weights = bodies.map(b => body.family === b.family || (body.arm && !b.arm) ? 0 : depthWeight(body, b));
    }
    Object.assign(workspace, { items, scale, bodies,
      forces: new Map(bodies.map(body => [body.chain, body])),
      maxRadius: Math.max(1, ...bodies.map(body => body.radius)),
      grid: new Map(), buckets: [], segments: [],
      nearest: new Array(bodies.length), distances: new Float64Array(bodies.length),
      fractions: new Float64Array(bodies.length), active: [],
    });
  }
  const { bodies, forces, maxRadius, grid, buckets, segments, nearest, distances, fractions, active } = workspace;
  const cell = Math.max(4, maxRadius * 2.5);
  grid.clear();
  nearest.fill(null);
  active.length = 0;
  let bucketCount = 0, segmentCount = 0;
  const key = (x, y) => `${x},${y}`;

  for (let id = 0; id < bodies.length; id += 1) {
    const body = bodies[id];
    const { chain } = body;
    body.x.fill(0);
    body.y.fill(0);
    for (let j = 1; j < chain.count - 1; j += 1) {
      if (body.freedom[j + 1] === 0) continue;
      const ax = chain.x[j], ay = chain.y[j];
      const dx = chain.x[j + 1] - ax, dy = chain.y[j + 1] - ay;
      const length2 = dx * dx + dy * dy;
      // A damaged chain must not turn one segment into an enormous grid scan.
      const segmentLimit = Math.max(12 * scale, (chain.segmentLength ?? 0) * 4);
      if (!Number.isFinite(length2) || length2 < 1e-8 || length2 > segmentLimit ** 2) continue;
      const pad = Math.max(body.radii[j], body.radii[j + 1]) + maxRadius;
      const x0 = Math.floor((Math.min(ax, ax + dx) - pad) / cell);
      const x1 = Math.floor((Math.max(ax, ax + dx) + pad) / cell);
      const y0 = Math.floor((Math.min(ay, ay + dy) - pad) / cell);
      const y1 = Math.floor((Math.max(ay, ay + dy) + pad) / cell);
      if (![x0, x1, y0, y1].every(Number.isSafeInteger)) continue;
      const segment = segments[segmentCount] ?? (segments[segmentCount] = {});
      segmentCount++;
      segment.id = id; segment.j = j; segment.ax = ax; segment.ay = ay;
      segment.dx = dx; segment.dy = dy; segment.length2 = length2; segment.pad2 = pad * pad;
      for (let gx = x0; gx <= x1; gx += 1) {
        for (let gy = y0; gy <= y1; gy += 1) {
          const k = key(gx, gy);
          let bucket = grid.get(k);
          if (!bucket) {
            bucket = buckets[bucketCount] ?? (buckets[bucketCount] = []);
            bucketCount++;
            bucket.length = 0;
            grid.set(k, bucket);
          }
          bucket.push(segment);
        }
      }
    }
  }

  for (let i = bucketCount; i < buckets.length; i++) buckets[i].length = 0;
  for (let id = 0; id < bodies.length; id += 1) {
    const a = bodies[id];
    const { chain } = a;
    const weights = a.weights;
    for (let i = 1; i < chain.count; i += 1) {
      const freedom = a.freedom[i];
      if (freedom === 0) continue;
      const x = chain.x[i], y = chain.y[i];
      const bucket = grid.get(key(Math.floor(x / cell), Math.floor(y / cell)));
      if (!bucket) continue;
      // Only reset entries touched by the preceding point.
      for (const other of active) nearest[other] = null;
      active.length = 0;
      const r = a.radii[i];
      for (const seg of bucket) {
        if (!weights[seg.id]) continue;
        const t = clamp(((x - seg.ax) * seg.dx + (y - seg.ay) * seg.dy) / seg.length2, 0, 1);
        const dx = x - seg.ax - seg.dx * t, dy = y - seg.ay - seg.dy * t;
        const d2 = dx * dx + dy * dy;
        if (d2 >= seg.pad2 || (nearest[seg.id] && d2 >= distances[seg.id])) continue;
        const b = bodies[seg.id];
        const reach = r + b.radii[seg.j] * (1 - t) + b.radii[seg.j + 1] * t;
        const free = b.freedom[seg.j] * (1 - t) + b.freedom[seg.j + 1] * t;
        if (d2 >= reach * reach || !free) continue;
        if (!nearest[seg.id]) active.push(seg.id);
        nearest[seg.id] = seg;
        distances[seg.id] = d2;
        fractions[seg.id] = t;
      }
      // Preserve accumulation order, including reciprocal reactions.
      active.sort((a, b) => a - b);
      for (const other of active) {
        const seg = nearest[other];
        const b = bodies[other];
        const t = fractions[other];
        const dx = x - seg.ax - seg.dx * t, dy = y - seg.ay - seg.dy * t;
        const reach = r + b.radii[seg.j] * (1 - t) + b.radii[seg.j + 1] * t;
        const distance = Math.sqrt(distances[other]);
        // Smoothly regularize near zero separation rather than choosing a
        // random side at an exact crossing. Soft contact is not impenetrable.
        const denominator = Math.max(distance, reach * 0.18);
        const weight = weights[other] * freedom * (b.freedom[seg.j] * (1 - t) + b.freedom[seg.j + 1] * t);
        // Equal tissue types query both ways. Mixed pairs are sampled only
        // from the thin strand, with reaction distributed along the ribbon.
        const force = contactStrength(a, b) * scale * weight
          * smoothstep(1 - distance / reach) * (a.arm === b.arm ? 0.5 : 1);
        const fx = dx / denominator * force, fy = dy / denominator * force;
        a.x[i] += fx * a.inverseMass;
        a.y[i] += fy * a.inverseMass;
        b.x[seg.j] -= fx * (1 - t) * b.inverseMass;
        b.y[seg.j] -= fy * (1 - t) * b.inverseMass;
        b.x[seg.j + 1] -= fx * t * b.inverseMass;
        b.y[seg.j + 1] -= fy * t * b.inverseMass;
      }
    }
  }

  for (const body of bodies) {
    const limit = (body.arm ? 4.5 : 14) * scale;
    for (let i = 0; i < body.chain.count; i += 1) {
      const freedom = body.freedom[i];
      const length = Math.hypot(body.x[i], body.y[i]);
      const factor = length > limit ? limit / length : 1;
      body.x[i] *= factor * freedom;
      body.y[i] *= factor * freedom;
    }
  }
  return forces;
}

// Verlet evaluates its force callback at exact node fractions. Acceleration,
// not coordinates or retained velocity, is modified by this adapter.
export function addContactForce(force, forces, chain, along) {
  const body = forces.get(chain);
  if (!body) return force;
  const i = Math.round(clamp(along, 0, 1) * (chain.count - 1));
  return { x: force.x + body.x[i], y: force.y + body.y[i] };
}
