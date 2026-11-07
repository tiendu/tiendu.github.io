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
function reset(message) {
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
  if (!p || view.race.time < 0 || view.race.over || p.status !== "running")
    return;
  if (key === "jump" && p.jumps < 2) audio.play("hop");
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
        (runner ? " · " + runner.status + " · " + runner.corn + " corn" : "");
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
      closePanel();
      window.dispatchEvent(new CustomEvent(GAME_EVENTS.chicken.solo, { detail: b }));
    } else send({ type: "bird", bird: i });
  };
  el("picks").append(button);
});
function feedback(old, r) {
  if (!old) return;
  if (old.picked.length < r.picked.length) audio.play("pickup");
  if (old.fox === null && r.fox !== null) audio.play("alarm");
  if (!old.rescued && r.rescued) audio.play("bonus");
  if (
    old.runners.find((p) => p.id === id)?.status === "running" &&
    mine()?.status === "caught"
  )
    audio.play("impact");
}
function end() {
  audio.stop();
  audio.play("clear");
  const r = view.race;
  status(
    r.runners.filter((p) => p.status === "home").length +
      " of " +
      r.runners.length +
      " made it home.",
  );
  refreshLobby();
  el("board").hidden = true;
}
function paint(time) {
  const r = view?.race;
  if (!r || r.over) return;
  if (r.fox !== null && mine()?.status === "running" && time >= nextPulse) {
    const pressure = Math.max(0, 1 - Math.abs(mine().x - r.fox) / 160);
    audio.play("pulse", pressure);
    nextPulse = time + 700 - 400 * pressure;
  }
  const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const width = Math.max(225, Math.round(256 * ratio));
  if (canvas.width !== width) canvas.width = width;
  const age = Math.min(0.1, (time - received) / 1000);
  const display = {
    ...r,
    runners: r.runners.map((p) => {
      const copy = { ...p };
      if (r.time >= 0 && p.status === "running")
        move(copy, age, track.roofs);
      return copy;
    }),
  };
  drawRace(canvas, display, track, view.players, id, 0);
  el("energy").value = mine()?.stamina ?? 0;
  frame = requestAnimationFrame(paint);
}
function begin() {
  cancelAnimationFrame(frame);
  received = performance.now();
  track = course(view.race.seed);
  el("board").hidden = false;
  status("Tap or Space to jump. Swipe right or press → to sprint. Three corn earn one rescue.");
  refreshLobby();
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
        pending = false;
        return;
      }
      if (!msg.players) return;
      const old = view?.race;
      view = msg;
      received = performance.now();
      if (msg.race && !msg.race.over) {
        if (!old || old.over) begin();
        else feedback(old, msg.race);
      } else if (msg.race?.over) {
        if (!old?.over) end();
        else refreshLobby();
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
  const url = new URL(location.href);
  url.searchParams.set("game", "chicken");
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
  reset("Left the race.");
};
el("jump").onclick = () => submit("jump");
el("sprint").onclick = () => submit("down");
bindCourseGestures(canvas, () => submit("jump"), () => submit("down"));
document.addEventListener("keydown", (e) => {
  if (el("board").hidden || e.repeat || e.target.closest("input")) return;
  if (
    e.code === "Space" &&
    !e.target.closest("[data-game-sound],[data-leave],[data-flock-exit]")
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
  if (url.searchParams.get("game") === "chicken") {
    const code = new URLSearchParams(url.hash.slice(1)).get("room");
    if (code && /^\d{6}$/.test(code)) {
      showFriends();
      el("code-form").hidden = false;
      el("code").value = code;
      root.dataset.online = "";
      url.hash = "";
    }
    url.searchParams.delete("game");
    history.replaceState(history.state, "", url);
  }
  el("flock-exit").focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent(GAME_EVENTS.chicken.status, {
    detail: { game: "chicken", text: "CHICKEN RUN", pauseDisabled: true }
  }));
});
