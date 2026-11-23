import { createGame, guess, botChoice, currentPlayer, rollDie, DEFAULT_ROUNDS, validRounds, DEFAULT_SIDES, validSides, TIE_JACKPOTS, allowedChoice } from '../core/rules.mjs';
import { dieSvg } from './dice.mjs';

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
  const mobileHistoryList = $('[data-mobile-history-list]');
  const mobileScores = $('[data-mobile-scores]');
  const soloRoundsField = $('[data-solo-rounds]');
  const onlineRoundsField = $('[data-online-rounds]');
  const replay = $('[data-replay]');
  const buttons = [...root.querySelectorAll('[data-guess]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMatchActions = window.matchMedia('(min-width: 561px)');
  const matchActions = $('[data-match-actions]');
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
  let soloRounds = DEFAULT_ROUNDS;
  let onlineRounds = DEFAULT_ROUNDS;
  let soloDiceSides = DEFAULT_SIDES;
  let onlineDiceSides = DEFAULT_SIDES;

  const name = id => players.find(p => p.id === id)?.name || id || 'Player';
  const canPlay = () => game && !game.over && !rolling && !waitingForServer &&
    (mode === 'solo' ? currentPlayer(game) === 'you' :
      mode === 'online' && connected && currentPlayer(game) === me);

  function showFace(value, sides) {
    const key = `${sides}:${value}`;
    if (visibleFace === key) return;
    visibleFace = key;
    die.innerHTML = dieSvg(value, sides);
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
    mobileHistoryList.replaceChildren(...entries.map(li => li.cloneNode(true)));
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
    mobileScores.replaceChildren(...entries.map(li => li.cloneNode(true)));
    const leaders = presented?.alive.map(id => presented.scores[id]) ?? [];
    const lead = leaders.length ? Math.max(...leaders) : 0;
    $('[data-mobile-summary]').textContent = `${ids.length} PLAYERS · LEAD ${lead}`;
    $('[data-player-count]').textContent = `${ids.length} / 20`;
    $('[data-now-playing]').textContent = !presented ? mode === 'menu'
      ? 'Choose a mode to begin'
      : 'Waiting for the host to start'
      : presented.over ? 'Match complete'
      : rolling ? `${name(game?.last?.player)} is rolling…`
      : `${name(current)} is up next`;
  }

  function syncMatchActions() {
    // Keep controls visible on desktop and at game-over, but tuck them away
    // during mobile play. Do not override a menu opened by the player.
    const phase = `${desktopMatchActions.matches}:${!!game?.over}`;
    if (matchActions.dataset.phase !== phase) {
      matchActions.open = desktopMatchActions.matches || !!game?.over;
      matchActions.dataset.phase = phase;
    }
  }

  function render() {
    const presented = view || game;
    syncMatchActions();
    const current = game && currentPlayer(game);
    root.classList.toggle('is-playing', !!game);
    root.classList.toggle('is-active-match', !!game && !game.over);
    root.classList.toggle('is-finished', !!game?.over);
    root.classList.toggle('is-online', mode === 'online');
    menu.hidden = mode !== 'menu';
    roomPanel.hidden = mode !== 'online';
    stage.hidden = !game;
    $('[data-start]').hidden = mode !== 'online' || host !== me || !!game || !connected;
    $('[data-start]').disabled = waitingForServer;
    const editable = mode === 'online' && connected && host === me && !waitingForServer && (!game || game.over);
    $('[data-room-settings]').hidden = mode !== 'online' || (!!game && !game.over);
    $('[data-settings-note]').textContent = host === me ? 'HOST SETTING · 1–99' : 'HOST CHOOSES · 1–99';
    for (const control of root.querySelectorAll('[data-adjust^="online:"], [data-online-rounds], [data-dice-select^="online:"]')) control.disabled = !editable;
    for (const button of root.querySelectorAll('[data-dice-select]')) {
      const [which, value] = button.dataset.diceSelect.split(':');
      const selected = which === 'solo' ? soloDiceSides : onlineDiceSides;
      button.setAttribute('aria-pressed', String(selected === Number(value)));
    }
    $('[data-solo-dice-note]').textContent = `D${soloDiceSides} · TIE JACKPOT +${TIE_JACKPOTS[soloDiceSides]}`;
    $('[data-online-dice-note]').textContent = `D${onlineDiceSides} · TIE JACKPOT +${TIE_JACKPOTS[onlineDiceSides]}`;
    if (document.activeElement !== onlineRoundsField) onlineRoundsField.value = String(onlineRounds);
    if (document.activeElement !== soloRoundsField) soloRoundsField.value = String(soloRounds);
    $('[data-back]').hidden = mode !== 'solo';
    replay.hidden = !game || (mode === 'online' && (host !== me || !game.over));
    replay.disabled = rolling || waitingForServer || (mode === 'online' && !connected);
    replay.classList.toggle('finished', !!game?.over);
    replay.textContent = game?.over ? '↻ PLAY AGAIN' : '↻ RESTART MATCH';
    $('[data-replay-hint]').hidden = mode !== 'online' || !game?.over || host === me;
    const maxRounds = game?.maxRounds ?? DEFAULT_ROUNDS;
    // Legacy active rooms without dieSides always use their original D6 rules.
    const sides = game ? (game.dieSides ?? 6) : mode === 'online' ? onlineDiceSides : soloDiceSides;
    const jackpot = TIE_JACKPOTS[sides];
    const legacy = !!game && game.dieSides == null;
    const tieLabel = legacy ? '×2' : `+${jackpot}`;
    $('[data-jackpot-hint]').textContent = `D${sides} · TIE ${tieLabel}`;
    $('[data-tie-jackpot]').textContent = tieLabel;
    $('[data-tie-rule]').textContent = `D${sides} · TIE ${legacy ? 'PAYS DOUBLE' : 'JACKPOT ' + tieLabel}`;
    $('[data-progress]').textContent = game ? `ROUND ${Math.min(game.round, maxRounds)} / ${maxRounds}`
      : mode === 'online' ? `LOBBY · ${players.length} / 20` : 'CHOOSE A MODE';
    $('[data-rounds]').textContent = game ? `${maxRounds} ROUNDS` : `${mode === 'solo' ? soloRounds : mode === 'online' ? onlineRounds : DEFAULT_ROUNDS} ROUNDS`;
    $('[data-mobile-progress]').textContent = game ? `ROUND ${Math.min(game.round, maxRounds)} / ${maxRounds}` : '';

    if (game && presented) {
      const player = rolling ? game.last?.player : current;
      $('[data-turn]').textContent = rolling ? player === me ? 'YOU ARE ROLLING…' : `${name(player)} IS ROLLING…`
        : game.over ? game.winner ? game.winner === me ? 'YOU WIN!' : `${name(game.winner)} WINS!` : 'IT’S A DRAW!'
        : player === me ? 'YOUR TURN' : `${name(player)}’S TURN`;
      const lead = presented.alive.length ? Math.max(...presented.alive.map(id => presented.scores[id])) : 0;
      $('[data-mobile-left-label]').textContent = 'YOU';
      $('[data-mobile-left-value]').textContent = String(presented.scores[me] ?? '—');
      $('[data-mobile-right-label]').textContent = mode === 'solo' ? 'COMPUTER' : 'LEADER';
      $('[data-mobile-right-value]').textContent = String(mode === 'solo' ? presented.scores.bot : lead);
      $('[data-mobile-turn]').textContent = rolling ? 'ROLLING…'
        : game.over ? game.winner ? game.winner === me ? 'YOU WIN!' : `${name(game.winner)} WINS` : 'DRAW'
        : player === me ? 'YOUR TURN' : mode === 'solo' ? 'BOT TURN' : `${name(player)}’S TURN`;

      const myPoints = presented.scores[me];
      $('[data-your-score]').hidden = myPoints === undefined;
      $('[data-my-points]').textContent = String(myPoints ?? 0);
      $('[data-dice-label]').textContent = rolling ? 'ROLLING…' : `LAST ROLL · D${sides}`;
      $('[data-dice-value]').textContent = rolling ? 'ROLLING…' : `${presented.previous || '—'} / ${sides}`;
      if (!rolling) showFace(presented.previous, sides);

      const outcome = $('[data-result]');
      const last = $('[data-last]');
      outcome.classList.remove('gain', 'loss', 'neutral', 'jackpot');
      die.classList.remove('jackpot-land');
      if (rolling) {
        last.textContent = 'Rolling…';
      } else if (!presented.last) {
        last.textContent = 'Choose a prediction.';
      } else {
        const event = presented.last;
        const label = event.opening ? `${name(event.player)} opened with ${event.roll}`
          : event.choice === 'tie' && event.correct ? `${name(event.player)} hit TIE!`
          : `${name(event.player)}: ${event.choice.toUpperCase()} · ${event.previous} → ${event.roll}${!event.correct && event.delta === 0 ? ' · WRONG' : ''}`;
        const points = document.createElement('strong');
        points.textContent = `${event.delta > 0 ? '+' : ''}${event.delta}${event.eliminated ? ' · OUT' : ''}`;
        last.replaceChildren(document.createTextNode(`${label} · `), points);
        outcome.classList.add(event.delta > 0 ? 'gain' : event.delta < 0 ? 'loss' : 'neutral');
        if (event.choice === 'tie' && event.correct) {
          outcome.classList.add('jackpot');
          die.classList.add('jackpot-land');
        }
      }
    }
    buttons.forEach(button => {
      const permitted = !game || legacy || allowedChoice(game.previous, button.dataset.guess, sides);
      button.disabled = !canPlay() || !permitted;
      button.title = !permitted ? `Cannot predict ${button.dataset.guess} from ${game.previous} on D${sides}.` : '';
    });
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
    const sides = next.dieSides ?? 6;
    showFace(1 + Math.floor(Math.random() * sides), sides);
    die.classList.remove('rolling');
    void die.offsetWidth;
    die.classList.add('rolling');
    rollInterval = window.setInterval(() => {
      showFace(1 + Math.floor(Math.random() * sides), sides);
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
      const sides = game.dieSides ?? 6;
      const choice = botChoice(game.previous, game.scores.bot, game.scores.you, sides);
      guess(game, 'bot', choice, rollDie(sides));
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
    const next = createGame(['bot', 'you'], rollDie(soloDiceSides), soloRounds, soloDiceSides);
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
        onlineRounds = validRounds(message.rounds) ? message.rounds : DEFAULT_ROUNDS;
        onlineDiceSides = validSides(message.dieSides) ? message.dieSides : DEFAULT_SIDES;
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

  const parsedRounds = (text) => {
    const number = Number(text);
    return validRounds(number) && String(text).trim() !== '' ? number : null;
  };
  function updateRounds(which, direction = 0) {
    const input = which === 'solo' ? soloRoundsField : onlineRoundsField;
    const current = which === 'solo' ? soloRounds : onlineRounds;
    const next = direction ? Math.min(99, Math.max(1, current + direction)) : parsedRounds(input.value);
    if (next === null) {
      input.value = String(current);
      status.textContent = 'Choose 1–99 rounds.';
      return;
    }
    if (which === 'solo') {
      soloRounds = next;
      status.textContent = '';
      render();
    } else if (mode === 'online' && host === me && connected && (!game || game.over) && !waitingForServer) {
      if (next === onlineRounds) { render(); return; }
      waitingForServer = true;
      ws?.send(JSON.stringify({ type: 'settings', rounds: next }));
      render();
    }
  }
  for (const button of root.querySelectorAll('[data-dice-select]')) {
    button.addEventListener('click', () => {
      const [which, raw] = button.dataset.diceSelect.split(':');
      const sides = Number(raw);
      if (!validSides(sides)) return;
      if (which === 'solo') {
        if (mode !== 'menu') return;
        soloDiceSides = sides;
        render();
      } else if (mode === 'online' && host === me && connected && (!game || game.over) && !waitingForServer) {
        if (sides === onlineDiceSides) return;
        waitingForServer = true;
        ws?.send(JSON.stringify({ type: 'settings', dieSides: sides }));
        render();
      }
    });
  }
  for (const button of root.querySelectorAll('[data-adjust]')) {
    button.addEventListener('click', () => {
      const [which, direction] = button.dataset.adjust.split(':');
      updateRounds(which, Number(direction));
    });
  }
  soloRoundsField.addEventListener('change', () => updateRounds('solo'));
  onlineRoundsField.addEventListener('change', () => updateRounds('online'));

  $('[data-solo]').addEventListener('click', () => {
    if (parsedRounds(soloRoundsField.value) === null) { updateRounds('solo'); return; }
    updateRounds('solo');
    startSolo();
  });
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
      guess(game, 'you', choice, rollDie(game.dieSides ?? 6));
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
  desktopMatchActions.addEventListener('change', syncMatchActions);
  const invited = new URLSearchParams(location.search).get('room');
  if (invited && /^\d{6}$/.test(invited)) {
    $('[data-code-label]').hidden = false;
    $('[data-code]').value = invited;
    status.textContent = 'Enter your name, then join the room.';
  }
  render();
}
