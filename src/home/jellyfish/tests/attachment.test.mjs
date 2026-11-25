import test from "node:test";
import assert from "node:assert/strict";
import { skirtRimAt, visibleAttachmentFor } from "../geometry.mjs";
import { rotate } from "../math.mjs";

function fixture(lateral, layer, arm = false, pulse = 0, tilt = 0) {
  const jelly = { x: 195, y: 220, pulse, tilt, twist: 1.4, anatomyPhase: 2.1,
    bellWidth: () => 220 * (1 - 0.18 * pulse),
    bellHeight: () => 95 * (1 + 0.19 * pulse) };
  const p = rotate(lateral * jelly.bellWidth() * 0.43, jelly.bellHeight() * 0.034, tilt);
  const item = { arm, layer, chain: { x: [jelly.x + p.x, jelly.x + p.x + 6],
    y: [jelly.y + p.y, jelly.y + p.y + 10] } };
  return { jelly, item };
}

test("outer tentacles move inward while retaining their left/right order", () => {
  for (const depth of [-1.15, -0.65, 0, 0.55, 1.1]) {
    let previous = -Infinity;
    for (let i = -10; i <= 10; i++) {
      const lateral = i / 10;
      const { jelly, item } = fixture(lateral, depth);
      const root = visibleAttachmentFor(jelly, item, 8);
      assert.ok(root.u > previous);
      assert.ok(Math.abs(root.u) <= 0.70 + 1e-9);
      if (i !== 0) {
        assert.equal(Math.sign(root.u), Math.sign(i));
        assert.ok(Math.abs(root.u) < Math.min(0.76, Math.abs(lateral) * 0.86 * 0.92));
      }
      previous = root.u;
    }
  }
});

test("rear and front attachments have distinct depths on the same scalloped skirt", () => {
  for (const lateral of [-0.95, -0.5, 0, 0.5, 0.95]) {
    const roots = [-1, -0.5, 0, 0.5, 1].map(layer => {
      const { jelly, item } = fixture(lateral, layer);
      const root = visibleAttachmentFor(jelly, item, 8);
      return { u: root.u, inset: skirtRimAt(jelly, root.u, 8) - root.v };
    });
    for (let i = 1; i < roots.length; i++) assert.ok(roots[i].inset < roots[i - 1].inset);
    assert.ok(Math.abs(roots[0].u) <= Math.abs(roots[2].u));
    assert.ok(roots[0].inset - roots[4].inset > 0.03);
  }
});

test("attachment coordinates remain stable through pulse and lean without mutating the chain", () => {
  for (const lateral of [-0.95, -0.3, 0.3, 0.95]) {
    for (const layer of [-1, 0, 1]) {
      let reference;
      for (const pulse of [0, 0.5, 1]) {
        for (const tilt of [-0.115, 0, 0.115]) {
          const { jelly, item } = fixture(lateral, layer, false, pulse, tilt);
          const before = JSON.stringify(item.chain);
          const root = visibleAttachmentFor(jelly, item, 8);
          const inset = skirtRimAt(jelly, root.u, 8) - root.v;
          reference ??= { u: root.u, inset };
          assert.ok(Math.abs(root.u - reference.u) < 1e-9);
          assert.ok(Math.abs(inset - reference.inset) < 1e-9);
          assert.ok(Math.abs(item.chain.x[0] + root.x - root.rootX) < 1e-9);
          assert.ok(Math.abs(item.chain.y[0] + root.y - root.rootY) < 1e-9);
          assert.equal(JSON.stringify(item.chain), before);
        }
      }
    }
  }
});

test("oral arms keep the previous central attachment and do not depend on depth", () => {
  for (const layer of [-1, 0, 1]) {
    const { jelly, item } = fixture(0.65, layer, true, 0.5, 0.115);
    const root = visibleAttachmentFor(jelly, item, 8);
    assert.ok(Math.abs(root.u - 0.29) < 1e-9);
    assert.ok(Math.abs(root.v - skirtRimAt(jelly, root.u, 8) - 0.035) < 1e-9);
  }
});
