import { createGame, guess, botChoice, currentPlayer, rollDie, DEFAULT_ROUNDS, validRounds, DEFAULT_SIDES, validSides, TIE_JACKPOTS, allowedChoice } from '../core/rules.mjs';
import { dieSvg } from './dice.mjs';
import { mountGameSound } from '../../shared/game-sound.ts';
import { recordWin } from '../core/series.mjs';

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
  const finale = $('[data-finale]');
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
  const sounds = mountGameSound(root, 'six');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMatchActions = window.matchMedia('(min-width: 561px)');
  const matchActions = $('[data-match-actions]');
  const backend = root.dataset.backend.replace(/\/$/, '');

  let game = null;
  let view = null;
  let players = [];
  let wins = {};
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
  let outcomeTimer = 0;
  let finaleTimer = 0;
  let finaleReady = false;
  const pressTimers = new WeakMap();
  let soloRounds = DEFAULT_ROUNDS;
  let onlineRounds = DEFAULT_ROUNDS;
  let soloDiceSides = DEFAULT_SIDES;
  let onlineDiceSides = DEFAULT_SIDES;

  const name = id => players.find(p => p.id === id)?.name || id || 'Player';
  const clearChoice = () => buttons.forEach(button => button.classList.remove('six-committed'));
  // A short visible press for pointer, touch and keyboard. Disabled buttons
  // never respond. The committed state lasts until the roll is revealed.
  function flashButton(button) {
    if (!button || button.disabled) return;
    clearTimeout(pressTimers.get(button));
    button.classList.add('six-pressed');
    pressTimers.set(button, window.setTimeout(() => {
      button.classList.remove('six-pressed');
      pressTimers.delete(button);
    }, 150));
  }
  root.addEventListener('pointerdown', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button && root.contains(button)) flashButton(button);
  }, true);
  root.addEventListener('keydown', event => {
    if (event.repeat || !['Enter', ' '].includes(event.key)) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button && root.contains(button)) flashButton(button);
  }, true);
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled || !root.contains(button)) return;
    flashButton(button);
    if (!button.matches('[data-game-sound]')) sounds.play('tap');
  }, true);

  function outcomeSound(next) {
    const event = next?.last;
    if (event?.choice === 'tie' && event.correct) sounds.play('bonus');
    else if (event?.eliminated) sounds.play('impact');
    else if (event?.opening) sounds.play('confirm');
    else if (event?.correct) sounds.play('pickup');
    else if (event) sounds.play('impact');
  }
  function landed(next) {
    sounds.play('diceLand');
    clearTimeout(outcomeTimer);
    // The final chime belongs to the results reveal, not the dice landing.
    if (next?.over) return;
    outcomeTimer = window.setTimeout(() => {
      outcomeTimer = 0;
      outcomeSound(next);
    }, 100);
  }
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
    clearTimeout(outcomeTimer);
    clearTimeout(finaleTimer);
    outcomeTimer = 0;
    finaleTimer = 0;
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
      const state = out ? 'OUT' : id === current ? (id === me ? 'YOUR TURN' : 'TAKING TURN')
        : id === me ? 'YOU' : mode === 'online' && online === false ? 'OFFLINE' : id === 'bot' ? 'COMPUTER' : 'IN GAME';
      const count = wins[id] ?? 0;
      sub.textContent = `${state} · ${count} ${count === 1 ? 'WIN' : 'WINS'}`;
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

  function renderFinale() {
    if (!game?.over) return;
    const winner = game.winner;
    const alive = new Set(game.alive);
    const sorted = [...game.ids].sort((a, b) =>
      Number(b === winner) - Number(a === winner) ||
      Number(alive.has(b)) - Number(alive.has(a)) ||
      (game.scores[b] ?? 0) - (game.scores[a] ?? 0) ||
      game.ids.indexOf(a) - game.ids.indexOf(b));
    const highest = Math.max(...game.alive.map(id => game.scores[id]), -Infinity);
    const tied = !winner && game.alive.length > 1;
    const rows = sorted.map((id, index) => {
      const first = id === winner;
      const tiedFirst = tied && alive.has(id) && game.scores[id] === highest;
      const out = !alive.has(id);
      const li = document.createElement('li');
      li.className = `six-final-player${first || tiedFirst ? ' champion' : ''}${out ? ' eliminated' : ''}${id === me ? ' is-you' : ''}`;
      const rank = document.createElement('span');
      rank.className = 'six-final-rank';
      rank.textContent = String(tiedFirst ? 1 : index + 1).padStart(2, '0');
      const info = document.createElement('span');
      info.className = 'six-final-player-info';
      const playerName = document.createElement('strong');
      playerName.textContent = name(id);
      const label = document.createElement('small');
      const state = first ? 'WINNER' : tiedFirst ? 'TIED FIRST' : out ? 'ELIMINATED' : id === me ? 'YOU' : 'FINAL SCORE';
      const count = wins[id] ?? 0;
      label.textContent = `${state} · ${count} ${count === 1 ? 'WIN' : 'WINS'}`;
      info.append(playerName, label);
      const points = document.createElement('strong');
      points.className = 'six-final-points';
      points.textContent = String(game.scores[id] ?? 0);
      li.append(rank, info, points);
      return li;
    });
    const board = $('[data-final-scores]');
    const scroll = board.scrollTop;
    board.replaceChildren(...rows);
    board.scrollTop = scroll;
    $('[data-final-hero]').classList.toggle('is-draw', !winner);
    $('[data-final-title]').textContent = winner ? (winner === me ? 'YOU WIN!' : `${name(winner)} WINS!`)
      : tied ? 'IT’S A DRAW!' : 'NO WINNER';
    const rounds = game.maxRounds ?? DEFAULT_ROUNDS;
    $('[data-final-detail]').textContent = game.alive.length <= 1
      ? `LAST PLAYER STANDING · ROUND ${Math.min(game.round, rounds)} / ${rounds}`
      : `D${game.dieSides ?? 6} · ${rounds} ROUNDS`;
    const position = sorted.indexOf(me);
    const summary = $('[data-final-summary]');
    summary.hidden = position < 0;
    if (position >= 0) summary.textContent = `YOU: #${tied && game.scores[me] === highest ? 1 : position + 1} · ${game.scores[me]} PTS`;
    $('[data-final-replay]').hidden = mode === 'online' && host !== me;
    $('[data-final-replay]').disabled = waitingForServer || (mode === 'online' && !connected);
    $('[data-final-replay]').textContent = waitingForServer ? 'STARTING…' : 'PLAY AGAIN';
    $('[data-final-back]').textContent = mode === 'online' ? 'LEAVE ROOM' : 'CHANGE MODE';
    $('[data-final-wait]').hidden = mode !== 'online' || host === me;
  }

  function revealFinale(animated = true) {
    if (!game?.over) return;
    clearTimeout(finaleTimer);
    finaleTimer = 0;
    finaleReady = true;
    finale.classList.toggle('without-animation', !animated);
    render();
    window.scrollTo(0, 0);
    if (animated) {
      // Every participant hears the winner announced, including the loser.
      sounds.play('clear');
      $('[data-final-title]').focus({ preventScroll: true });
    }
  }

  function finishAfterLastRoll(next) {
    if (!next.over) return;
    // Reveal only after the final die and its outcome sound have landed.
    finaleTimer = window.setTimeout(() => revealFinale(), 650);
  }

  function syncMatchActions() {
    // Keep controls visible on desktop and at game-over, but tuck them away
    // during mobile play. Do not override a menu opened by the player.
    const phase = `${desktopMatchActions.matches}:${finaleReady}`;
    if (matchActions.dataset.phase !== phase) {
      matchActions.open = desktopMatchActions.matches || finaleReady;
      matchActions.dataset.phase = phase;
    }
  }

  function render() {
    const presented = view || game;
    syncMatchActions();
    const current = game && currentPlayer(game);
    root.classList.toggle('is-playing', !!game);
    root.classList.toggle('is-active-match', !!game && !finaleReady);
    root.classList.toggle('is-finished', finaleReady);
    root.classList.toggle('is-online', mode === 'online');
    menu.hidden = mode !== 'menu';
    roomPanel.hidden = mode !== 'online';
    stage.hidden = !game;
    finale.hidden = !finaleReady;
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
    replay.hidden = !game || (game.over && !finaleReady) || (mode === 'online' && (host !== me || !game.over));
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
      $('[data-mobile-left-label]').textContent = `YOU · ${wins[me] ?? 0}W`;
      $('[data-mobile-left-value]').textContent = String(presented.scores[me] ?? '—');
      $('[data-mobile-right-label]').textContent = mode === 'solo' ? `COMPUTER · ${wins.bot ?? 0}W` : 'LEADER';
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
    if (finaleReady) renderFinale();
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
    if (mode === 'solo' && next.over && !before?.over) wins = recordWin(wins, next.winner);
    const newMatch = !previousKey || key.split(':')[0] !== previousKey.split(':')[0];
    if (newMatch) rollHistory = [];
    lastSeen = key;
    stopRoll();
    finaleReady = false;
    finale.classList.remove('without-animation');
    game = next;
    const firstSnapshotMidgame = !previousKey && next.moves > 0;
    if (reducedMotion.matches || firstSnapshotMidgame) {
      view = null;
      clearChoice();
      recordRoll(next);
      if (next.over) { finaleReady = true; finale.classList.add('without-animation'); }
      render();
      if (next.over) window.scrollTo(0, 0);
      // Rejoining an active room must not replay an old result.
      if (!firstSnapshotMidgame) {
        landed(next);
        if (next.over) sounds.play('clear');
      }
      done?.();
      return;
    }
    view = newMatch ? openingPreview(next) : before || openingPreview(next);
    rolling = true;
    render();
    sounds.play('diceRoll', ((next.dieSides ?? 6) - 6) / 14);
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
      clearChoice();
      recordRoll(next);
      render();
      landed(next);
      finishAfterLastRoll(next);
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
    clearChoice();
    finaleReady = false;
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
    sounds.stop();
    finaleReady = false;
    clearChoice();
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
    wins = {};
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
        clearChoice();
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
        // Durable Object room stats are authoritative, including after reconnect.
        wins = message.wins && typeof message.wins === 'object' && !Array.isArray(message.wins) ? message.wins : {};
        host = message.host;
        onlineRounds = validRounds(message.rounds) ? message.rounds : DEFAULT_ROUNDS;
        onlineDiceSides = validSides(message.dieSides) ? message.dieSides : DEFAULT_SIDES;
        waitingForServer = false;
        status.textContent = '';
        if (message.game) {
          applyGame(message.game, `${message.round}:${message.game.moves}`);
        } else {
          stopRoll();
          clearChoice();
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
      sounds.stop();
      clearChoice();
      view = null;
      status.textContent = 'Disconnected. Rejoin using the room code.';
      if (game?.over) revealFinale(false);
      else render();
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
  const leaveMatch = () => { reset(); sounds.play('leave'); status.textContent = ''; };
  $('[data-back]').addEventListener('click', leaveMatch);
  $('[data-leave]').addEventListener('click', leaveMatch);
  $('[data-final-back]').addEventListener('click', leaveMatch);
  const replayMatch = () => {
    if (mode === 'solo') startSolo();
    else if (mode === 'online' && game?.over && host === me && connected && !waitingForServer) {
      waitingForServer = true;
      ws?.send(JSON.stringify({ type: 'start' }));
      render();
    }
  };
  replay.addEventListener('click', replayMatch);
  $('[data-final-replay]').addEventListener('click', replayMatch);
  buttons.forEach(button => button.addEventListener('click', () => {
    if (!canPlay()) return;
    const choice = button.dataset.guess;
    clearChoice();
    button.classList.add('six-committed');
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
