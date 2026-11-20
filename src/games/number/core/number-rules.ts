/** Bounds are excluded: 0 and 100 are markers, and the target never moves. */
export interface NumberRound {
  readonly target: number;
  readonly low: number;
  readonly high: number;
  readonly guesses: number;
  readonly over: boolean;
}
export function createNumberRound(target = 1 + Math.floor(Math.random() * 99)): NumberRound {
  if (!Number.isInteger(target) || target < 1 || target > 99) {
    throw new RangeError("Target must be an integer from 1 to 99.");
  }
  return { target, low: 0, high: 100, guesses: 0, over: false };
}
export function guessNumber(round: NumberRound, guess: number): NumberRound {
  if (round.over || !Number.isInteger(guess) || guess <= round.low || guess >= round.high) return round;
  return {
    ...round,
    low: guess < round.target ? guess : round.low,
    high: guess > round.target ? guess : round.high,
    guesses: round.guesses + 1,
    over: guess === round.target,
  };
}
/** Reject corrupt or older inclusive-bound saves rather than changing their meaning. */
export function restoreNumberSession(value: unknown): { round: NumberRound; input: string } | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Record<string, unknown>;
  if (saved.version !== 2 || typeof saved.input !== "string" || !/^\d{0,3}$/.test(saved.input)) return null;
  if (!saved.round || typeof saved.round !== "object") return null;
  const r = saved.round as NumberRound;
  if (![r.target, r.low, r.high, r.guesses].every(Number.isInteger) ||
      r.low < 0 || r.high > 100 || r.target <= r.low || r.target >= r.high ||
      r.guesses < 0 || r.guesses > 99 || typeof r.over !== "boolean" ||
      (r.over && r.guesses === 0)) return null;
  return { round: { target: r.target, low: r.low, high: r.high, guesses: r.guesses, over: r.over }, input: saved.input };
}
