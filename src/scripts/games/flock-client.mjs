import {
  birds,
  course,
  input,
  move,
  newRace,
  step,
} from "../../../multiplayer/src/chicken/race.mjs";
import { drawBird, drawRace } from "./flock-draw.mjs";
import { mountGameSound } from "./shared/game-sound";

const root = document.querySelector("[data-flock]");
const el = (key) => root.querySelector("[data-" + key + "]");
const audio = mountGameSound(root, "chicken");
const canvas = root.querySelector("canvas");
let ws = null,
  id = "",
  view = null,
  local = false,
  room = "",
  track,
  frame = 0,
  last = 0,
  debt = 0,
  received = 0,
  held = false,
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
function reset(message) {
  const old = ws;
  ws = null;
  old?.close();
  cancelAnimationFrame(frame);
  audio.stop();
  id = "";
  view = null;
  local = false;
  held = false;
  pending = false;
  delete root.dataset.online;
  el("setup").hidden = false;
  el("lobby").hidden = el("board").hidden = el("leave").hidden = true;
  el("join").disabled = el("create").disabled = !endpoint;
  el("practice").disabled = false;
  status(message);
}
function submit(key) {
  const p = mine();
  if (!p || view.race.time < 0 || view.race.over || p.status !== "running")
    return;
  if (key === "jump" && p.jumps < 2) audio.play("hop");
  if (!local) send({ type: "input", key });
  input(p, key);
}
function release() {
  if (held) {
    held = false;
    submit("up");
  }
}
function refreshLobby() {
  const { players, host, race } = view;
  const running = race && !race.over;
  el("setup").hidden = true;
  el("leave").hidden = false;
  el("lobby").hidden = Boolean(running);
  el("room").textContent = local ? "Solo practice" : "Room " + room;
  el("invite").hidden = local;
  el("start").hidden = id !== host;
  el("start").disabled = !local && players.filter((p) => p.online).length < 3;
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
        (p.id === host && !local ? " · HOST" : "") +
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
  button.append(portrait, b.name);
  button.onclick = () => {
    if (local) {
      view.players[0].bird = i;
      refreshLobby();
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
  held = false;
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
  const delta = Math.min(0.2, (time - last) / 1000);
  last = time;
  if (local) {
    const old = {
      picked: [...r.picked],
      fox: r.fox,
      rescued: r.rescued,
      runners: [{ id, status: mine()?.status }],
    };
    debt += delta;
    while (debt >= 0.05 && !r.over) {
      step(r, track);
      debt -= 0.05;
    }
    feedback(old, r);
    if (r.over) {
      end();
      return;
    }
  }
  if (r.fox !== null && mine()?.status === "running" && time >= nextPulse) {
    const pressure = Math.max(0, 1 - Math.abs(mine().x - r.fox) / 160);
    audio.play("pulse", pressure);
    nextPulse = time + 700 - 400 * pressure;
  }
  const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const width = Math.max(225, Math.round(256 * ratio));
  if (canvas.width !== width) canvas.width = width;
  const age = local ? 0 : Math.min(0.1, (time - received) / 1000);
  const display = local
    ? r
    : {
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
  held = false;
  last = received = performance.now();
  debt = 0;
  track = course(view.race.seed);
  el("board").hidden = false;
  status("Reach the coop. Three corn earn one flock rescue.");
  refreshLobby();
  frame = requestAnimationFrame(paint);
}
async function connect(create) {
  if (pending || ws || !endpoint) return;
  if (!create && !el("code-form").reportValidity()) return;
  pending = true;
  el("practice").disabled = el("create").disabled = el("join").disabled = true;
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
      ({ room, token } = await res.json());
    }
    const url = new URL("/chicken/rooms/" + room, endpoint);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    ws = socket;
    root.dataset.online = "";
    status("Connecting…");
    socket.onopen = () => send({ type: "join", name: name(), token });
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
        status("Choose your chicken. The host starts with 3–5 players.");
      }
    };
    socket.onclose = () => {
      if (ws === socket) reset("Disconnected. Join again for the next race.");
    };
  } catch (e) {
    reset(e.message);
  }
}
el("practice").onclick = () => {
  local = true;
  id = "solo";
  view = {
    players: [{ id, name: name(), bird: 0, online: true }],
    host: id,
    race: null,
  };
  refreshLobby();
  status("Choose your chicken.");
};
el("create").onclick = () => connect(true);
el("join").onclick = () => {
  el("code-form").hidden = false;
  el("code").focus();
};
el("code-form").onsubmit = (e) => {
  e.preventDefault();
  connect(false);
};
el("start").onclick = () => {
  if (local) {
    view.race = newRace([id], crypto.getRandomValues(new Uint32Array(1))[0]);
    begin();
  } else send({ type: "start" });
};
el("invite").onclick = async () => {
  const url = new URL(location.href);
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
el("sprint").onpointerdown = (e) => {
  e.preventDefault();
  e.target.setPointerCapture(e.pointerId);
  held = true;
  submit("down");
};
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  el("sprint").addEventListener(event, release);
window.addEventListener("blur", release);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) release();
});
document.addEventListener("keydown", (e) => {
  if (el("board").hidden || e.repeat || e.target.closest("input")) return;
  if (
    e.code === "Space" &&
    !e.target.closest("[data-game-sound],[data-leave]")
  ) {
    e.preventDefault();
    submit("jump");
  }
  if (e.key === "Shift") {
    held = true;
    submit("down");
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "Shift") release();
});
window.addEventListener("pagehide", () => reset("Left the race."));
reset(
  endpoint
    ? "Choose solo or join a flock."
    : "Online rooms are unavailable. Solo is ready.",
);
const code = new URLSearchParams(location.hash.slice(1)).get("room");
if (code && /^\d{6}$/.test(code)) {
  el("code-form").hidden = false;
  el("code").value = code;
}
