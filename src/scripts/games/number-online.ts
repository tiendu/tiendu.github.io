export interface OnlineState {
  type: "state"; player: string; host: string; phase: "lobby" | "playing" | "over";
  players: {id: string; name: string; connected: boolean; away: number | null}[];
  order: string[]; turn: string | null; low: number; high: number;
  revision: number; round: number; guesses: number; over: boolean; loser: string | null;
  loserName: string; lastGuess: number | null; expires: number; target?: number;
}
interface Hooks {
  mode: (active: boolean) => void;
  state: (state: OnlineState) => void;
  connection: (ready: boolean) => void;
}
export function mountNumberOnline(root: HTMLElement, hooks: Hooks) {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const create = get<HTMLButtonElement>("[data-number-create]");
  const copy = get<HTMLButtonElement>("[data-number-copy]");
  const leave = get<HTMLButtonElement>("[data-number-leave]");
  const info = get("[data-number-online-status]");
  const link = get<HTMLInputElement>("[data-number-invite]");
  const panel = get("[data-number-room]");
  const form = get("[data-number-join-form]");
  const name = get<HTMLInputElement>("[data-number-name]");
  const code = get<HTMLInputElement>("[data-number-code]");
  const joinButton = get<HTMLButtonElement>("[data-number-join]");
  const start = get<HTMLButtonElement>("[data-number-start]");
  const roster = get("[data-number-roster]");
  const mode = get("[data-number-mode]");
  const dialog = get<HTMLDialogElement>("[data-number-online-dialog]");
  const onlineForm = get<HTMLFormElement>("[data-number-online-form]");
  const submit = get<HTMLButtonElement>("[data-number-online-submit]");
  const dialogStatus = get("[data-number-dialog-status]");
  const codeField = get("[data-number-code-field]");
  let intent: "create" | "join" = "create";
  let creating: AbortController | undefined;
  let attempt = 0;
  const openDialog = (action: "create" | "join") => {
    if (!endpoint) return;
    intent = action; dialogStatus.textContent = ""; submit.disabled = false;
    get("[data-number-online-title]").textContent = action === "create" ? "Create room" : "Join room";
    submit.textContent = action === "create" ? "CREATE ROOM" : "JOIN ROOM";
    codeField.hidden = action !== "join";
    code.disabled = action !== "join";
    dialog.showModal();
    (name.value.trim() && action === "join" && !code.value ? code : name).focus();
  };
  get("[data-number-online-cancel]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { attempt++; creating?.abort(); creating = undefined; submit.disabled = false; });
  // Keep modal Enter/digit keys away from the pass-and-play keypad handler.
  dialog.addEventListener("keydown", event => event.stopPropagation());
  try { name.value = localStorage.getItem("number-display-name") || ""; } catch { /* Optional. */ }
  const validName = () => {
    const value = name.value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim().replace(/\s+/g, " ");
    name.value = value;
    if (!value || [...value].length > 16) { dialogStatus.textContent = "Enter your name (1–16 characters)."; name.focus(); return false; }
    try { localStorage.setItem("number-display-name", value); } catch { /* Optional. */ }
    return true;
  };
  let endpoint: URL | undefined;
  try {
    endpoint = new URL(root.dataset.backendUrl || "");
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) endpoint = undefined;
  } catch { /* Online play stays unavailable until configured. */ }
  let room = "";
  let token = "";
  let socket: WebSocket | undefined;
  let latest: OnlineState | undefined;
  let retry = 0;
  let retryTimer = 0;
  let heartbeat = 0;
  let pongAt = 0;
  let active = false;
  let suspended = false;
  let pending = false;
  let ready = false;
  const identityKey = () => `number-player:${room}`;
  const eligible = () => active && ready && !pending && latest?.phase === "playing" && latest.order.filter(id => latest?.players.find(p => p.id === id)?.connected).length >= 2 && latest.turn === latest.player;
  const notify = (value: boolean) => { ready = value; hooks.connection(value); renderRoom(); };
  const clear = () => { clearTimeout(retryTimer); clearInterval(heartbeat); };
  const stop = () => { clear(); const old = socket; socket = undefined; old?.close(1000, "Leaving"); notify(false); };
  const statusText = (s: OnlineState) => {
    if (s.phase === "lobby") return s.host === s.player ? "You host this room. Start when everyone is here (at least 2 players)." : "Waiting for the host to start.";
    if (s.over) return `${s.loserName} hit ${s.target}! ` + (s.host === s.player ? "Start the next round when everyone is ready." : "Waiting for the host to start the next round.");
    if (!s.order.includes(s.player)) return "You’ll join the next round. Watch this one!";
    if (s.order.filter(id => s.players.find(p => p.id === id)?.connected).length < 2) return "Paused: waiting for another player to reconnect.";
    const current = s.players.find(p => p.id === s.turn);
    if (!current?.connected) return `Waiting for ${current?.name || "a player"} to reconnect (up to 30 seconds), then skipping their turn.`;
    return s.turn === s.player ? "Your turn!" : `Waiting for ${current.name}…`;
  };
  const renderRoom = () => {
    if (!latest) return;
    const s = latest;
    get("[data-number-roster-title]").textContent = `PLAYERS ${s.players.length}/20 · ${s.players.filter(p => p.connected).length} ONLINE`;
    roster.replaceChildren(...s.players.map(p => {
      const li = document.createElement("li");
      const tags = [p.id === s.player ? "you" : "", p.id === s.host ? "host" : "", !p.connected ? "offline" : "",
        s.phase === "playing" && !s.order.includes(p.id) ? "next round" : "", s.phase === "playing" && p.id === s.turn ? "current turn" : ""].filter(Boolean);
      li.textContent = p.name + (tags.length ? ` · ${tags.join(" · ")}` : "");
      li.classList.toggle("number-current-player", s.phase === "playing" && p.id === s.turn);
      return li;
    }));
    start.hidden = s.phase !== "lobby" || s.host !== s.player;
    start.disabled = !ready || pending || s.players.filter(p => p.connected).length < 2;
  };
  const connect = () => {
    if (!active || suspended || !endpoint) return;
    clear();
    notify(false);
    pending = false;
    info.textContent = retry ? "Reconnecting…" : "Connecting…";
    const url = new URL(`/rooms/${room}`, endpoint);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      ws.send(JSON.stringify({ type: "join", token: token || undefined, name: name.value.trim() }));
      pongAt = Date.now();
      heartbeat = window.setInterval(() => {
        if (Date.now() - pongAt > 65000) { ws.close(); return; }
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25000);
    };
    ws.onmessage = (event) => {
      if (socket !== ws) return;
      if (event.data === "pong") { pongAt = Date.now(); return; }
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "joined") {
        token = data.token;
        try { localStorage.setItem(identityKey(), token); } catch { /* In-memory token still allows reconnect. */ }
      } else if (data.type === "state") {
        latest = data as OnlineState;
        pending = false; retry = 0;
        ready = true;
        info.textContent = statusText(latest);
        renderRoom();
        hooks.state(latest);
        hooks.connection(true);
      } else if (data.type === "error") {
        pending = false;
        info.textContent = data.message;
        renderRoom();
        hooks.connection(ready);
      }
    };
    ws.onclose = (event) => {
      if (socket !== ws) return;
      clear(); notify(false); pending = false;
      if (!active || suspended) return;
      if (event.code >= 4000 || retry >= 5) {
        info.textContent = event.code === 4003 ? "Room is full." : event.code === 4002 ? "This player connected in another tab." : event.code === 4004 ? "Room expired. Leave and create a new room." : event.code === 4001 ? "Your seat could not be restored. Leave, then join again with your name." : "Unable to connect. Reload to retry, or leave this room.";
        return;
      }
      info.textContent = "Connection lost. Reconnecting…";
      retryTimer = window.setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
    };
    ws.onerror = () => { /* onclose handles retry without exposing internals. */ };
  };
  const join = (id: string, hostToken?: string) => {
    if (!endpoint) { info.textContent = "Online play is not configured yet."; return; }
    room = id; token = hostToken || "";
    if (!token) { try { token = localStorage.getItem(identityKey()) || ""; } catch { /* optional */ } }
    if (hostToken) { try { localStorage.setItem(identityKey(), hostToken); } catch { /* optional */ } }
    latest = undefined; active = true; retry = 0;
    hooks.mode(true);
    panel.hidden = false; form.hidden = true; mode.textContent = "ONLINE · 2–20 PLAYERS";
    get("[data-number-room-code]").textContent = `ROOM ${room}`;
    const invite = new URL(location.pathname, location.origin);
    invite.hash = `room=${room}`;
    link.value = invite.href;
    history.replaceState(null, "", invite);
    connect();
  };
  create.disabled = !endpoint; joinButton.disabled = !endpoint;
  info.textContent = endpoint ? "Play locally or online with 2–20 players." : "Pass-and-play is ready. Online play will appear after the backend is configured.";
  for (const button of [create, joinButton]) button.addEventListener("keydown", event => event.stopPropagation());
  create.addEventListener("click", () => openDialog("create"));
  joinButton.addEventListener("click", () => openDialog("join"));
  onlineForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!endpoint || submit.disabled || !validName()) return;
    if (intent === "join") {
      if (!/^\d{6}$/.test(code.value.trim())) { dialogStatus.textContent = "Enter the six-digit room code."; code.focus(); return; }
      dialog.close(); join(code.value.trim()); return;
    }
    const current = ++attempt;
    const controller = new AbortController(); creating = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    submit.disabled = true; dialogStatus.textContent = "Creating room…";
    try {
      const response = await fetch(new URL("/rooms", endpoint), { method: "POST", signal: controller.signal });
      if (!dialog.open || current !== attempt) return;
      if (response.status === 503) { dialogStatus.textContent = "All rooms are busy or temporarily unavailable. Try again later."; return; }
      if (response.status === 429) { dialogStatus.textContent = "Too many attempts. Wait a minute and try again."; return; }
      if (!response.ok) throw new Error("create");
      const data = await response.json();
      if (!dialog.open || current !== attempt) return;
      dialog.close(); join(data.room, data.token);
    } catch {
      if (dialog.open && current === attempt) dialogStatus.textContent = "Could not create a room. Check your connection and try again.";
    } finally {
      clearTimeout(timeout);
      if (current === attempt) { creating = undefined; submit.disabled = false; }
    }
  });
  start.addEventListener("click", () => send("start"));
  leave.addEventListener("click", () => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:"leave"}));
    try { localStorage.removeItem(identityKey()); } catch { /* Optional. */ }
    active = false; stop(); latest = undefined; token = "";
    panel.hidden = true; form.hidden = false; mode.textContent = "PASS & PLAY";
    history.replaceState(null, "", location.pathname);
    hooks.mode(false);
    info.textContent = "Back to pass-and-play. Your local round is preserved.";
  });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(link.value); info.textContent = "Invite copied. Share it with your group."; }
    catch { link.focus(); link.select(); info.textContent = "Copy the selected invite link."; }
  });
  const send = (type: "guess" | "start", value?: number) => {
    if (!ready || pending || !latest || socket?.readyState !== WebSocket.OPEN) return;
    pending = true;
    socket.send(JSON.stringify({ type, value, revision: latest.revision }));
    hooks.connection(true); renderRoom();
  };
  window.addEventListener("pagehide", () => { suspended = true; stop(); });
  window.addEventListener("pageshow", () => { if (suspended) { suspended = false; connect(); } });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && active && (!socket || socket.readyState > 1 || Date.now() - pongAt > 65000)) {
      stop(); retry = 0; connect();
    }
  });
  const invited = new URLSearchParams(location.hash.slice(1)).get("room");
  // Defer until the local game's controller has retained this API.
  if (invited && /^\d{6}$/.test(invited)) {
    code.value = invited;
    let saved = "";
    try { saved = localStorage.getItem(`number-player:${invited}`) || ""; } catch { /* Optional. */ }
    if (saved) queueMicrotask(() => join(invited));
    else queueMicrotask(() => openDialog("join"));
  }
  return { isActive: () => active, canPlay: eligible, state: () => latest,
    guess: (value: number) => send("guess", value), rematch: () => send("start"), canStart: () => ready && !pending && latest?.host === latest?.player && (latest?.players.filter(p => p.connected).length ?? 0) >= 2 };
}
