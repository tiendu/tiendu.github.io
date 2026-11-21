import { SUITS, createDeck, shuffleDeck, beginRound, hit, stand, handValue } from "./rules.mjs";
import { loadTallies, saveTallies, winnerForResult, advanceTallies, visibleTallyMarks } from "./tally.mjs";

// The browser renders one crisp SVG per card; no sprite offsets required.
const CARD_ASSET_DIR = "/cards/stained-glass";
const OUTCOME_TEXT = Object.freeze({
  playing: "Hit or stand?",
  win: "You played your cards well.",
  lose: "The right move doesn't guarantee a win.",
  bust: "Sometimes, one more is one too many.",
  push: "Not every round needs a winner.",
  blackjack: "Sometimes life gives you a little luck.",
});
const TILTS = Object.freeze({
  dealer: [-9, 6, -5, 8, -4],
  player: [8, -6, 5, -7, 4],
});
const SUIT_NAME = Object.fromEntries(SUITS.map((s) => [s.id, s.name]));

// Keep the game quiet when idle. With no visible deck, cards arrive from an invisible dealer above the table.
const MOTION = Object.freeze({ deal: 255, settle: 190, flip: 320, collect: 220, message: 190, particles: 620, outcome: 520, shake: 260 });
const PARTICLE_COLORS = Object.freeze({
  spades: ["#d9edf4", "#8fb0c7", "#eff7fa"],
  hearts: ["#f7c7d6", "#ec91b2", "#ffdfe8"],
  clubs: ["#c7deb9", "#7fb173", "#e2f1d4"],
  diamonds: ["#f4d287", "#caa34b", "#f8e7b7"],
});

function make(tagName, className, text) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function cardLabel(card) {
  const rank = card.rank === "A" ? "Ace" : ({ J: "Jack", Q: "Queen", K: "King" }[card.rank] || card.rank);
  return `${rank} of ${SUIT_NAME[card.suit]}`;
}

function showFace(node, card) {
  node.classList.remove("pixel-bj-card--back");
  node.setAttribute("aria-label", cardLabel(card));
  node.style.setProperty("--card-image", `url("${CARD_ASSET_DIR}/${card.rank}-${card.suit}.svg")`);
}

function buildCard(card, hidden = false) {
  const shell = make("div", "pixel-bj-card-shell");
  const node = make("div", "pixel-bj-card");
  node.setAttribute("role", "img");
  if (hidden) {
    node.classList.add("pixel-bj-card--back");
    node.setAttribute("aria-label", "Face-down dealer card");
  } else {
    showFace(node, card);
  }
  shell.append(node);
  return shell;
}

function decorateShell(shell, owner, index) {
  const tilt = TILTS[owner][index] ?? 0;
  shell.style.setProperty("--card-tilt", `${tilt}deg`);
  shell.style.setProperty("--card-lift", `${Math.abs(tilt) * 0.45}px`);
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Animations are optional: missing WAAPI and reduced-motion both render instantly.
function canAnimate(node) {
  return typeof node.animate === "function" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
    !document.hidden;
}

async function play(node, frames, options) {
  if (!canAnimate(node)) return;
  const animation = node.animate(frames, { fill: "both", ...options });
  try {
    await animation.finished;
  } catch {
    // A navigation or interrupted animation should never block the game.
  } finally {
    animation.cancel();
  }
}

async function flyIn(shell, from) {
  if (!canAnimate(shell)) return;
  const to = center(shell.getBoundingClientRect());
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  await play(shell, [
    { translate: `${dx}px ${dy}px`, rotate: "-11deg", scale: 0.9, opacity: 0.9, offset: 0 },
    { translate: "0px -4px", rotate: "2deg", scale: 1.025, opacity: 1, offset: 0.86 },
    { translate: "0px 0px", rotate: "0deg", scale: 1, opacity: 1, offset: 1 },
  ], { duration: MOTION.deal, easing: "cubic-bezier(.2,.65,.3,1)" });
}

function nudgeExisting(root, previous) {
  for (const [shell, before] of previous) {
    const after = center(shell.getBoundingClientRect());
    const dx = before.x - after.x;
    const dy = before.y - after.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.5 || !canAnimate(shell)) continue;
    // CSS's individual translate property composes with the hand's fixed tilt.
    void play(shell, [
      { translate: `${dx}px ${dy}px` },
      { translate: "0px 0px" },
    ], { duration: MOTION.settle, easing: "ease-out" });
  }
}

export function mountBlackjack(root = document.querySelector("[data-blackjack]")) {
  if (!root) return;

  const dealerRoot = root.querySelector("[data-dealer-cards]");
  const playerRoot = root.querySelector("[data-player-cards]");
  const resultNode = root.querySelector("[data-result]");
  const hitButton = root.querySelector('[data-action="hit"]');
  const standButton = root.querySelector('[data-action="stand"]');
  const dealButton = root.querySelector('[data-action="deal"]');
  const particleLayer = make("div", "pixel-bj-particles");
  particleLayer.setAttribute("data-particles", "");
  root.append(particleLayer);
  const buttons = [hitButton, standButton, dealButton];

  let round;
  let busy = false;
  let handTotalTimeout = null;
  let scoredRound = null;
  let storage = null;
  try { storage = window.localStorage; } catch { /* Storage may be disabled. */ }
  let tallies = loadTallies(storage);

  const SVG_NS = "http://www.w3.org/2000/svg";

  function tallyPath(d, className, animated = false) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.classList.add(className);
    if (animated) path.classList.add("pixel-bj-tally-new");
    return path;
  }

  function renderTally(side, animated = false) {
    const counter = root.querySelector(`[data-tally="${side}"]`);
    if (!counter) return;
    const marks = counter.querySelector("[data-tally-marks]");
    const total = counter.querySelector("[data-tally-total]");
    const count = tallies[side];
    const visible = visibleTallyMarks(count);
    const fragment = document.createDocumentFragment();

    for (let start = 0; start < visible; start += 5) {
      const groupCount = Math.min(5, visible - start);
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.classList.add("pixel-bj-tally-group");
      svg.setAttribute("viewBox", "0 0 28 30");
      svg.setAttribute("aria-hidden", "true");

      // Four slightly imperfect ink strokes, crossed by one clean slash.
      const strokes = [
        "M 5 5.5 L 5.5 24.5",
        "M 10.5 4.5 L 10.5 24",
        "M 16 5.5 L 15.5 24",
        "M 21 4.5 L 21.25 24.5",
      ];
      for (let i = 0; i < Math.min(groupCount, 4); i += 1) {
        svg.append(tallyPath(strokes[i], "pixel-bj-tally-stroke", animated && start + i + 1 === visible));
      }
      if (groupCount === 5) {
        svg.append(tallyPath("M 2.5 25 L 24 5.5", "pixel-bj-tally-slash", animated && start + 5 === visible));
      }
      fragment.append(svg);
    }

    marks.replaceChildren(fragment);
    total.hidden = count <= 25;
    total.textContent = count > 25 ? String(count) : "";
    counter.setAttribute("aria-label", `${side === "dealer" ? "Dealer" : "You"}: ${count} ${count === 1 ? "win" : "wins"}`);
  }

  function recordRound() {
    if (round?.phase !== "done" || round === scoredRound) return;
    scoredRound = round;
    const side = winnerForResult(round.result);
    if (!side) return;
    tallies = advanceTallies(tallies, round.result);
    saveTallies(storage, tallies);
    renderTally(side, true);
  }

  renderTally("dealer");
  renderTally("player");

  function shellNode(shell) {
    return shell?.querySelector(".pixel-bj-card");
  }

  function shellBounds(shell) {
    const rect = shell.getBoundingClientRect();
    const stage = root.getBoundingClientRect();
    return {
      x: rect.left - stage.left,
      y: rect.top - stage.top,
      w: rect.width,
      h: rect.height,
    };
  }

  function particleCount(rank) {
    if (rank === "A") return 8;
    if (["K", "Q", "J"].includes(rank)) return 7;
    return 5;
  }

  function spawnSuitParticles(shell, card, burst = "deal") {
    if (!card || !canAnimate(root)) return;
    const { x, y, w, h } = shellBounds(shell);
    const count = burst === "reveal" ? particleCount(card.rank) + 1 : particleCount(card.rank);
    const colors = PARTICLE_COLORS[card.suit] || ["#f3ecd9"];
    for (let index = 0; index < count; index += 1) {
      const particle = make("span", `pixel-bj-particle pixel-bj-particle--${card.suit}`);
      const size = [4, 4, 6][index % 3];
      const side = index % 2 === 0 ? -1 : 1;
      const startX = x + w * (0.32 + ((index * 17) % 24) / 100);
      const startY = y + h * (0.22 + ((index * 13) % 36) / 100);
      const rise = card.suit === "spades" ? -20 - (index % 3) * 6 : -8 - (index % 2) * 4;
      const drift = burst === "reveal" ? side * (12 + (index % 3) * 8) : side * (9 + (index % 4) * 6);
      const fall = card.suit === "hearts" ? 10 + (index % 3) * 4 : 0;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${startX}px`;
      particle.style.top = `${startY}px`;
      particle.style.background = colors[index % colors.length];
      if (card.suit === "hearts") particle.style.setProperty("--particle-radius", "2px 2px 3px 3px");
      if (card.suit === "diamonds") particle.style.boxShadow = `0 0 0 1px ${colors[(index + 1) % colors.length]}22`;
      particleLayer.append(particle);
      void play(particle, [
        { transform: `translate(0px, 0px) scale(1)`, opacity: 0 },
        { transform: `translate(${drift * 0.32}px, ${rise * 0.25 + fall * 0.18}px) scale(1)`, opacity: 1, offset: 0.16 },
        { transform: `translate(${drift}px, ${rise + fall}px) scale(${burst === "reveal" ? 0.86 : 0.78})`, opacity: 0 },
      ], { duration: MOTION.particles + index * 18, easing: "cubic-bezier(.2,.65,.3,1)" }).finally(() => particle.remove());
    }
  }

  async function pulseHand(hand, type) {
    const shells = [...hand.children];
    if (!shells.length || !canAnimate(hand)) return;
    const frames = {
      win: [
        { filter: "brightness(1)", transform: "translateY(0px)" },
        { filter: "brightness(1.14)", transform: "translateY(-2px)" },
        { filter: "brightness(1)", transform: "translateY(0px)" },
      ],
      lose: [
        { filter: "brightness(1)", opacity: 1 },
        { filter: "brightness(0.78)", opacity: 0.84 },
        { filter: "brightness(1)", opacity: 1 },
      ],
    }[type];
    if (!frames) return;
    await Promise.all(shells.map((shell, index) => play(shellNode(shell), frames, { duration: MOTION.outcome, delay: index * 24, easing: "ease-out" })));
  }

  async function shakeShell(shell) {
    const node = shellNode(shell);
    if (!node || !canAnimate(node)) return;
    await play(node, [
      { transform: "translateX(0px) translateY(0px)" },
      { transform: "translateX(-3px) translateY(1px)" },
      { transform: "translateX(3px) translateY(-1px)" },
      { transform: "translateX(-2px) translateY(1px)" },
      { transform: "translateX(0px) translateY(0px)" },
    ], { duration: MOTION.shake, easing: "ease-out" });
  }

  async function playOutcomeEffect(result) {
    if (!result) return;
    if (result === "win" || result === "blackjack") {
      await pulseHand(playerRoot, "win");
      [...playerRoot.children].forEach((shell, index) => {
        const card = round.player[index];
        if (card) spawnSuitParticles(shell, card, "reveal");
      });
      return;
    }
    if (result === "lose") {
      await pulseHand(playerRoot, "lose");
      return;
    }
    if (result === "bust") {
      const lastShell = playerRoot.lastElementChild;
      const lastCard = round.player.at(-1);
      if (lastShell && lastCard) {
        await shakeShell(lastShell);
        spawnSuitParticles(lastShell, lastCard, "reveal");
      }
    }
  }

  function lock(value) {
    busy = value;
    root.dataset.busy = String(value);
    for (const button of buttons) button.disabled = value;
  }

  function message(text, outcome = "playing", animated = true) {
    resultNode.textContent = text;
    resultNode.dataset.outcome = outcome;
    if (animated) {
      void play(resultNode, [
        { opacity: 0, translate: "0px 4px" },
        { opacity: 1, translate: "0px 0px" },
      ], { duration: MOTION.message, easing: "ease-out" });
    }
  }

  // Put the badge just beyond the actual card fan, not at the page edge.
  function positionHandTotal(hand) {
    if (!hand.children.length) return;
    const box = hand.getBoundingClientRect();
    const edge = Math.max(...[...hand.children].map((shell) => shell.getBoundingClientRect().right));
    const left = Math.min(box.width - 36, Math.max(0, edge - box.left + 8));
    hand.style.setProperty("--hand-total-left", `${Math.round(left)}px`);
  }

  // Totals are a transient peek, never another permanent scoreboard.
  function hideHandTotals() {
    if (handTotalTimeout !== null) {
      window.clearTimeout(handTotalTimeout);
      handTotalTimeout = null;
    }
    delete playerRoot.dataset.handTotal;
    delete dealerRoot.dataset.handTotal;
    playerRoot.setAttribute("aria-label", "Your cards. Activate to see your total.");
    dealerRoot.setAttribute("aria-label", "Dealer cards. Total available after the round.");
  }

  function revealHandTotals() {
    if (!round) return;
    hideHandTotals();
    const playerTotal = handValue(round.player).total;
    playerRoot.dataset.handTotal = String(playerTotal);
    positionHandTotal(playerRoot);
    playerRoot.setAttribute("aria-label", `Your cards: ${playerTotal}. Activate to hide totals.`);
    if (round.phase === "done") {
      const dealerTotal = handValue(round.dealer).total;
      dealerRoot.dataset.handTotal = String(dealerTotal);
      positionHandTotal(dealerRoot);
      dealerRoot.setAttribute("aria-label", `Dealer cards: ${dealerTotal}. Activate to hide totals.`);
    }
    handTotalTimeout = window.setTimeout(hideHandTotals, 3000);
  }

  function toggleHandTotals(side) {
    if (!round || busy || (side === "dealer" && round.phase !== "done")) return;
    if (playerRoot.hasAttribute("data-hand-total")) hideHandTotals();
    else revealHandTotals();
  }

  function showOutcome() {
    recordRound();
    const result = round.result || "playing";
    message(OUTCOME_TEXT[result] || OUTCOME_TEXT.playing, result);
    const playing = round.phase === "playing";
    hitButton.hidden = !playing;
    standButton.hidden = !playing;
    dealButton.hidden = playing;
    dealerRoot.tabIndex = playing ? -1 : 0;
    dealerRoot.setAttribute("aria-disabled", String(playing));
    if (!playing) revealHandTotals();
  }

  function pileCenter() {
    const stageRect = root.getBoundingClientRect();
    const dealerRect = dealerRoot.getBoundingClientRect();
    return {
      x: dealerRect.left + dealerRect.width / 2,
      y: Math.max(stageRect.top + 18, dealerRect.top - 28),
    };
  }

  async function dealCard(owner, card, hidden = false) {
    const hand = owner === "dealer" ? dealerRoot : playerRoot;
    const previous = Array.from(hand.children, (shell) => [shell, center(shell.getBoundingClientRect())]);
    const shell = buildCard(card, hidden);
    decorateShell(shell, owner, hand.children.length);
    hand.append(shell);
    nudgeExisting(hand, previous);
    await flyIn(shell, pileCenter());
    if (!hidden) spawnSuitParticles(shell, card, "deal");
  }

  async function revealDealerHole() {
    const node = dealerRoot.children[1]?.querySelector(".pixel-bj-card--back");
    if (!node) return;
    const card = round.dealer[1];
    if (!canAnimate(node)) {
      showFace(node, card);
      return;
    }
    // Two half turns make the artwork change exactly at the card's thin edge.
    await play(node, [
      { transform: "rotateY(0deg)" },
      { transform: "rotateY(90deg)" },
    ], { duration: MOTION.flip / 2, easing: "ease-in" });
    showFace(node, card);
    await play(node, [
      { transform: "rotateY(-90deg)" },
      { transform: "rotateY(0deg)" },
    ], { duration: MOTION.flip / 2, easing: "ease-out" });
    spawnSuitParticles(dealerRoot.children[1], card, "reveal");
  }

  async function gatherCards() {
    const shells = [...dealerRoot.children, ...playerRoot.children];
    if (!shells.length) return;
    const target = pileCenter();
    await Promise.all(shells.map((shell, index) => {
      const from = center(shell.getBoundingClientRect());
      return play(shell, [
        { translate: "0px 0px", rotate: "0deg", scale: 1, opacity: 1 },
        { translate: `${target.x - from.x}px ${target.y - from.y}px`, rotate: "10deg", scale: 0.76, opacity: 0 },
      ], { duration: MOTION.collect, delay: index * 22, easing: "ease-in" });
    }));
    dealerRoot.replaceChildren();
    playerRoot.replaceChildren();
  }

  async function newRound() {
    if (busy) return;
    hideHandTotals();
    dealerRoot.tabIndex = -1;
    dealerRoot.setAttribute("aria-disabled", "true");
    lock(true);
    try {
      await gatherCards();
      message("Dealing...", "playing", false);
      const next = beginRound(shuffleDeck(createDeck()));
      // Standard order: player, dealer, player, dealer (hole card hidden).
      await dealCard("player", next.player[0]);
      await dealCard("dealer", next.dealer[0]);
      await dealCard("player", next.player[1]);
      await dealCard("dealer", next.dealer[1], true);
      round = next;
      if (round.phase !== "playing") await revealDealerHole();
      showOutcome();
      await playOutcomeEffect(round.result);
    } finally {
      lock(false);
    }
  }

  async function onHit() {
    if (busy || round?.phase !== "playing") return;
    hideHandTotals();
    lock(true);
    try {
      const next = hit(round);
      const card = next.player.at(-1);
      round = next;
      await dealCard("player", card);
      if (round.phase !== "playing") await revealDealerHole();
      showOutcome();
      await playOutcomeEffect(round.result);
    } finally {
      lock(false);
    }
  }

  async function onStand() {
    if (busy || round?.phase !== "playing") return;
    hideHandTotals();
    lock(true);
    try {
      const previousDealerCount = round.dealer.length;
      const next = stand(round);
      round = next;
      await revealDealerHole();
      for (const card of round.dealer.slice(previousDealerCount)) {
        await dealCard("dealer", card);
      }
      showOutcome();
      await playOutcomeEffect(round.result);
    } finally {
      lock(false);
    }
  }

  // The cards themselves are the optional reveal control. No extra button on the table.
  for (const [hand, side] of [[playerRoot, "player"], [dealerRoot, "dealer"]]) {
    hand.setAttribute("role", "button");
    hand.tabIndex = side === "player" ? 0 : -1;
    hand.addEventListener("click", (event) => {
      if (event.target.closest(".pixel-bj-card-shell")) toggleHandTotals(side);
    });
    hand.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleHandTotals(side);
    });
  }
  dealerRoot.setAttribute("aria-disabled", "true");
  hideHandTotals();

  hitButton.addEventListener("click", () => { void onHit(); });
  standButton.addEventListener("click", () => { void onStand(); });
  dealButton.addEventListener("click", () => { void newRound(); });

  void newRound();
}
