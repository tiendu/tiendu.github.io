import test from "node:test";
import assert from "node:assert/strict";
import { reelFace, REEL_FACES } from "../client/ui/reel.mjs";
import { installMechanicalPress } from "../client/ui/press.mjs";

function classes() {
  const values = new Set();
  return {
    values,
    add(name) { values.add(name); },
    remove(...names) { for (const name of names) values.delete(name); },
    toggle(name, on) { if (on) values.add(name); else values.delete(name); },
  };
}

test("the six reel stops keep their order and clear animation state", () => {
  assert.deepEqual(REEL_FACES, ["DEPLOY", "DEPLOY", "SUPER", "RECLAIM", "RECLAIM", "REFOLD"]);
  const previousDoc = globalThis.document;
  const previousWindow = globalThis.window;
  const reel = { classList: classes(), style: {}, offsetHeight: 10,
    innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const housing = { classList: classes(), offsetHeight: 10 };
  globalThis.document = {
    getElementById: () => reel,
    querySelector: () => housing,
  };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    for (let i = 1; i <= 6; i++) {
      reel.classList.add("spinning");
      housing.classList.add("spinning");
      reelFace(i);
      assert.equal(reel.innerHTML, `<span>${REEL_FACES[i - 1]}</span>`);
      assert.equal(reel.attrs["data-face"], String(i));
      assert.equal(reel.classList.values.has("spinning"), false);
      assert.equal(housing.classList.values.has("clunk"), true);
    }
  } finally {
    globalThis.document = previousDoc;
    globalThis.window = previousWindow;
  }
});

test("mechanical press handles pointer, keyboard, and blur", () => {
  const previousDoc = globalThis.document;
  const previousWindow = globalThis.window;
  const documentHandlers = new Map();
  const windowHandlers = new Map();
  const button = { disabled: false, classList: classes(), matches: value => value === "button" };
  const doc = {
    activeElement: button,
    addEventListener(type, callback) { documentHandlers.set(type, callback); },
  };
  globalThis.document = doc;
  globalThis.window = {
    addEventListener(type, callback) { windowHandlers.set(type, callback); },
  };
  try {
    installMechanicalPress();
    documentHandlers.get("pointerdown")({ target: { closest: () => button } });
    assert.equal(button.classList.values.has("is-pressed"), true);
    documentHandlers.get("pointerup")();
    assert.equal(button.classList.values.has("is-pressed"), false);
    documentHandlers.get("keydown")({ key: "Enter" });
    assert.equal(button.classList.values.has("is-pressed"), true);
    documentHandlers.get("keyup")({ key: "Enter" });
    assert.equal(button.classList.values.has("is-pressed"), false);
    documentHandlers.get("keydown")({ key: " " });
    documentHandlers.get("keyup")({ key: " " });
    documentHandlers.get("pointerdown")({ target: { closest: () => button } });
    windowHandlers.get("blur")();
    assert.equal(button.classList.values.has("is-pressed"), false);
  } finally {
    globalThis.document = previousDoc;
    globalThis.window = previousWindow;
  }
});
