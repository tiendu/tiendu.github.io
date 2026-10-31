/** Update only changed counters so presence updates cannot restart their roll. */
export function updateNumberCounter(counter: HTMLElement, count: number): void {
  const value = Math.max(0, Math.floor(count));
  const previous = counter.dataset.count;
  if (previous === String(value)) return;
  const current = String(value).padStart(3, "0");
  const old = (previous ?? String(value)).padStart(current.length, "0");
  const animate = previous !== undefined && value > Number(previous);
  counter.dataset.count = String(value);
  counter.setAttribute("aria-label", `${value} ${value === 1 ? "explosion" : "explosions"}`);
  const icon = document.createElement("span");
  icon.textContent = "💥";
  icon.className = "number-counter-icon";
  icon.setAttribute("aria-hidden", "true");
  const digits = [...current].map((digit, index) => {
    const slot = document.createElement("span");
    slot.className = "number-counter-slot";
    slot.setAttribute("aria-hidden", "true");
    if (animate && old[index] !== digit) {
      const strip = document.createElement("span");
      strip.className = "number-counter-roll";
      for (const text of [old[index], digit]) {
        const face = document.createElement("span");
        face.textContent = text;
        strip.append(face);
      }
      slot.append(strip);
    } else slot.textContent = digit;
    return slot;
  });
  counter.replaceChildren(icon, ...digits);
  counter.classList.toggle("number-counter-hit", animate);
}
