// Decide once, on release, so a sprint swipe never spends a jump.
export function bindCourseGestures(canvas: HTMLCanvasElement, jump: () => void, sprint: () => void) {
  let start: { id: number; x: number; y: number; dragged: boolean } | undefined;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || start) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12)
      start.dragged = true;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const tap = !start.dragged && Math.hypot(dx, dy) <= 12;
    start = undefined;
    if (dx >= 32 && dx > 1.5 * Math.abs(dy)) sprint();
    else if (tap) jump();
  });
  const cancel = (event: PointerEvent) => {
    if (start?.id === event.pointerId) start = undefined;
  };
  canvas.addEventListener("lostpointercapture", cancel);
  canvas.addEventListener("pointercancel", cancel);
}
