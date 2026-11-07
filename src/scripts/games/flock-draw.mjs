import { birds, finish } from "../../../multiplayer/src/chicken/race.mjs";
export function drawBird(c, b, x, y, frame = 0) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  const chick = b.shape === "chick",
    tall = b.shape === "rooster" || b.shape === "bantam";
  const box = (color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  if (chick) c.scale(0.78, 0.78);
  box("#e4b859", -6, -4, 3, 4);
  box("#e4b859", 3, -4, 3, frame % 2 ? 2 : 4);
  box("#e6dec0", -11, -14, 21, 10);
  box(b.color, -10, -16, 20, 11);
  box(b.color, 3, -23, 10, 12);
  box("#20252c", 9, -20, 2, 2);
  box("#ffbe4f", 13, -17, 5, 3);
  box(chick ? "#ffd64e" : "#ec5340", 4, -26, tall ? 10 : 5, tall ? 5 : 3);
  box(tall ? "#487f70" : b.color, -15, -19, 6, 8);
  if (tall) box("#375d67", -18, b.shape === "rooster" ? -25 : -22, 5, 10);
  box(b.shape === "round" ? "#a69b86" : "#ffffff66", -5, -13, 8, 3);
  c.restore();
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
  rect(r.fox === null ? "#657f92" : "#454962", 0, 0, w, h);
  rect("#edd299", w * 0.72, 23, 22, 22);
  for (let i = -1; i < w / 100 + 2; i++)
    rect(
      "#485f66",
      i * 100 - ((camera * 0.25) % 100),
      ground - 46 + (i % 3) * 6,
      130,
      65,
    );
  rect("#546e47", 0, ground, w, 8);
  rect("#685444", 0, ground + 8, w, 30);
  for (const p of track.roofs) {
    const x = X(p.x),
      y = ground - p.h;
    rect("#84694c", x + 5, y, 5, p.h);
    rect("#84694c", x + p.width - 10, y, 5, p.h);
    rect(p.h === 28 ? "#edb852" : "#b8684b", x, y, p.width, 7);
  }
  track.corn.forEach((p, i) => {
    if (!r.picked.includes(i))
      rect("#ffdb52", X(p.x) - 3, ground - p.h - 11, 6, 9);
  });
  rect("#ae6244", X(finish), ground - 48, 55, 48);
  rect("#eed49d", X(finish) - 5, ground - 52, 65, 7);
  rect("#3e3733", X(finish) + 14, ground - 25, 20, 25);
  if (r.hawk) {
    const x = X(r.hawk.x),
      t = Math.max(0, r.hawk.at - r.time);
    rect("#332e3b", x - 24, ground - 62, 48, 3);
    const y = ground - 65 - Math.min(1, t) * 100;
    rect("#392c31", x - 16, y - 5, 12, 4);
    rect("#392c31", x - 5, y, 15, 5);
    rect("#392c31", x + 9, y - 6, 10, 5);
  }
  if (r.fox !== null) {
    const x = X(r.fox);
    rect("#d57037", x - 15, ground - 15, 26, 10);
    rect("#e98a40", x + 7, ground - 23, 12, 14);
    rect("#d57037", x + 8, ground - 28, 4, 6);
    rect("#fff0cc", x - 21, ground - 20, 9, 5);
  }
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
    drawBird(c, b, x, y, Math.floor(r.time * 10));
    if (p.id === id) text("YOU", x - 10, y - 31, "#ffe15a");
  }
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
