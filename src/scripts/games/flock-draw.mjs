import { drawChickenEnvironment } from "./chicken-run-environment-renderer";
import { weatherStateForElapsed } from "./chicken-run-weather";
import { paintEagle, paintFox } from "./chicken-predators";
import { birds, groundHeight } from "../../../multiplayer/src/chicken/race.mjs";
import { drawChickenBody } from "./chicken-run-renderer";
import { paletteForCycle } from "./chicken-run-sky";
import { cycleStateForElapsed } from "./chicken-run-cycle";

const daylight = paletteForCycle(cycleStateForElapsed(0));

export function drawBird(c, bird, x, y, frame = 0, airborne = false) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(.72, .72);
  drawChickenBody(c, {
    x: -21, y: -42, color: bird.color, shape: bird.shape,
    velocityY: 0, grounded: !airborne, flapAvailable: airborne, runFrame: frame,
    takeoffPulse: 0, flapPulse: 0, landingPulse: 0, rescuePulse: 0,
    invulnerable: false, eggCarried: false, slope: 0, crash: null,
  }, 0, 0, daylight);
  c.restore();
}
// Draw in world pixels so the lobby art and course share the same horizon.
function pasture(c, width, groundY, distance, elapsed, track) {
  drawChickenEnvironment(c, {
    width, height: c.canvas.height, groundY, distance, elapsed, cameraOffsetY: 0, groundHeight: x => groundHeight(track?.hills, x),
    cycle: cycleStateForElapsed(elapsed + (track?.skyOffset ?? 0)),
    weather: weatherStateForElapsed(elapsed * (track?.weatherRate ?? 1) + (track?.weatherOffset ?? 0)),
  });
}

export function drawPoster(canvas) {
  const c = canvas.getContext("2d");
  pasture(c, canvas.width, 76, 0, 0);
  birds.forEach((bird, index) => drawBird(c, bird, 61 + index * 45, 75, index));
}

export function drawRace(canvas, r, track, players, id, elapsed) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    ground = h - 38;
  const own = r.runners.find((p) => p.id === id);
  const focus =
    own?.status === "running"
      ? own
      : r.runners.find((p) => p.status === "running") || own || r.runners[0];
  const camera = focus.x - w * 0.3,
    X = (x) => Math.round(x - camera);
  const rect = (color, x, y, width, height) => {
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };
  const text = (s, x, y, color = "#fff2d4") => {
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  c.font = "bold 12px monospace";
  pasture(c, w, ground, camera, Math.max(0, r.time), track);
  for (const p of track.roofs) {
    const x = X(p.x),
      y = ground - p.h;
    rect("#84694c", x + 5, y, 5, p.h);
    rect("#84694c", x + p.width - 10, y, 5, p.h);
    rect("#5e483b", x + 7, y + 6, p.width - 14, 3);
    rect(p.h === 28 ? "#edb852" : "#b8684b", x, y, p.width, 7);
    rect("#f8ca83", x, y, p.width, 2);
    for (let tile = 8; tile < p.width - 4; tile += 13)
      rect("#955c45", x + tile, y + 3, 2, 3);
  }
  track.corn.forEach((p, i) => {
    if (r.picked.includes(i)) return;
    const x = X(p.x), y = ground - p.h - 12;
    rect("#704e33", x - 4, y, 8, 10);
    rect("#ffd35a", x - 2, y - 2, 5, 10);
    rect("#fff4a4", x - 1, y, 2, 4);
    rect("#71a859", x - 5, y + 5, 3, 5);
  });
  const coop = X(track.finish);
  if (coop > -64 && coop < w + 8) {
    rect("#ae6244", coop, ground - 39, 54, 39);
    for (let row = 0; row < 4; row++)
      rect("#89442f", coop, ground - 35 + row * 9, 54, 2);
    for (let tile = 0; tile < 7; tile++)
      rect("#d97b4d", coop - 5 + tile * 4, ground - 42 - tile * 3, 64 - tile * 8, 4);
    rect("#3e3733", coop + 5, ground - 25, 17, 25);
    rect("#ffe4a3", coop + 26, ground - 28, 27, 14);
    text("COOP", coop + 26, ground - 17, "#502c24");
  }
  if (r.hawk) {
    const x = X(r.hawk.x),
      t = Math.max(0, r.hawk.at - r.time);
    rect("#332e3b", x - 24, ground - 62, 48, 3);
    const y = ground - 65 - Math.min(1, t) * 100;
    paintEagle(c, x - 35 * t, y, t < 0.42);
  }
  if (r.fox !== null) paintFox(c, X(r.fox), ground - groundHeight(track.hills, r.fox), r.time * 12);
  if (r.time < 0) {
    r.runners.forEach((p, i) => {
      const info = players.find((v) => v.id === p.id);
      if (!info) return;
      const x = ((i + 1) * w) / (r.runners.length + 1);
      drawBird(c, birds[info.bird], x, ground, 0);
      c.textAlign = "center";
      text(info.name, x, ground + 18);
      if (p.id === id) text("▼ YOU", x, ground - 38, "#ffe15a");
      c.textAlign = "left";
    });
    rect("#302d32", 7, 16, 84, 19);
    text("START IN " + Math.ceil(-r.time), 12, 30);
    return;
  }
  const ordered = [...r.runners].sort(
    (a, b) => Number(a.id === id) - Number(b.id === id),
  );
  for (const p of ordered) {
    const info = players.find((v) => v.id === p.id);
    if (!info || p.status === "away") continue;
    const b = birds[info.bird],
      x = X(p.x + (p.status === "running" && r.time >= 0 ? p.vx * elapsed : 0)),
      y = ground - p.y;
    if (x < 8 || x > w - 20) {
      text(
        x < 8 ? "◀" : "▶",
        x < 8 ? 3 : w - 17,
        48 + info.bird * 15,
        b.color === "#393744" ? "white" : b.color,
      );
      continue;
    }
    if (p.status === "caught") {
      text("×", x, y);
      continue;
    }
    drawBird(c, b, x, y, Math.floor(r.time * 10), p.jumps > 0);
    if (p.id === id) {
      rect("#302d32", x - 13, Math.round(y) - 42, 27, 14);
      text("YOU", x - 10, y - 31, "#ffe15a");
    }
  }
  rect("#302d32", 4, 4, 144, 19);
  text(
    "CORN " +
      r.picked.length +
      "  EGG " +
      (r.rescued
        ? "USED"
        : r.picked.length >= 3
          ? "READY"
          : r.picked.length + "/3"),
    9,
    18,
  );
  if (r.time < 0) text(String(Math.ceil(-r.time)), w / 2, 55);
}
