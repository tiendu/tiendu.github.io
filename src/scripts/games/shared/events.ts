export const GAME_EVENTS = {
  snake: {
    start: "tiendu:snake-start",
    exit: "tiendu:snake-exit",
  },
  crane: {
    start: "tiendu:crane-start",
    exit: "tiendu:crane-exit",
  },
  chicken: {
    start: "tiendu:chicken-start",
    exit: "tiendu:chicken-exit",
  },
} as const;

export interface ScoreExitDetail {
  score: number;
  highScore: number;
}


export interface ChickenExitDetail extends ScoreExitDetail {
  speed: number;
}

export function dispatchGameExit<T extends object>(
  eventName: string,
  detail: T,
): void {
  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}
