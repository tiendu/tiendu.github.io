import test from "node:test";
import assert from "node:assert/strict";
import { bindWaterInput } from "../water-input.mjs";

function fixture() {
  const host = new EventTarget();
  const canvas = new EventTarget();
  const viewport = new EventTarget();
  viewport.scale = 1;
  canvas.getBoundingClientRect = () => ({ left: 20, top: 40, width: 390, height: 600 });
  const attrs = new Set();
  canvas.toggleAttribute = (name, present) => present ? attrs.add(name) : attrs.delete(name);
  canvas.removeAttribute = name => attrs.delete(name);
  let time = 0, active = true;
  const calls = [];
  const input = bindWaterInput(canvas, { host, viewport, now: () => time,
    isActive: () => active, disturb: (...args) => calls.push(args) });
  const send = (type, id = 1, x = 100, y = 140, target = canvas, pointerType = "touch", isPrimary = id === 1) => {
    time += 20;
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      target: { value: target }, pointerType: { value: pointerType },
      pointerId: { value: id }, clientX: { value: x }, clientY: { value: y },
      isPrimary: { value: isPrimary },
    });
    (pointerType === "touch" ? host : canvas).dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  };
  return { input, send, calls, attrs, host, viewport, canvas,
    setActive: value => { active = value; }, zoom: scale => {
      viewport.scale = scale;
      viewport.dispatchEvent(new Event("resize"));
    } };
}

test("tap emits one local impulse only after release", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointermove", 1, 102, 141);
  assert.equal(f.calls.length, 0);
  f.send("pointerup", 1, 102, 141);
  assert.deepEqual(f.calls, [[82, 101, 0, 0, 0.32]]);
});

test("drag emits bounded directional movement without an extra tap on release", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointermove", 1, 140, 120);
  f.send("pointermove", 1, 130, 140);
  f.send("pointerup", 1, 130, 140);
  assert.deepEqual(f.calls, [[120, 80, 100, -100], [110, 100, -100, 100]]);
});

test("pinch cancels pending tap even when second finger starts outside the canvas", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointerdown", 2, 220, 240, f.host);
  f.send("pointermove", 1, 80, 100);
  f.send("pointerup", 2);
  f.send("pointermove", 1, 150, 150);
  f.send("pointerup");
  assert.equal(f.calls.length, 0);
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.calls.length, 1);
});

test("second touch stops an existing drag without undoing prior water motion", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointermove", 1, 150, 140);
  f.send("pointerdown", 2);
  f.send("pointermove", 1, 170, 150);
  f.send("pointercancel", 2);
  f.send("pointermove", 1, 200, 160);
  f.send("pointerup");
  assert.equal(f.calls.length, 1);
});

test("native zoom reserves panning and restores touch interaction at normal scale", () => {
  const f = fixture();
  f.send("pointerdown");
  f.zoom(2);
  assert.ok(f.attrs.has("data-water-zoomed"));
  f.send("pointerup");
  f.send("pointerdown");
  f.send("pointermove", 1, 160, 140);
  f.send("pointerup");
  assert.equal(f.calls.length, 0);
  f.zoom(1);
  assert.ok(!f.attrs.has("data-water-zoomed"));
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.calls.length, 1);
});

test("cancellation, inactive state and leaving the canvas cannot emit a tap", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointercancel");
  f.send("pointerdown");
  f.setActive(false);
  f.send("pointerup");
  f.setActive(true);
  f.send("pointerdown");
  f.send("pointermove", 1, 500, 140);
  f.send("pointerup");
  assert.equal(f.calls.length, 0);
});

test("desktop hover still disturbs water; mouse history resets on exit", () => {
  const f = fixture();
  f.send("pointermove", 1, 100, 140, f.canvas, "mouse");
  f.send("pointermove", 1, 101, 139, f.canvas, "mouse");
  f.send("pointerleave", 1, 101, 139, f.canvas, "mouse");
  f.send("pointermove", 1, 180, 200, f.canvas, "mouse");
  assert.deepEqual(f.calls, [[80, 100, 0, 0], [81, 99, 50, -50], [160, 160, 0, 0]]);
});

test("reset and dispose remove pending gestures and all event listeners", () => {
  const f = fixture();
  f.send("pointerdown");
  f.input.reset();
  f.send("pointerup");
  f.zoom(2);
  f.input.dispose();
  assert.equal(f.attrs.size, 0);
  f.zoom(1);
  f.send("pointerdown");
  f.send("pointerup");
  f.send("pointermove", 1, 100, 140, f.canvas, "mouse");
  assert.equal(f.calls.length, 0);
  assert.equal(f.attrs.size, 0);
});
