export interface StoredSession<T> {
  version: number;
  savedAt: number;
  state: T;
}

const DEFAULT_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function readStoredScore(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeStoredScore(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage may be unavailable in private or restricted browsing.
  }
}

export function readStoredSession<T>(
  key: string,
  version: number,
  isValid: (state: unknown) => state is T,
  maxAgeMs = DEFAULT_SESSION_MAX_AGE_MS,
): StoredSession<T> | null {
  const discard = (): null => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage failures while rejecting a bad session.
    }
    return null;
  };

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("version" in parsed) ||
      !("savedAt" in parsed) ||
      !("state" in parsed)
    ) {
      return discard();
    }

    const candidate = parsed as Partial<StoredSession<unknown>>;
    const now = Date.now();
    const validTimestamp =
      typeof candidate.savedAt === "number" &&
      Number.isFinite(candidate.savedAt) &&
      candidate.savedAt > 0 &&
      candidate.savedAt <= now + MAX_FUTURE_CLOCK_SKEW_MS &&
      now - candidate.savedAt <= Math.max(0, maxAgeMs);

    if (
      candidate.version !== version ||
      !validTimestamp ||
      !isValid(candidate.state)
    ) {
      return discard();
    }

    return candidate as StoredSession<T>;
  } catch {
    return discard();
  }
}

export function writeStoredSession<T>(
  key: string,
  version: number,
  state: T,
): void {
  try {
    const payload: StoredSession<T> = {
      version,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable or full.
  }
}

export function removeStoredSession(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in private or restricted browsing.
  }
}
