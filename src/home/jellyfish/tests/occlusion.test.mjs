import test from "node:test";
import assert from "node:assert/strict";
import { JellyWorld } from "../world.mjs";
import { bellOcclusionContour, visibleAttachmentFor } from "../renderer.mjs";
import { buildOcclusionSpans, projectedBellPoint, trailOcclusionFor } from "../occlusion.mjs";
import { keepTrailDirection } from "../orientation.mjs";

// Independent Canvas-style affine matrix for checking projected glyph positions.
function affine() {
  let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
  return {
    translate(x, y) { e += a * x + c * y; f += b * x + d * y; },
    rotate(t) {
      const cos = Math.cos(t), sin = Math.sin(t);
      [a, b, c, d] = [a * cos + c * sin, b * cos + d * sin,
        c * cos - a * sin, d * cos - b * sin];
    },
    scale(x, y) { a *= x; b *= x; c *= y; d *= y; },
    point(x, y) { return { x: a * x + c * y + e, y: b * x + d * y + f }; },
  };
}

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

test("occlusion spans cover the original contour and reject distant tissue", () => {
  for (const [width, height] of [[390, 720], [960, 620]]) {
    const { jelly } = new JellyWorld(width, height, 1234);
    for (const pulse of [0, 0.5, 1]) {
      jelly.pulse = pulse;
      for (const tilt of [-0.31, 0, 0.31]) {
        const polygon = bellOcclusionContour(jelly, 17).map(p => projectedBellPoint(jelly, p, tilt));
        const overlaps = buildOcclusionSpans(polygon);
        for (let y = -jelly.bellHeight() * 1.3; y <= jelly.bellHeight() * 0.5; y += 3) {
          for (let x = -jelly.bellWidth() * 0.6; x <= jelly.bellWidth() * 0.6; x += 3) {
            if (inside({ x, y }, polygon)) assert.ok(overlaps(x, y, x, y));
          }
        }
        assert.ok(!overlaps(-2, jelly.bellHeight(), 2, jelly.bellHeight() + 4));
        assert.ok(!overlaps(jelly.bellWidth(), -2, jelly.bellWidth() + 4, 2));
      }
    }
  }
});

test("tissue culling uses the actual root-corrected Canvas projection at every orientation", () => {
  const { jelly } = new JellyWorld(390, 720, 1234);
  for (const physicalTilt of [-0.115, 0.115]) {
    jelly.tilt = physicalTilt;
    for (const tilt of [-0.31, 0, 0.31]) {
      for (const item of jelly.chains) {
        const attachment = visibleAttachmentFor(jelly, item, 17);
        const ctx = affine();
        ctx.rotate(tilt);
        ctx.rotate(-physicalTilt);
        ctx.translate(-jelly.x, -jelly.y);
        ctx.translate(attachment.x, attachment.y);
        keepTrailDirection(ctx, item, tilt - physicalTilt);
        let bounds;
        const mask = trailOcclusionFor(jelly, item, attachment, tilt,
          (...args) => { bounds = args; return true; });
        for (const { chain } of [item, ...item.branches]) {
          const a = 0, b = chain.count - 1;
          const p = ctx.point(chain.x[a], chain.y[a]);
          const q = ctx.point(chain.x[b], chain.y[b]);
          const pad = 2;
          assert.ok(mask.glyph(chain.x[a], chain.y[a], pad));
          const same = expected => expected.forEach((v, i) => assert.ok(Math.abs(v - bounds[i]) < 1e-8));
          same([p.x - pad, p.y - pad, p.x + pad, p.y + pad]);
          assert.ok(mask.stroke(chain.x[a], chain.y[a], chain.x[b], chain.y[b], pad));
          same([Math.min(p.x, q.x) - pad, Math.min(p.y, q.y) - pad,
            Math.max(p.x, q.x) + pad, Math.max(p.y, q.y) + pad]);
        }
      }
    }
  }
});
