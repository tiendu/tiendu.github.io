const TAP_DISTANCE = 6;
const TAP_IMPULSE = 0.32;
const limitSpeed = value => Math.max(-100, Math.min(100, value));

// Pointer events share one water input path. A touch gesture is owned by the
// first finger until release; another finger cancels that ownership for good.
export function bindWaterInput(canvas, { isActive, disturb,
  host = window, viewport = host.visualViewport, now = () => performance.now() }) {
  const touches = new Set();
  let gesture = null;
  let mouse = null;
  let zoomed = false;
  const passive = { passive: true };
  const capture = { passive: true, capture: true };

  const point = event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y, time: now() };
  };

  const emit = (p, previous) => {
    const dt = previous ? Math.max(16, p.time - previous.time) / 1000 : 1;
    disturb(p.x, p.y, previous ? limitSpeed((p.x - previous.x) / dt) : 0,
      previous ? limitSpeed((p.y - previous.y) / dt) : 0);
  };

  const reset = () => {
    touches.clear();
    gesture = null;
    mouse = null;
  };

  const syncZoom = () => {
    const next = (viewport?.scale ?? 1) > 1.01;
    if (next !== zoomed) gesture = null;
    zoomed = next;
    canvas.toggleAttribute("data-water-zoomed", zoomed);
  };

  const down = event => {
    if (event.pointerType !== "touch") return;
    touches.add(event.pointerId);
    mouse = null;
    if (touches.size !== 1 || event.isPrimary === false) {
      gesture = null;
      return;
    }
    if (event.target !== canvas || zoomed || !isActive()) return;
    const p = point(event);
    if (p) gesture = { id: event.pointerId, start: p, previous: p, dragged: false };
  };

  const touchMove = event => {
    if (event.pointerType !== "touch" || gesture?.id !== event.pointerId) return;
    if (zoomed || !isActive()) { gesture = null; return; }
    const p = point(event);
    if (!p) { gesture = null; return; }
    if (!gesture.dragged) {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) < TAP_DISTANCE) return;
      gesture.dragged = true;
    }
    // Keep very high-rate touch streams from accumulating extra impulses.
    if (p.time - gesture.previous.time < 16) return;
    if (Math.hypot(p.x - gesture.previous.x, p.y - gesture.previous.y) < 0.75) return;
    emit(p, gesture.previous);
    gesture.previous = p;
  };

  const finish = event => {
    if (event.pointerType !== "touch") return;
    if (gesture?.id === event.pointerId) {
      if (event.type === "pointerup" && !gesture.dragged && !zoomed && isActive()) {
        const p = point(event);
        if (p && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) < TAP_DISTANCE) {
          // A deliberate tap is one slightly stronger, still bounded impulse.
          // Wait for release so a pinch's first finger never fires a tap.
          disturb(p.x, p.y, 0, 0, TAP_IMPULSE);
        }
      }
      gesture = null;
    }
    touches.delete(event.pointerId);
  };

  const mouseMove = event => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (touches.size || !isActive()) { mouse = null; return; }
    const p = point(event);
    if (!p) { mouse = null; return; }
    emit(p, mouse);
    mouse = p;
  };
  const leave = event => {
    if (event.pointerType !== "touch") mouse = null;
  };

  // Capture touch starts anywhere, including a second finger outside the
  // canvas. All listeners are passive; the browser owns pinch and zoomed pan.
  host.addEventListener("pointerdown", down, capture);
  host.addEventListener("pointermove", touchMove, capture);
  host.addEventListener("pointerup", finish, capture);
  host.addEventListener("pointercancel", finish, capture);
  host.addEventListener("blur", reset);
  canvas.addEventListener("pointermove", mouseMove, passive);
  canvas.addEventListener("pointerleave", leave, passive);
  viewport?.addEventListener("resize", syncZoom, passive);
  syncZoom();

  return { reset, dispose() {
    reset();
    host.removeEventListener("pointerdown", down, capture);
    host.removeEventListener("pointermove", touchMove, capture);
    host.removeEventListener("pointerup", finish, capture);
    host.removeEventListener("pointercancel", finish, capture);
    host.removeEventListener("blur", reset);
    canvas.removeEventListener("pointermove", mouseMove, passive);
    canvas.removeEventListener("pointerleave", leave, passive);
    viewport?.removeEventListener("resize", syncZoom, passive);
    canvas.removeAttribute("data-water-zoomed");
  } };
}
