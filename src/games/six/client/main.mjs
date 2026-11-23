import { createGame, guess, botChoice, currentPlayer, rollDie } from '../core/rules.mjs';

const pips = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function dieSvg(face) {
  if (!pips[face]) return '';
  const circles = pips[face].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="8" fill="#242326" stroke="#77716f" stroke-width="1"/>`,
  ).join('');
  return `<svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
    <defs><linearGradient id="six-face-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#fffefa"/><stop offset=".55" stop-color="#eee9e2"/>
      <stop offset="1" stop-color="#c8c0b8"/>
    </linearGradient></defs>
    <rect x="3" y="3" width="94" height="94" rx="20"
      fill="url(#six-face-gradient)" stroke="#bcb3aa" stroke-width="2"/>
    <path d="M15 43V24Q15 14 27 14H71" stroke="#fff"
      stroke-opacity=".8" stroke-width="4" stroke-linecap="round" fill="none"/>
    ${circles}
  </svg>`;
}

// The presentation copy stays unchanged until the dice settles. Neither the new
// score nor the server's final roll appears during the animation.
function copyGame(game) {
  if (!game) return null;
  return {
    ...game,
    ids: [...game.ids],
    scores: { ...game.scores },
    alive: [...game.alive],
    last: game.last ? { ...game.last } : null,
  };
}

function openingPreview(game) {
  const preview = copyGame(game);
  preview.previous = 0;
  preview.last = null;
  preview.scores = Object.fromEntries(game.ids.map(id => [id, 0]));
  return preview;
}

export function mountSix() {
  const root = document.querySelector('[data-six]');
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = '1';

  const $ = selector => root.querySelector(selector);
  const menu = $('[data-menu]');
  const roomPanel = $('[data-room]');
  const stage = $('[data-stage]');
  const status = $('[data-status]');
  const die = $('[data-die]');
  const scores = $('[data-scores]');
  const historyList = $('[data-history]');
  const replay = $('[data-replay]');
  const buttons = [...root.querySelectorAll('[data-guess]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const backend = root.dataset.backend.replace(/\/$/, '');

  let game = null;
  let view = null;
  let players = [];
  let ws = null;
  let connected = false;
  let me = 'you';
  let host = null;
  let roomCode = '';
  let mode = 'menu';
  let rolling = false;
  let waitingForServer = false;
  let lastSeen = null;
  let soloMatch = 0;
  let rollHistory = [];
  let visibleFace = null;
  let rollInterval = 0;
  let rollTimeout = 0;
  let botTimeout = 0;

  const name = id => players.find(p => p.id === id)?.name || id || 'Player';
  const canPlay = () => game && !game.over && !rolling && !waitingForServer &&
    (mode === 'solo' ? currentPlayer(game) === 'you' :
      mode === 'online' && connected && currentPlayer(game) === me);

  function showFace(value) {
    if (visibleFace === value) return;
    visibleFace = value;
    die.innerHTML = dieSvg(value);
  }

  function stopRoll() {
    clearInterval(rollInterval);
    clearTimeout(rollTimeout);
    rollInterval = 0;
    rollTimeout = 0;
    rolling = false;
    die.classList.remove('rolling');
  }

  function stopBot() {
    clearTimeout(botTimeout);
    botTimeout = 0;
  }

  function recordRoll(next) {
    if (!next?.last) return;
    rollHistory.unshift({ ...next.last, playerName: name(next.last.player) });
    rollHistory = rollHistory.slice(0, 6);
  }

  function renderHistory() {
    const entries = rollHistory.map(event => {
      const li = document.createElement('li');
      const who = document.createElement('strong');
      who.textContent = event.playerName;
      const rest = document.createElement('span');
      rest.textContent = event.opening
        ? ` opened with ${event.roll}`
        : ` · ${event.choice.toUpperCase()} → ${event.roll} · `;
      li.append(who, rest);
      if (!event.opening) {
        const value = document.createElement('strong');
        value.className = event.delta > 0 ? 'plus' : event.delta < 0 ? 'minus' : '';
        value.textContent = `${event.delta > 0 ? '+' : ''}${event.delta}${event.eliminated ? ' · OUT' : ''}`;
        li.append(value);
      }
      return li;
    });
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'six-empty';
      li.textContent = 'No rolls yet.';
      entries.push(li);
    }
    historyList.replaceChildren(...entries);
  }

  function renderScores(presented) {
    const ids = presented?.ids || players.map(player => player.id);
    const current = presented && currentPlayer(presented);
    const entries = ids.map(id => {
      const li = document.createElement('li');
      const out = presented && !presented.alive.includes(id);
      li.className = `${id === current ? 'active ' : ''}${out ? 'out' : ''}`.trim();
      const details = document.createElement('span');
      details.className = 'six-player';
      const label = document.createElement('strong');
      label.textContent = name(id);
      const sub = document.createElement('small');
      const online = players.find(p => p.id === id)?.online;
      sub.textContent = out ? 'OUT' : id === current ? (id === me ? 'YOUR TURN' : 'TAKING TURN')
        : id === me ? 'YOU' : mode === 'online' && online === false ? 'OFFLINE' : id === 'bot' ? 'COMPUTER' : 'IN GAME';
      details.append(label, sub);
      const number = document.createElement('span');
      number.className = 'six-score-number';
      number.textContent = presented ? String(presented.scores[id]) : '—';
      li.append(details, number);
      return li;
    });
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'six-empty';
      li.textContent = 'Scores will appear here.';
      entries.push(li);
    }
    scores.replaceChildren(...entries);
    $('[data-player-count]').textContent = `${ids.length} / 20`;
    $('[data-now-playing]').textContent = !presented ? mode === 'menu'
      ? 'Choose a mode to begin'
      : 'Waiting for the host to start'
      : presented.over ? 'Match complete'
      : rolling ? `${name(game?.last?.player)} is rolling…`
      : `${name(current)} is up next`;
  }

  function render() {
    const presented = view || game;
    const current = game && currentPlayer(game);
    menu.hidden = mode !== 'menu';
    roomPanel.hidden = mode !== 'online';
    stage.hidden = !game;
    $('[data-start]').hidden = mode !== 'online' || host !== me || !!game || !connected;
    $('[data-start]').disabled = waitingForServer;
    $('[data-back]').hidden = mode !== 'solo';
    replay.hidden = !game || (mode === 'online' && (host !== me || !game.over));
    replay.disabled = rolling || waitingForServer || (mode === 'online' && !connected);
    replay.classList.toggle('finished', !!game?.over);
    replay.textContent = game?.over ? '↻ PLAY AGAIN' : '↻ RESTART MATCH';
    $('[data-replay-hint]').hidden = mode !== 'online' || !game?.over || host === me;
    $('[data-progress]').textContent = game ? `ROUND ${Math.min(game.round, 10)} / 10`
      : mode === 'online' ? `LOBBY · ${players.length} / 20` : 'CHOOSE A MODE';

    if (game && presented) {
      const player = rolling ? game.last?.player : current;
      $('[data-turn]').textContent = rolling ? `${name(player)} IS ROLLING…`
        : game.over ? game.winner ? game.winner === me ? 'YOU WIN!' : `${name(game.winner)} WINS!` : 'IT’S A DRAW!'
        : player === me ? 'YOUR TURN' : `${name(player)}’S TURN`;

      const myPoints = presented.scores[me];
      $('[data-your-score]').hidden = myPoints === undefined;
      $('[data-my-points]').textContent = String(myPoints ?? 0);
      $('[data-dice-label]').textContent = rolling ? 'ROLLING…' : 'PREVIOUS ROLL';
      $('[data-dice-value]').textContent = rolling ? '● ● ●' : `D6 · ${presented.previous || '—'}`;
      if (!rolling) showFace(presented.previous);

      const outcome = $('[data-result]');
      const last = $('[data-last]');
      const delta = $('[data-delta]');
      outcome.classList.remove('gain', 'loss');
      delta.hidden = true;
      if (rolling) {
        last.textContent = 'The die is in motion…';
      } else if (!presented.last) {
        last.textContent = 'Choose your prediction.';
      } else {
        const event = presented.last;
        if (event.opening) {
          last.textContent = `${name(event.player)} opens with a ${event.roll}`;
        } else {
          last.textContent = `${name(event.player)} guessed ${event.choice.toUpperCase()} · rolled ${event.roll} · ${event.correct ? 'CORRECT' : 'WRONG'}${event.eliminated ? ' · ELIMINATED' : ''}`;
        }
        delta.hidden = false;
        delta.textContent = `${event.delta > 0 ? '+' : ''}${event.delta} ${Math.abs(event.delta) === 1 ? 'POINT' : 'POINTS'}`;
        outcome.classList.add(event.delta > 0 ? 'gain' : event.delta < 0 ? 'loss' : 'neutral');
      }
    }
    buttons.forEach(button => { button.disabled = !canPlay(); });
    renderScores(presented);
    renderHistory();
  }

  // A move is identified by its match and move number, not by WebSocket message
  // count. Lobby updates and reconnects must not replay or spoil the die.
  function applyGame(next, key, { before = view || game, done = null } = {}) {
    const previousKey = lastSeen;
    if (key === previousKey) {
      game = next;
      render();
      return;
    }
    const newMatch = !previousKey || key.split(':')[0] !== previousKey.split(':')[0];
    if (newMatch) rollHistory = [];
    lastSeen = key;
    stopRoll();
    game = next;
    const firstSnapshotMidgame = !previousKey && next.moves > 0;
    if (reducedMotion.matches || firstSnapshotMidgame) {
      view = null;
      recordRoll(next);
      render();
      done?.();
      return;
    }
    view = newMatch ? openingPreview(next) : before || openingPreview(next);
    rolling = true;
    render();
    // All rapidly changing faces are cosmetic. Only the final face comes from
    // the already-validated local roll / authoritative server snapshot.
    showFace(1 + Math.floor(Math.random() * 6));
    die.classList.remove('rolling');
    void die.offsetWidth;
    die.classList.add('rolling');
    rollInterval = window.setInterval(() => {
      showFace(1 + Math.floor(Math.random() * 6));
    }, 85);
    rollTimeout = window.setTimeout(() => {
      stopRoll();
      view = null;
      recordRoll(next);
      render();
      done?.();
    }, 720);
  }

  function scheduleBot() {
    stopBot();
    if (mode !== 'solo' || !game || game.over || currentPlayer(game) !== 'bot') return;
    botTimeout = window.setTimeout(() => {
      if (mode !== 'solo' || !game || game.over || currentPlayer(game) !== 'bot') return;
      const before = copyGame(game);
      const choice = botChoice(game.previous, game.scores.bot, game.scores.you);
      guess(game, 'bot', choice, rollDie());
      applyGame(game, `${soloMatch}:${game.moves}`, { before });
    }, 320);
  }

  function startSolo() {
    stopBot();
    stopRoll();
    mode = 'solo';
    players = [{ id: 'you', name: 'YOU' }, { id: 'bot', name: 'COMPUTER' }];
    me = 'you';
    waitingForServer = false;
    const next = createGame(['bot', 'you']);
    soloMatch++;
    lastSeen = null;
    status.textContent = '';
    applyGame(next, `${soloMatch}:0`);
  }

  function reset({ leave = true, clearUrl = true } = {}) {
    stopBot();
    stopRoll();
    if (ws) {
      if (leave && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'leave' }));
      ws.close();
      ws = null;
    }
    connected = false;
    mode = 'menu';
    game = null;
    view = null;
    players = [];
    me = 'you';
    host = null;
    roomCode = '';
    waitingForServer = false;
    lastSeen = null;
    rollHistory = [];
    visibleFace = null;
    if (clearUrl) history.replaceState(null, '', location.pathname);
    render();
  }

  function connect(code, token = '') {
    if (!backend) { status.textContent = 'Online backend not configured (PUBLIC_SIX_BACKEND_URL).'; return; }
    reset({ leave: false, clearUrl: false });
    mode = 'online';
    roomCode = code;
    const url = new URL(backend);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = url.pathname.replace(/\/$/, '') + '/six/rooms/' + code;
    const socket = new WebSocket(url);
    ws = socket;
    socket.onopen = () => {
      let key = '';
      try { key = localStorage.getItem('six-room-' + code) || ''; } catch { /* optional storage */ }
      socket.send(JSON.stringify({ type: 'join', name: $('[data-name]').value.trim() || 'Player', key, token }));
      status.textContent = 'Joining room…';
    };
    socket.onmessage = event => {
      if (ws !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { status.textContent = 'Invalid server response.'; return; }
      if (message.type === 'error') {
        waitingForServer = false;
        status.textContent = message.error;
        render();
        return;
      }
      if (message.type === 'identity') {
        me = message.you;
        connected = true;
        try { localStorage.setItem('six-room-' + code, message.key); } catch { /* optional storage */ }
      }
      if (message.type === 'state') {
        players = message.players;
        host = message.host;
        waitingForServer = false;
        status.textContent = '';
        if (message.game) {
          applyGame(message.game, `${message.round}:${message.game.moves}`);
        } else {
          stopRoll();
          game = null;
          view = null;
          lastSeen = null;
          rollHistory = [];
          render();
        }
      }
      render();
    };
    socket.onclose = () => {
      if (ws !== socket) return;
      connected = false;
      waitingForServer = false;
      stopRoll();
      view = null;
      status.textContent = 'Disconnected. Rejoin using the room code.';
      render();
    };
    socket.onerror = () => { if (ws === socket) status.textContent = 'Room connection failed.'; };
    $('[data-room-code]').textContent = 'ROOM ' + code;
    history.replaceState(null, '', location.pathname + '?room=' + code);
    render();
  }

  $('[data-solo]').addEventListener('click', startSolo);
  $('[data-back]').addEventListener('click', () => { reset(); status.textContent = ''; });
  $('[data-leave]').addEventListener('click', () => { reset(); status.textContent = ''; });
  replay.addEventListener('click', () => {
    if (mode === 'solo') startSolo();
    else if (mode === 'online' && game?.over && host === me && connected && !waitingForServer) {
      waitingForServer = true;
      ws?.send(JSON.stringify({ type: 'start' }));
      render();
    }
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    if (!canPlay()) return;
    const choice = button.dataset.guess;
    if (mode === 'solo') {
      const before = copyGame(game);
      guess(game, 'you', choice, rollDie());
      applyGame(game, `${soloMatch}:${game.moves}`, { before, done: scheduleBot });
    } else if (ws?.readyState === WebSocket.OPEN) {
      waitingForServer = true;
      ws.send(JSON.stringify({ type: 'guess', choice, move: game.moves }));
      render();
    }
  }));
  $('[data-create]').addEventListener('click', async event => {
    if (!backend) { status.textContent = 'Online backend not configured.'; return; }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch(backend + '/six/rooms', { method: 'POST' });
      if (!response.ok) throw Error('Room unavailable (' + response.status + ').');
      const { room, token } = await response.json();
      if (mode === 'menu') connect(room, token);
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('[data-join]').addEventListener('click', () => {
    const field = $('[data-code-label]');
    if (field.hidden) { field.hidden = false; $('[data-code]').focus(); return; }
    const code = $('[data-code]').value.trim();
    if (!/^\d{6}$/.test(code)) { status.textContent = 'Enter a six-digit room code.'; return; }
    connect(code);
  });
  $('[data-code]').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('[data-join]').click(); }
  });
  $('[data-invite]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname + '?room=' + roomCode);
      status.textContent = 'Invite copied.';
    } catch { status.textContent = 'Copy the URL from your address bar.'; }
  });
  $('[data-start]').addEventListener('click', () => {
    if (mode === 'online' && host === me && connected && !waitingForServer) {
      waitingForServer = true;
      ws?.send(JSON.stringify({ type: 'start' }));
      render();
    }
  });
  const invited = new URLSearchParams(location.search).get('room');
  if (invited && /^\d{6}$/.test(invited)) {
    $('[data-code-label]').hidden = false;
    $('[data-code]').value = invited;
    status.textContent = 'Enter your name, then join the room.';
  }
  render();
}
