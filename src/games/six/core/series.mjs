// Win counts belong to a run of complete matches, never individual dice rolls.
// A drawn match has no winner and awards no win.
export function recordWin(wins = {}, winner) {
  if (!winner) return wins;
  return { ...wins, [winner]: (wins[winner] ?? 0) + 1 };
}
