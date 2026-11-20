import assert from "node:assert/strict";
import test from "node:test";
import { createDeck, handValue, beginRound, hit, stand } from "../rules.mjs";

test("deck has 52 unique cards", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((card) => `${card.rank}-${card.suit}`)).size, 52);
});

test("hand values handle aces", () => {
  assert.equal(handValue([{ rank: "A" }, { rank: "9" }]).total, 20);
  assert.equal(handValue([{ rank: "A" }, { rank: "9" }, { rank: "8" }]).total, 18);
});

test("natural blackjack settles immediately", () => {
  const round = beginRound([
    { rank: "A", suit: "spades" },
    { rank: "9", suit: "hearts" },
    { rank: "K", suit: "clubs" },
    { rank: "8", suit: "diamonds" },
  ]);
  assert.equal(round.phase, "done");
  assert.equal(round.result, "blackjack");
});

test("hit can bust player", () => {
  const round = hit({
    deck: [{ rank: "K", suit: "spades" }],
    player: [{ rank: "10", suit: "hearts" }, { rank: "8", suit: "clubs" }],
    dealer: [{ rank: "7", suit: "diamonds" }, { rank: "9", suit: "spades" }],
    phase: "playing",
    result: null,
  });
  assert.equal(round.result, "bust");
});

test("stand resolves dealer draw and winner", () => {
  const round = stand({
    deck: [{ rank: "5", suit: "clubs" }],
    player: [{ rank: "10", suit: "hearts" }, { rank: "9", suit: "clubs" }],
    dealer: [{ rank: "8", suit: "diamonds" }, { rank: "8", suit: "spades" }],
    phase: "playing",
    result: null,
  });
  assert.equal(round.result, "lose");
});
