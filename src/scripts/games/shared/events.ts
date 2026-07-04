export const GAME_EVENTS = {
  snake: {
    start: "tiendu:snake-start",
    exit: "tiendu:snake-exit",
  },
  invaders: {
    start: "tiendu:invaders-start",
    exit: "tiendu:invaders-exit",
  },
  breakout: {
    start: "tiendu:breakout-start",
    exit: "tiendu:breakout-exit",
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

export interface InvadersExitDetail extends ScoreExitDetail {
  wave: number;
}

export interface BreakoutExitDetail extends ScoreExitDetail {
  level: number;
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
