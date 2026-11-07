import { paintEagle, paintFox } from "./chicken-predators";
import { birds, finish } from "../../../multiplayer/src/chicken/race.mjs";
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
function pasture(c, w, ground, camera, chase) {
  const box = (color, x, y, width, height) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), width, height);
  };
  const sky = c.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, chase ? "#586181" : "#7db9bd");
  sky.addColorStop(1, chase ? "#edaa80" : "#ffda91");
  box(sky, 0, 0, w, ground);
  const sun = Math.round(w * .76);
  box("#fff0ad", sun - 10, 10, 20, 26);
  box("#fff0ad", sun - 13, 14, 26, 18);
  for (let x = -180 - Math.round(camera * .12) % 180; x < w; x += 180) {
    box("#fbe5c0", x + 7, 24, 40, 4);
    box("#fbe5c0", x + 18, 20, 19, 5);
  }
  for (let x = 0; x < w; x += 6) {
    const hill = (x + camera * .16) / 72;
    const ridge = Math.round(ground * (.69 + .08 * Math.sin(hill) + .04 * Math.sin(2 * hill)));
    box("#789791", x, ridge, 6, ground - ridge);
    const field = Math.round(ground * (.82 + .05 * Math.cos((x + camera * .36) / 48)));
    box("#557969", x, field, 6, ground - field);
  }
  for (let x = -54 - Math.round(camera * .68) % 54; x < w; x += 54) {
    box("#a0a278", x, ground - 12, 54, 2);
    box("#697953", x + 4, ground - 17, 4, 17);
  }
  box("#b5b667", 0, ground - 2, w, 4);
  box("#756448", 0, ground + 2, w, 4);
  box("#54453e", 0, ground + 6, w, 34);
  for (let x = -29 - Math.round(camera) % 29; x < w; x += 29)
    box("#816851", x, ground + 13, 6, 2);
}

export function drawPoster(canvas) {
  const c = canvas.getContext("2d");
  pasture(c, canvas.width, 76, 0, false);
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
  pasture(c, w, ground, camera, r.fox !== null);
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
  rect("#ae6244", X(finish), ground - 48, 55, 48);
  rect("#eed49d", X(finish) - 5, ground - 52, 65, 7);
  rect("#3e3733", X(finish) + 14, ground - 25, 20, 25);
  if (r.hawk) {
    const x = X(r.hawk.x),
      t = Math.max(0, r.hawk.at - r.time);
    rect("#332e3b", x - 24, ground - 62, 48, 3);
    const y = ground - 65 - Math.min(1, t) * 100;
    paintEagle(c, x - 35 * t, y, t < 0.42);
  }
  if (r.fox !== null) paintFox(c, X(r.fox), ground, r.time * 12);
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
