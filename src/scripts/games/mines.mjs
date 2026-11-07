import {
  createSoloBoard,
  frontier,
  play,
} from "../../../multiplayer/src/mines/board.mjs";

export function mountMines() {
  const root = document.querySelector(".mines");
  const el = (id) => root.querySelector("#" + id);
  const status = (text) => {
    el("status").textContent = text;
  };
  const colors = ["#ffcf59", "#82d1fd", "#fa9e9b", "#b1e198", "#cca9ff"];
  const base = root.dataset.backend.replace(/\/$/, "");
  let room = location.hash.slice(1),
    socket,
    me,
    key,
    hostToken,
    snapshot;
  let mode = "dig",
    centered = -1,
    leaving = false,
    retry;
  const saved = () => "mines-room-" + room;
  function joinForm(show) {
    el("code-label").hidden = !show;
    el("code").required = show;
    el("create").textContent = show ? "Enter room" : "Create room";
    el("join").textContent = show ? "Back" : "Join room";
  }
  if (/^\d{6}$/.test(room)) {
    joinForm(true);
    el("code").value = room;
  }
  el("join").onclick = () => {
    joinForm(el("code-label").hidden);
    if (!el("code-label").hidden) el("code").focus();
  };
  el("entry").onsubmit = async (event) => {
    event.preventDefault();
    if (!base)
      return status(
        "Online rooms are unavailable until the Mines backend is configured.",
      );
    el("solo").disabled = el("create").disabled = true;
    try {
      if (el("code-label").hidden) {
        const res = await fetch(base + "/mines/rooms", { method: "POST" });
        if (!res.ok) throw Error(await res.text());
        const result = await res.json();
        room = result.room;
        hostToken = result.token;
      } else room = el("code").value;
      key = sessionStorage.getItem(saved());
      history.replaceState(null, "", "#" + room);
      connect();
    } catch (e) {
      status(e.message);
      el("solo").disabled = el("create").disabled = false;
    }
  };
  function connect() {
    leaving = false;
    status("Connecting…");
    const ws = new WebSocket(
      base.replace(/^http/, "ws") + "/mines/rooms/" + room,
    );
    socket = ws;
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "join",
          name: el("name").value,
          token: hostToken,
          key,
        }),
      );
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.error) {
        status(msg.error);
        if (!me) {
          el("entry").hidden = false;
          el("lobby").hidden = el("field").hidden = true;
          leaving = true;
          ws.close();
          el("solo").disabled = el("create").disabled = false;
        }
      } else if (msg.you) {
        me = msg.you;
        key = msg.key;
        sessionStorage.setItem(saved(), key);
        el("entry").hidden = true;
        el("lobby").hidden = false;
      } else {
        snapshot = msg;
        render();
      }
    };
    ws.onclose = (event) => {
      if (leaving || ws !== socket) return;
      if (me && ![1000, 1001, 1008].includes(event.code)) {
        me = null;
        status("Connection lost. Rejoining…");
        retry = setTimeout(connect, 1200);
      } else {
        me = null;
        el("entry").hidden = false;
        el("lobby").hidden = el("field").hidden = true;
        el("solo").disabled = el("create").disabled = false;
        el("code").value = room;
        joinForm(true);
        status(
          event.reason ||
            "Could not connect. Check the room code and try again.",
        );
      }
    };
  }
  function startSolo() {
    try {
      const board = createSoloBoard();
      me = board.players[0];
      snapshot = {
        host: me,
        players: [],
        board,
        round: (snapshot?.round ?? 0) + 1,
      };
      el("entry").hidden = true;
      el("lobby").hidden = false;
      el("dig").click();
      render();
    } catch (error) {
      status(error.message);
    }
  }
  el("solo").onclick = startSolo;

  function send(type, cell) {
    if (me === "solo") {
      if (type === "start") return startSolo();
      const board = snapshot.board;
      try {
        if (type === "finish" && board.status === "connected")
          board.status = "won";
        else play(board, me, type, cell);
        render();
      } catch (error) {
        status(error.message);
      }
      return;
    }
    if (socket?.readyState === WebSocket.OPEN && snapshot)
      socket.send(
        JSON.stringify({
          type,
          cell,
          move: snapshot.move,
          round: snapshot.round,
        }),
      );
  }
  el("invite").onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      status("Invite copied.");
    } catch {
      status("Share this link: " + location.href);
    }
  };
  el("leave").onclick = () => {
    if (me === "solo") {
      me = snapshot = undefined;
      centered = -1;
      el("lobby").hidden = el("field").hidden = true;
      el("entry").hidden = false;
      status("");
      el("solo").focus();
      return;
    }
    leaving = true;
    clearTimeout(retry);
    send("leave");
    socket?.close();
    sessionStorage.removeItem(saved());
    location.replace(location.pathname);
  };
  el("start").onclick = () => send("start");
  el("pass").onclick = () => send("pass");
  el("finish").onclick = () => send("finish");
  for (const action of ["dig", "flag"])
    el(action).onclick = () => {
      mode = action;
      for (const id of ["dig", "flag"])
        el(id).setAttribute("aria-pressed", String(mode === id));
      if (snapshot?.board) render();
    };
  function center(tile) {
    const vp = el("viewport"),
      b = el("tiles").children[tile];
    if (b) {
      vp.scrollLeft +=
        b.getBoundingClientRect().left -
        vp.getBoundingClientRect().left -
        (vp.clientWidth - b.clientWidth) / 2;
      vp.scrollTop +=
        b.getBoundingClientRect().top -
        vp.getBoundingClientRect().top -
        (vp.clientHeight - b.clientHeight) / 2;
    }
  }
  function render() {
    const { players, board, host, round, ping } = snapshot;
    const active = board && ["digging", "connected"].includes(board.status);
    const solo = me === "solo";
    const spectator = board && !board.players.includes(me);
    const paused =
      !solo &&
      board &&
      players.filter((p) => p.online && board.players.includes(p.id)).length <
        2;
    const current = players.find((p) => p.id === snapshot.turn);
    const myTurn = solo || me === snapshot.turn;
    el("turn").hidden = solo || !active;
    el("turn").textContent = spectator
      ? "Watching · You’re in next round."
      : paused
        ? "Paused · Waiting for a teammate."
        : myTurn
          ? "Your turn · Dig one tile."
          : (current?.name ?? "Teammate") +
            (current?.online ? "’s turn" : " · Reconnecting…");
    el("pass").hidden = solo || !active || paused || !myTurn;
    el("crew").hidden = el("invite").hidden = el("ping-help").hidden = solo;
    el("room-label").textContent = solo ? "SOLO" : "ROOM " + room;
    el("start").hidden = !!active || me !== host;
    el("start").disabled = !solo && players.filter((p) => p.online).length < 2;
    el("start").textContent = board ? "Next round" : "Start round";
    el("finish").hidden =
      board?.status !== "connected" || me !== host || paused;
    el("crew").replaceChildren(
      ...players.map((p, i) => {
        const b = document.createElement("button");
        const seat = board?.players.includes(p.id)
          ? board.players.indexOf(p.id)
          : i;
        b.textContent =
          seat +
          1 +
          " · " +
          p.name +
          (p.id === me ? " (you)" : "") +
          (active && !board.players.includes(p.id)
            ? " · next round"
            : active && p.id === snapshot.turn
              ? " · current turn"
              : "") +
          (p.online ? "" : " · offline");
        b.disabled = !!board && !board.players.includes(p.id);
        b.style.color = colors[seat];
        b.onclick = () => board && center(board.starts[seat]);
        return b;
      }),
    );
    el("field").hidden = !board;
    if (!board) return status("Gather 2–5 players. The host starts the round.");
    el("fuses").textContent =
      board.fuseCell === undefined
        ? board.fuses + "/2 FUSES"
        : board.fuses
          ? "FUSE READY"
          : "NO FUSE";
    const tiles = el("tiles"),
      edge = frontier(board, me);
    if (centered !== round) {
      tiles.style.setProperty("--size", board.size);
      tiles.replaceChildren(
        ...board.cells.map((_, n) => {
          const b = document.createElement("button");
          b.onclick = () => {
            const current = snapshot.board;
            if (current.cells[n] !== null && current.cells[n] >= 0)
              send("ping", n);
            else send(mode === "flag" && current.flags[n] ? "unflag" : mode, n);
          };
          return b;
        }),
      );
    }
    board.cells.forEach((value, n) => {
      const b = tiles.children[n],
        flag = board.players.indexOf(board.flags[n]),
        start = board.starts.indexOf(n);
      b.disabled =
        !active ||
        spectator ||
        paused ||
        (mode === "dig" && value === null && !myTurn) ||
        (solo && value !== null) ||
        value === -1 ||
        (value === null && !edge.has(n));
      b.className =
        "tile " +
        (value !== null ? "open" : edge.has(n) ? "edge" : "") +
        (value === -1 ? " crater" : "");
      if (n === ping?.cell) b.classList.add("ping");
      b.textContent =
        value === -1
          ? "✹"
          : value === null
            ? flag >= 0
              ? "⚑"
              : ""
            : String(value);
      b.style.color = flag >= 0 ? colors[flag] : "";
      const fuse = value === null && n === board.fuseCell;
      b.classList.toggle("buried-fuse", fuse);
      if (start >= 0 || n === board.exit || fuse) {
        const mark = document.createElement("small");
        mark.textContent =
          start >= 0 ? "⚑" + (start + 1) : fuse ? "FUSE" : "EXIT";
        mark.style.color = fuse ? "#ffac72" : colors[start] || "#ffd45c";
        b.append(mark);
      }
      b.setAttribute(
        "aria-label",
        "Row " +
          (1 + Math.floor(n / board.size)) +
          ", column " +
          (1 + (n % board.size)) +
          ", " +
          (value === null
            ? flag >= 0
              ? "flagged by player " + (flag + 1)
              : "covered"
            : value === -1
              ? "crater"
              : "clue " + value) +
          (start >= 0
            ? ", pennant " + (start + 1)
            : n === board.exit
              ? ", exit"
              : fuse
                ? ", buried fuse"
                : ""),
      );
    });
    if (centered !== round) {
      centered = round;
      center(board.starts[board.players.indexOf(me)]);
    }
    const labels = {
      digging: solo
        ? "Dig a path to the exit."
        : "Connect every pennant to the exit.",
      connected:
        "Exit connected! Take the win or keep digging for a perfect clear.",
      won: solo ? "You escaped!" : "Crew escaped!",
      lost: "Out of fuses.",
      perfect: "Perfect clear!",
    };
    status(
      ping
        ? (players.find((p) => p.id === ping.id)?.name || "Crew") +
            " pinged row " +
            (1 + Math.floor(ping.cell / board.size)) +
            ", column " +
            (1 + (ping.cell % board.size)) +
            "."
        : labels[board.status],
    );
  }
}
