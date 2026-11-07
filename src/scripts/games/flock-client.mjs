import { featherDuration } from "./chicken-plumage";
import { raceClimate } from "../../../multiplayer/src/chicken/encounters.mjs";
import { createSolo, restoreSolo, readSolo, saveSolo, advanceSolo, soloInput, tickMs } from "./flock-solo.mjs";
import { hasClassicRun } from "./chicken-run";
import { bindCourseGestures } from "./chicken-gestures";
import {
  birds,
  course,
  input,
  move,
} from "../../../multiplayer/src/chicken/race.mjs";
import { drawBird, drawPoster, drawRace } from "./flock-draw.mjs";
import { mountGameSound } from "./shared/game-sound";

import { GAME_EVENTS, readGameCommand } from "./shared/events";

const root = document.querySelector("[data-flock]");
const el = (key) => root.querySelector("[data-" + key + "]");
const audio = mountGameSound(root, "chicken-run");
const canvas = el("board").querySelector("canvas");
// CSS handles rotation and window sizing. Read layout only when the board changes.
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  if (width && height) canvas.width = Math.max(225, Math.round(256 * width / height));
}).observe(canvas);
drawPoster(el("poster"));
let ws = null,
  id = "",
  view = null,
  choosingSolo = false,
  room = "",
  track,
  frame = 0,
  received = 0,
  pending = false;
const status = (msg) => {
  el("status").textContent = msg;
};
const send = (msg) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
};
const name = () => el("name").value.trim() || "Player";
const mine = () => view?.race?.runners.find((p) => p.id === id);
let nextPulse = 0;
let endpoint;
try {
  endpoint = new URL(root.dataset.endpoint);
  if (!["http:", "https:"].includes(endpoint.protocol)) endpoint = null;
} catch {}
let generation = 0;
let local = null;
let paused = false;
let savedSolo;
function startSolo(run) {
  choosingSolo = false;
  local = run;
  paused = false;
  id = run.players[0].id;
  view = run;
  saveSolo(run);
  begin();
}
function pauseSolo() {
  if (!local || local.race.over) return;
  paused = !paused;
  received = performance.now();
  el("pause").textContent = paused ? "Resume" : "Pause";
  if (paused) {
    saveSolo(local);
    cancelAnimationFrame(frame);
  } else frame = requestAnimationFrame(paint);
}
el("pause").onclick = pauseSolo;
el("retry").onclick = () => startSolo(createSolo(mine().bird));
el("menu").onclick = () => reset("");
el("resume").onclick = () => startSolo(restoreSolo(savedSolo));
el("classic").onclick = () => {
  closePanel();
  window.dispatchEvent(new CustomEvent(GAME_EVENTS.chicken.solo, { detail: birds[2] }));
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && local && !paused) pauseSolo();
});
function reset(message) {
  if (local) saveSolo(local);
  local = null;
  paused = false;
  savedSolo = readSolo();
  el("resume").hidden = !savedSolo;
  el("classic").hidden = !hasClassicRun();
  el("practice").hidden = true;
  generation++;
  const old = ws;
  ws = null;
  old?.close();
  cancelAnimationFrame(frame);
  audio.stop();
  id = "";
  view = null;
  choosingSolo = false;
  pending = false;
  delete root.dataset.online;
  el("code-form").hidden = true;
  el("modes").hidden = false;
  el("setup").hidden = el("back").hidden = true;
  el("lobby").hidden = el("board").hidden = el("leave").hidden = true;
  el("join").disabled = el("create").disabled = !endpoint;

  status(message);
}
function submit(key) {
  const p = mine();
  if (!p || paused || view.race.time < 0 || view.race.over || p.status !== "running")
    return;
  if (key === "jump" && p.jumps < 2) audio.play("hop");
  if (local) return soloInput(local, key);
  send({ type: "input", key });
  input(p, key);
}
function refreshLobby() {
  const { players, host, race } = view;
  const running = race && !race.over;
  el("setup").hidden = true;
  el("leave").hidden = false;
  el("lobby").hidden = Boolean(running);
  el("back").hidden = true;
  el("room").textContent = "Room " + room;
  el("invite").hidden = false;
  el("start").hidden = id !== host;
  el("start").disabled = players.filter((p) => p.online).length < 2;
  el("start").textContent = race?.over ? "Race again" : "Start race";
  el("roster").replaceChildren(
    ...players.map((p) => {
      const li = document.createElement("li");
      const runner = race?.over
        ? race.runners.find((r) => r.id === p.id)
        : null;
      li.textContent =
        p.name +
        " · " +
        birds[p.bird].name +
        (p.id === id ? " · YOU" : "") +
        (p.id === host ? " · HOST" : "") +
        (runner ? " · " + runner.status + " · " + Math.floor(runner.x).toLocaleString() + " steps · " + runner.corn + " corn" : "");
      return li;
    }),
  );
  [...el("picks").children].forEach((button, i) => {
    const owner = players.find((p) => p.bird === i);
    button.disabled = Boolean(owner && owner.id !== id);
    button.setAttribute("aria-pressed", String(owner?.id === id));
  });
}
birds.forEach((b, i) => {
  const button = document.createElement("button"),
    portrait = document.createElement("canvas");
  portrait.width = 48;
  portrait.height = 33;
  portrait.style.cssText =
    "width:48px;height:33px;display:block;background:transparent";
  drawBird(portrait.getContext("2d"), b, 24, 31);
  const label = document.createElement("small");
  label.textContent = b.trait;
  label.style.display = "block";
  button.append(portrait, b.name, label);
  button.onclick = () => {
    if (choosingSolo) {
      startSolo(createSolo(i));
    } else send({ type: "bird", bird: i });
  };
  el("picks").append(button);
});
function soundState(r) {
  return { corn: r.picked.length, fox: r.fox, coyote: !!r.coyote, rescued: r.rescued,
    phase: raceClimate(track, r.time).cycle.phase,
    status: r.runners.find(p => p.id === id)?.status };
}
function feedback(previous, r) {
  if (r.coyote && !previous.coyote) audio.play("yip");
  if (previous.corn < r.picked.length) audio.play("pickup");
  if (previous.fox === null && r.fox !== null) audio.play("alarm");
  if (r.courseVersion >= 3 && previous.phase !== "sunset" && raceClimate(track, r.time).cycle.phase === "sunset") audio.play("bark");
  if (!previous.rescued && r.rescued) audio.play("bonus");
  if (previous.status === "running" && mine()?.status === "caught") audio.play("impact");
}
const progress = el("progress");
const distanceText = el("distance");
function updateDistance() {
  if (!track || !mine()) return;
  const distance = Math.min(track.finish, Math.floor(mine().x));
  if (progress.max === track.finish && progress.value === distance) return;
  progress.max = track.finish;
  progress.value = distance;
  distanceText.textContent = (track.finish - distance).toLocaleString() + " steps to coop";
}
// Presentation state stays on each client. A finished race stops receiving server ticks.
const effects = { steps: new Map(), catches: new Map(), eagle: null };
function drawFrame(r) {
  for (const bird of r.runners) {
    if (bird.status === "caught" && !effects.catches.has(bird.id))
      effects.catches.set(bird.id, r.time);
  }
  if (r.coyote || r.fox !== null) effects.eagle = null;
  if (r.capture) effects.eagle = null;
  else if (r.hawk) effects.eagle = r.hawk;
  else if (effects.eagle && effects.eagle.lift == null) {
    // A delayed room snapshot can skip the server's first pull-up frame.
    effects.eagle = { ...effects.eagle, lift: Math.min(r.time, effects.eagle.at) };
  }
  if (effects.eagle?.lift != null && r.time - effects.eagle.lift > 2.4) effects.eagle = null;
  drawRace(canvas, r, track, view.players, id, effects);
}
function end() {
  updateDistance();
  audio.stop();
  audio.play(mine()?.status === "caught" ? "impact" : "clear");
  const r = view.race;
  status(
    r.runners.filter((p) => p.status === "home").length +
      " of " +
      r.runners.length +
      " made it home.",
  );
  if (local) {
    const result = mine().status === "home" ? "Made it to the coop!" : "Caught!";
    saveSolo(local);
    status(result + " Collected " + mine().corn + " corn.");
    el("pause").disabled = true;
  }
  if (!track || el("board").hidden) {
    if (!local) refreshLobby();
    return;
  }
  cancelAnimationFrame(frame);
  const started = performance.now();
  const finishFrame = now => {
    const age = Math.max(0, (now - started) / 1000);
    drawFrame({ ...r, time: r.time + age });
    if (age < Math.max(featherDuration, r.hawk || effects.eagle ? 2.4 : 0)) {
      frame = requestAnimationFrame(finishFrame);
    } else if (!local) {
      el("board").hidden = true;
      refreshLobby();
    }
  };
  finishFrame(started);
}
let previousRoomRace;
let previousFox;
let previousCoyoteX;
function paint(time) {
  const r = view?.race;
  if (!r || r.over) return;
  if (local && !paused) {
    received = Math.max(received, time - 250);
    while (time - received >= tickMs && !r.over) {
      const previous = soundState(r);
      previousFox = r.fox;
      previousCoyoteX = r.coyote?.x;
      advanceSolo(local);
      feedback(previous, r);
      received += tickMs;
    }
    if (r.over) return end();
  }
  if (!paused && r.fox !== null && r.foxRetreat == null && mine()?.status === "running" && time >= nextPulse) {
    const pressure = Math.max(0, 1 - Math.abs(mine().x - r.fox) / 160);
    audio.play("pulse", pressure);
    nextPulse = time + 700 - 400 * pressure;
  }
  const age = Math.max(0, Math.min(0.1, (time - received) / 1000));
  const climate = raceClimate(track, r.time);
  const wetPatches = climate.muddy || climate.icy ? track.mud : null;
  const interval = local ? tickMs / 1000 : r.time - (previousRoomRace?.time ?? r.time);
  const blend = interval > 0 ? Math.min(1, age / interval) : 1;
  const lastFox = local ? previousFox : previousRoomRace?.fox;
  const lastCoyote = local ? previousCoyoteX : previousRoomRace?.coyote?.x;
  const display = {
    ...r,
    time: r.time + (paused ? 0 : Math.max(0, age)),
    coyote: r.coyote && Number.isFinite(lastCoyote)
      ? { ...r.coyote, x: lastCoyote + (r.coyote.x - lastCoyote) * blend } : r.coyote,
    fox: Number.isFinite(lastFox) && Number.isFinite(r.fox)
      ? lastFox + (r.fox - lastFox) * blend : r.fox,
    runners: r.runners.map((p) => {
      const old = !local && p.id !== id && previousRoomRace?.runners.find(b => b.id === p.id);
      if (old && old.status === p.status && p.status === "running") {
        return { ...p, x: old.x + (p.x - old.x) * blend, y: old.y + (p.y - old.y) * blend };
      }
      const copy = { ...p };
      if (!paused && r.time >= 0 && p.status === "running")
        move(copy, age, track.roofs, track.hills, wetPatches, climate.icy);
      return copy;
    }),
  };
  drawFrame(display);
  updateDistance();
  frame = requestAnimationFrame(paint);
}
function begin() {
  previousRoomRace = null;
  previousFox = null;
  previousCoyoteX = null;
  effects.lead = 0;
  effects.lastTime = null;
  effects.steps.clear();
  effects.catches.clear();
  effects.eagle = null;
  cancelAnimationFrame(frame);
  received = performance.now();
  track = course(view.race.seed, view.race.courseVersion ?? 1);
  el("board").hidden = false;
  status("Tap or Space to jump. Swipe right or press → to sprint. Three corn earn one rescue.");
  if (local) {
    el("modes").hidden = el("lobby").hidden = el("back").hidden = true;
    el("practice").hidden = false;
    el("pause").disabled = false;
    el("pause").textContent = "Pause";
    canvas.focus({ preventScroll: true });
  } else refreshLobby();
  frame = requestAnimationFrame(paint);
}
async function connect(create) {
  if (pending || ws || !endpoint) return;
  if (!create && !el("code-form").reportValidity()) return;
  const attempt = generation;
  pending = true;
  root.dataset.online = "";
  el("create").disabled = el("join").disabled = true;
  let token;
  try {
    room = el("code").value;
    if (create) {
      const res = await fetch(new URL("/chicken/rooms", endpoint), {
        method: "POST",
      });
      if (!res.ok)
        throw Error(
          res.status === 503
            ? "All race rooms are busy."
            : "Could not create room.",
        );
      const result = await res.json();
      if (attempt !== generation) return;
      ({ room, token } = result);
    }
    const url = new URL("/chicken/rooms/" + room, endpoint);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    ws = socket;
    root.dataset.online = "";
    status("Connecting…");
    socket.onopen = () => {
      if (ws === socket) send({ type: "join", name: name(), token });
    };
    socket.onmessage = (e) => {
      if (ws !== socket) return;
      const msg = JSON.parse(e.data);
      if (msg.error) {
        if (!id) reset(msg.error);
        else status(msg.error);
        return;
      }
      if (msg.id) {
        id = msg.id;
        history.replaceState(history.state, "", "#room=" + room);
        pending = false;
        return;
      }
      if (!msg.players) return;
      const old = view?.race;
      previousRoomRace = old;
      view = msg;
      received = performance.now();
      if (msg.race && !msg.race.over) {
        if (!old || old.over) begin();
        else feedback(soundState(old), msg.race);
      } else if (msg.race?.over) {
        if (!old?.over) end();
        else if (el("board").hidden) refreshLobby();
      } else {
        refreshLobby();
        status("Choose your chicken. The host starts with 2–5 players.");
      }
    };
    socket.onclose = () => {
      if (ws === socket) reset("Disconnected. Join again for the next race.");
    };
  } catch (e) {
    if (attempt === generation) reset(e.message);
  }
}
function showFriends() {
  el("modes").hidden = true;
  el("setup").hidden = el("back").hidden = false;
  root.dataset.online = "";
  status(endpoint ? "Race to the coop with 2–5 players." : "Online rooms are unavailable.");
}
el("friends").onclick = showFriends;
el("solo").onclick = () => {
  choosingSolo = true;
  el("modes").hidden = true;
  el("lobby").hidden = el("back").hidden = false;
  el("room").textContent = "Choose your chicken";
  el("start").hidden = el("invite").hidden = true;
  el("roster").replaceChildren();
  for (const button of el("picks").children) {
    button.disabled = false;
    button.removeAttribute("aria-pressed");
  }
  status("");
  el("picks").firstElementChild.focus();
};
el("back").onclick = () => {
  reset("");
  el("solo").focus();
};
el("create").onclick = () => connect(true);
el("join").onclick = () => {
  root.dataset.online = "";
  el("code-form").hidden = false;
  el("code").focus();
};
el("code-form").onsubmit = (e) => {
  e.preventDefault();
  connect(false);
};
el("start").onclick = () => send({ type: "start" });
el("invite").onclick = async () => {
  const url = new URL("/games/chicken/", location.origin);
  url.hash = "room=" + room;
  try {
    await navigator.clipboard.writeText(url.href);
    status("Invite copied.");
  } catch {
    status(url.href);
  }
};
el("leave").onclick = () => {
  send({ type: "leave" });
  history.replaceState(history.state, "", location.pathname);
  reset("Left the race.");
};
el("jump").onclick = () => submit("jump");
el("sprint").onclick = () => submit("down");
bindCourseGestures(canvas, () => submit("jump"), () => submit("down"));
document.addEventListener("keydown", (e) => {
  if (local && !e.repeat && e.code === "KeyP") pauseSolo();
  if (el("board").hidden || e.repeat || e.target.closest("input")) return;
  if (
    e.code === "Space" &&
    !e.target.closest("[data-game-sound],[data-leave],[data-flock-exit],[data-practice]")
  ) {
    e.preventDefault();
    submit("jump");
  }
  if (e.key === "ArrowRight" || e.key === "Shift") {
    e.preventDefault();
    submit("down");
  }
});
window.addEventListener("pagehide", () => reset("Left the race."));
function closePanel() {
  send({ type: "leave" });
  reset("");
  root.hidden = true;
}
function exitArcade() {
  closePanel();
  window.dispatchEvent(new CustomEvent(GAME_EVENTS.chicken.exit, { detail: { flock: true } }));
}

el("flock-exit").onclick = exitArcade;
window.addEventListener(GAME_EVENTS.chicken.command, (event) => {
  if (!root.hidden && readGameCommand(event) === "exit") exitArcade();
});
document.addEventListener("keydown", (event) => {
  if (!root.hidden && event.key === "Escape") exitArcade();
});
window.addEventListener(GAME_EVENTS.chicken.start, () => {
  reset("");
  root.hidden = false;
  const url = new URL(location.href);
  const code = new URLSearchParams(url.hash.slice(1)).get("room");
  if (code && /^\d{6}$/.test(code)) {
    showFriends();
    el("code-form").hidden = false;
    el("code").value = code;
    root.dataset.online = "";
  }
  el("flock-exit").focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent(GAME_EVENTS.chicken.status, {
    detail: { game: "chicken", text: "CHICKEN RUN", pauseDisabled: true }
  }));
});
