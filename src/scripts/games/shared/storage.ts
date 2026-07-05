export interface StoredSession<T> {
  version: number;
  savedAt: number;
  state: T;
}

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
): StoredSession<T> | null {
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
      window.localStorage.removeItem(key);
      return null;
    }

    const candidate = parsed as Partial<StoredSession<unknown>>;
    if (
      candidate.version !== version ||
      typeof candidate.savedAt !== "number" ||
      !Number.isFinite(candidate.savedAt) ||
      !isValid(candidate.state)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return candidate as StoredSession<T>;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage failures.
    }
    return null;
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
