export const SUITS = Object.freeze([
  { id: "spades", symbol: "♠", name: "Spades" },
  { id: "hearts", symbol: "♥", name: "Hearts" },
  { id: "clubs", symbol: "♣", name: "Clubs" },
  { id: "diamonds", symbol: "♦", name: "Diamonds" },
]);

export const RANKS = Object.freeze(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit: suit.id, rank });
  }
  return deck;
}

export function shuffleDeck(cards, random = Math.random) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function rankValue(rank) {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return Number(rank);
}

export function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += rankValue(card.rank);
    if (card.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand).total === 21;
}

function copyRound(round) {
  return {
    ...round,
    player: [...round.player],
    dealer: [...round.dealer],
    deck: [...round.deck],
  };
}

function draw(round, who) {
  round[who] = [...round[who], round.deck[0]];
  round.deck = round.deck.slice(1);
  return round;
}

function settle(round, result) {
  round.phase = "done";
  round.result = result;
  return round;
}

function compareHands(player, dealer) {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}

export function beginRound(deck) {
  const round = { deck: [...deck], player: [], dealer: [], phase: "playing", result: null };
  for (let i = 0; i < 2; i++) {
    draw(round, "player");
    draw(round, "dealer");
  }

  const playerBJ = isBlackjack(round.player);
  const dealerBJ = isBlackjack(round.dealer);
  if (playerBJ && dealerBJ) return settle(round, "push");
  if (playerBJ) return settle(round, "blackjack");
  if (dealerBJ) return settle(round, "lose");
  return round;
}

export function hit(round) {
  if (round.phase !== "playing") return round;
  const next = draw(copyRound(round), "player");
  if (handValue(next.player).total > 21) return settle(next, "bust");
  return next;
}

export function stand(round) {
  if (round.phase !== "playing") return round;
  let next = copyRound(round);
  while (handValue(next.dealer).total < 17) next = draw(next, "dealer");
  if (handValue(next.dealer).total > 21) return settle(next, "win");
  return settle(next, compareHands(next.player, next.dealer));
}
