import { coyoteFooting } from "../../../multiplayer/src/chicken/coyote-route.mjs";
import { eaglePose } from "../../../multiplayer/src/chicken/contact.mjs";
import { pouncePose } from "../../../multiplayer/src/chicken/pounce.mjs";
import { drawCaughtFeathers, featherDuration } from "./chicken-plumage";
import { drawChickenEnvironment } from "./chicken-run-environment-renderer";
import { raceClimate } from "../../../multiplayer/src/chicken/encounters.mjs";
import { paintCoyote, paintEagle, paintFox, paintPerchedEagle } from "./chicken-predators";
import { birds, groundHeight } from "../../../multiplayer/src/chicken/race.mjs";
import { drawChickenBody } from "./chicken-run-renderer";
import { paletteForCycle } from "./chicken-run-sky";
import { cycleStateForElapsed } from "./chicken-run-cycle";

const daylight = paletteForCycle(cycleStateForElapsed(0));

export function drawBird(c, bird, x, y, frame = 0, airborne = false, sprint = false, vy = 0, landing = 0) {
  c.save();
  c.translate(x, y);
  if (sprint && !airborne) c.transform(1, 0, -0.065, 1, 0, 0);
  c.scale(.72, .72);
  drawChickenBody(c, {
    x: -21, y: -42, color: bird.color, shape: bird.shape,
    velocityY: -vy, grounded: !airborne, flapAvailable: airborne && Math.abs(vy) < 110, runFrame: frame,
    takeoffPulse: 0, flapPulse: 0, landingPulse: landing, rescuePulse: 0,
    invulnerable: false, eggCarried: false, slope: 0, crash: null,
  }, 0, 0, daylight);
  c.restore();
}
// Draw in world pixels so the lobby art and course share the same horizon.
function pasture(c, width, groundY, distance, elapsed, track) {
  const climate = raceClimate(track, elapsed);
  drawChickenEnvironment(c, {
    width, finish: track?.finish, height: c.canvas.height, groundY, distance, elapsed, cameraOffsetY: 0, groundHeight: x => groundHeight(track?.hills, x),
    cycle: climate.cycle,
    weather: climate.weather,
  });
  return climate;
}

export function drawPoster(canvas) {
  const c = canvas.getContext("2d");
  pasture(c, canvas.width, 76, 0, 0);
  birds.forEach((bird, index) => drawBird(c, bird, 61 + index * 45, 75, index));
}

export function drawRace(canvas, r, track, players, id, effects) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    ground = h - 38;
  const own = r.runners.find((p) => p.id === id);
  const bursting = p => r.time - (effects.catches.get(p?.id) ?? -Infinity) < featherDuration;
  const focus =
    own?.status === "running" || bursting(own)
      ? own
      : r.runners.find((p) => p.status === "running") || own || r.runners[0];
  const dt = Math.max(0, Math.min(0.1, r.time - (effects.lastTime ?? r.time)));
  effects.lastTime = r.time;
  const lead = Math.max(0, focus.vx - 72) * 0.17;
  effects.lead += (lead - effects.lead) * (1 - Math.exp(-dt * 6));
  const camera = focus.x - w * 0.3 + effects.lead;
  const X = x => x - camera;
  const rect = (color, x, y, width, height) => {
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };
  const text = (s, x, y, color = "#fff2d4") => {
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  c.font = "bold 12px monospace";
  const climate = pasture(c, w, ground, camera, Math.max(0, r.time), track);
  const floorAt = x => ground - groundHeight(track.hills, x);
  if (climate.icy) {
    // A continuous cap keeps the entire snow route readable over rolling hills.
    c.beginPath();
    for (let x = 0; x <= w + 4; x += 4) {
      const y = floorAt(camera + x);
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = climate.cycle.phase === "night" ? "#9fb5cc" : "#e9f2ed";
    c.lineWidth = 4;
    c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i < Math.ceil(w / 15 * climate.snowfall); i++) {
      const y = (i * 47 + r.time * (24 + i % 7)) % ground;
      const x = (i * 79 + Math.sin(y / 28 + i) * 6 + w) % w;
      rect("#dce5e5", x, y, 2, 2);
    }
  }
  for (let gx = Math.floor(camera / 31) * 31; gx < camera + w; gx += 31) {
    const x = X(gx), y = floorAt(gx);
    const bend = Math.sin(r.time * 3 + gx * 0.04) * climate.weather.windStrength * 2;
    const shade = climate.icy ? "#819a90" : climate.cycle.phase === "night" ? "#536650" : "#75884e";
    rect(shade, x, y - 3, 2, 3);
    rect(shade, x + bend + 1, y - 5, 1, 3);
    rect(shade, x + 4, y - 2, 2, 2);
  }
  if (climate.muddy || climate.icy) {
    for (const patch of track.mud ?? []) {
      const x = X(patch.x);
      rect(climate.icy ? "#779baa" : "#523c35", x, ground - 2, patch.width, 5);
      rect(climate.icy ? "#bce0e5" : "#987159", x + 2, ground - 2, patch.width - 4, 2);
      rect("#ede5cb", x + 4, ground - 2, 6, 1);
      if (climate.icy) {
        rect("#678b9e", x + 14, ground - 1, 4, 1);
        rect("#678b9e", x + 17, ground, 3, 1);
      }
    }
  }
  for (const p of track.roofs) {
    const x = X(p.x),
      y = ground - p.h;
    if (x > w || x + p.width < 0) continue;
    if (p.h <= 32 && track.version >= 4) {
      // Bound bales sit behind the ground lane and offer a one-way landing.
      rect("#9e713b", x, y, p.width, p.h);
      rect("#e5b85e", x, y, p.width, 3);
      for (let straw = 4; straw < p.width - 5; straw += 11)
        rect("#cea053", x + straw, y + 6 + straw % 9, 7, 2);
      for (const tie of [0.22, 0.77])
        rect("#725b38", x + p.width * tie, y, 2, p.h);
      continue;
    }
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
  if (coop < w + 96 && coop > -64) {
    rect("#655447", coop - 48, ground - 10, 10, 10);
    rect("#b5ada0", coop - 49, ground - 11, 12, 2);
    rect("#907658", coop - 73, ground - 19, 4, 19);
    rect("#ba9a6f", coop - 92, ground - 14, 21, 3);
  }
  if (coop > -64 && coop < w + 8) {
    rect("#ae6244", coop, ground - 39, 54, 39);
    for (let row = 0; row < 4; row++)
      rect("#89442f", coop, ground - 35 + row * 9, 54, 2);
    for (let tile = 0; tile < 7; tile++)
      rect("#d97b4d", coop - 5 + tile * 4, ground - 42 - tile * 3, 64 - tile * 8, 4);
    rect(climate.cycle.phase === "night" ? "#edbc69" : "#3e3733", coop + 5, ground - 25, 17, 25);
    rect("#ffe4a3", coop + 26, ground - 28, 27, 14);
    text("COOP", coop + 26, ground - 17, "#502c24");
  }
  const leap = r.pounce && pouncePose(r.pounce, r.time);
  const hawk = r.hawk ?? effects.eagle;
  if (hawk && !r.capture) {
    const lift = hawk.lift == null ? 0 : Math.max(0, r.time - hawk.lift);
    const remaining = Math.max(0, hawk.at - (hawk.lift ?? r.time));
    const x = X(hawk.x);
    const floor = ground - (hawk.surface ?? groundHeight(track.hills, hawk.x));
    const drift = Math.max(0, remaining - 0.9) * 45;
    if (hawk.lift == null) {
      rect("#382c3e", x - 5 - drift, floor - 2, 10, 3);
      rect("#524454", x - 16 - drift, floor - 4, 12, 2);
      rect("#524454", x + 4 - drift, floor - 4, 12, 2);
      rect("#efc379", x - 9 - drift, floor - 3, 18, 1);
    }
    const flight = eaglePose(hawk, track, r.time);
    if (r.pounce?.kind === "eagle") {
      const surface = r.pounce.rail?.h ?? groundHeight(track.hills, leap.x);
      const feet = ground - surface - leap.hop + leap.crouch;
      if (leap.moving) paintEagle(c, X(leap.x), feet - 8, 0.24, 0, r.time);
      else paintPerchedEagle(c, X(leap.x), feet, r.time);
    } else if (hawk.perched && r.time < hawk.lift) paintPerchedEagle(c, x, floor, r.time);
    else paintEagle(c, X(flight.x), ground - flight.y, flight.fold, lift, r.time);
  }
  if (r.coyote && !r.capture) {
    const coyote = r.coyote;
    const age = coyote.retreat == null ? 0 : r.time - coyote.retreat;
    const turn = Math.min(1, Math.max(0, (age - 0.56) / 0.28));
    const pose = r.pounce?.kind === "coyote" ? leap : null;
    const worldX = pose?.x ?? coyote.x;
    const footing = coyoteFooting(track, coyote, worldX);
    paintCoyote(c, X(worldX), ground - footing.y - (pose?.hop ?? 0) + (pose?.crouch ?? 0),
      turn, worldX, pose?.hop ?? footing.reach);
  }
  if (r.fox !== null && !r.capture) {
    const skid = r.foxRetreat == null ? -1 : r.time - r.foxRetreat;
    const pose = r.pounce?.kind === "fox" ? leap : null;
    const worldX = pose?.x ?? r.fox;
    const x = X(worldX), floor = floorAt(worldX) - (pose?.hop ?? 0) + (pose?.crouch ?? 0);
    if (climate.icy && skid < 0) {
      const first = Math.ceil((r.fox - 30) / 9) * 9;
      for (let print = first; print < r.fox - 8; print += 9) {
        rect("#839ba8", X(print), floorAt(print) + 2, 3, 1);
        rect("#839ba8", X(print) + 2, floorAt(print) + 1, 2, 1);
      }
    }
    const pivot = r.foxSkid ? 0.6 : 0.25;
    const turn = Math.min(1, Math.max(0, (skid - pivot + 0.14) / 0.28));
    paintFox(c, x, floor, worldX / 6, turn, pose?.hop ?? 0);
    if (skid < 0.25) {
      const dust = Math.floor(r.time * 16) % 5;
      rect("#d9b78e", x - 18 - dust, floor - 2 - dust, 4, 2);
      rect("#917361", x - 25 - dust, floor - 4, 3, 2);
    }
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
      x = X(p.x),
      y = ground - p.y;
    if (p.status === "caught") {
      if (p.caughtAt == null) drawCaughtFeathers(c, b.shape, x, y - 14, r.time - effects.catches.get(p.id));
      continue;
    }
    if (x < 8 || x > w - 20) {
      text(
        x < 8 ? "◀" : "▶",
        x < 8 ? 3 : w - 17,
        48 + info.bird * 15,
        b.color === "#393744" ? "white" : b.color,
      );
      continue;
    }
    let support = groundHeight(track.hills, p.x);
    for (const roof of track.roofs) {
      if (p.x >= roof.x && p.x <= roof.x + roof.width && p.y >= roof.h)
        support = Math.max(support, roof.h);
    }
    const shadow = Math.max(5, 15 - (p.y - support) / 7);
    rect("rgba(38,35,43,.42)", x - shadow / 2, ground - support, shadow, 2);
    const wetFeet = climate.muddy && track.mud.some(m => p.x >= m.x && p.x < m.x + m.width);
    if (!p.jumps && p.status === "running" && (wetFeet || climate.icy || p.burstLeft > 0)) {
      const tint = support > 0 ? "#dcba70" : climate.icy ? "#e3eff2" : wetFeet ? "#b2896c" : "#bba483";
      const stride = (p.x % 14) / 14;
      rect(tint, x - 8 - stride * 9, y - 2 - Math.sin(stride * Math.PI) * 5, 3, 2);
      rect(tint, x - 11 - stride * 5, y - 2 - stride * 3, 2, 1);
    }
    const airborne = p.jumps > 0;
    const last = effects.steps.get(p.id);
    const landed = !airborne && last?.airborne ? r.time : last?.landed ?? -Infinity;
    effects.steps.set(p.id, { airborne, landed });
    const stride = b.shape === "chick" ? 6.5 : 8;
    drawBird(c, b, x, y, p.x / stride + info.bird * 0.37, airborne,
      p.burstLeft > 0, p.vy, Math.max(0, 0.14 - (r.time - landed)));
    if (p.id === id) {
      rect("#302d32", x - 13, Math.round(y) - 42, 27, 14);
      text("YOU", x - 10, y - 31, "#ffe15a");
    }
  }
  if (r.capture) drawCatch(c, r, X, ground, track);
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

function drawCatch(c, race, X, ground, track) {
  const event = race.capture;
  const age = Math.max(0, race.time - event.at);
  if (age >= 0.95) return;
  const eagle = event.kind === "eagle";
  const coyote = event.kind === "coyote";
  const spring = Math.sin(Math.min(1, age / 0.2) * Math.PI);
  const carry = Math.max(0, age - 0.16);
  const turn = Math.min(1, Math.max(0, (age - 0.29) / 0.30));
  const worldX = event.x + (eagle ? carry * 68 : spring * 4 - Math.max(0, age - 0.52) * 68);
  const x = X(worldX);
  const hill = groundHeight(track.hills, worldX) - groundHeight(track.hills, event.x);
  const y = ground - event.y - (eagle ? carry * (26 + 88 * carry) : spring * 3 + hill);
  const gripX = x + (eagle ? 1 : (coyote ? 26 : 18) * Math.cos(turn * Math.PI));
  const gripY = y + (eagle ? 7 : coyote ? -19 : -11);
  const victims = race.runners.filter(p => p.caughtAt === event.at);
  c.save();
  c.globalAlpha = Math.min(1, (0.95 - age) / 0.2);
  // The puff stays at the point of impact as the predator carries the birds away.
  for (const p of victims) {
    drawCaughtFeathers(c, birds[p.bird].shape, X(p.x), ground - p.y - 10,
      age - 0.16, Math.min(16, Math.ceil(26 / victims.length)));
  }
  if (eagle) paintEagle(c, x, y, 0, carry, race.time);
  else if (coyote) paintCoyote(c, x, y, turn, worldX, spring * 4);
  else paintFox(c, x, y, worldX / 6 + spring, turn);
  victims.forEach((p, index) => {
    const grab = Math.min(1, age / 0.14);
    const spread = (index - (victims.length - 1) / 2) * 9;
    const px = X(p.x) + (gripX + spread - X(p.x)) * grab;
    const py = ground - p.y - 10 + (gripY - (ground - p.y - 10)) * grab;
    const b = birds[p.bird];
    c.save();
    c.translate(px, py);
    c.rotate(grab * (eagle ? 0.56 : -0.9));
    c.scale(1 - grab * 0.23, 1 - grab * 0.23);
    drawBird(c, b, 0, 10, 0, true);
    c.restore();

  });
  // Draw the closed claws or lower jaw in front of the captured plumage.
  c.fillStyle = eagle ? "#daa94a" : coyote ? "#dec19c" : "#ffdfa6";
  c.fillRect(gripX - 4, gripY + 1, eagle ? 2 : 8, 2);
  if (eagle) c.fillRect(gripX + 3, gripY + 1, 2, 3);
  c.restore();
}
