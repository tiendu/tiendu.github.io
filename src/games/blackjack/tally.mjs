// Counts belong to one browser, not to a signed-in or global leaderboard.
const STORAGE_KEY = "tiendu:blackjack:tallies:v1";
const PAGE_SIZE = 25;

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function loadTallies(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    return { player: validCount(saved?.player), dealer: validCount(saved?.dealer) };
  } catch {
    // The game remains playable when storage is blocked or unavailable.
    return { player: 0, dealer: 0 };
  }
}

export function saveTallies(storage, tallies) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(tallies));
  } catch {
    // Private browsing and storage quotas must not interrupt a round.
  }
}

export function winnerForResult(result) {
  if (result === "win" || result === "blackjack") return "player";
  if (result === "lose" || result === "bust") return "dealer";
  return null; // Push and unfinished hands do not count.
}

export function advanceTallies(tallies, result) {
  const winner = winnerForResult(result);
  if (!winner) return tallies;
  return { ...tallies, [winner]: Math.min(Number.MAX_SAFE_INTEGER, tallies[winner] + 1) };
}

export function visibleTallyMarks(count) {
  if (!Number.isSafeInteger(count) || count <= 0) return 0;
  // Display the 25th mark; the NEXT win starts a fresh set of groups.
  return ((count - 1) % PAGE_SIZE) + 1;
}
