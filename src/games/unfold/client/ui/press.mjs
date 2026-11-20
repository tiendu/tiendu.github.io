// Shared tactile feedback for pointer and keyboard input.
export function installMechanicalPress() {
  let active = null;

  const mark = (el, on) => {
    if (el?.matches?.("button") && !el.disabled)
      el.classList.toggle("is-pressed", on);
  };
  const clear = () => {
    mark(active, false);
    active = null;
  };

  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    clear();
    active = button;
    mark(active, true);
  }, true);

  for (const type of ["pointerup", "pointercancel"])
    document.addEventListener(type, clear, true);
  window.addEventListener("blur", clear);

  for (const [type, down] of [["keydown", true], ["keyup", false]]) {
    document.addEventListener(type, (event) => {
      if (event.key === " " || event.key === "Enter")
        mark(document.activeElement, down);
    }, true);
  }
}
