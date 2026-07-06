export type ArcadeGameId = "snake" | "crane" | "chicken";

export type GameCommandAction =
  | "start"
  | "pause"
  | "restart"
  | "exit"
  | "drop"
  | "jump";

export type GameStatusPhase =
  | "ready"
  | "saved"
  | "playing"
  | "paused"
  | "choosing"
  | "transitioning"
  | "confirming"
  | "crashed"
  | "gameover";

export interface GameCommandDetail {
  action: GameCommandAction;
}

export interface GameStatusDetail {
  game: ArcadeGameId;
  phase: GameStatusPhase;
  progress: string;
  text: string;
  pauseLabel?: "PAUSE" | "RESUME";
  pauseDisabled?: boolean;
}

export const GAME_EVENTS = {
  snake: {
    start: "tiendu:snake-start",
    command: "tiendu:snake-command",
    status: "tiendu:snake-status",
    exit: "tiendu:snake-exit",
  },
  crane: {
    start: "tiendu:crane-start",
    command: "tiendu:crane-command",
    status: "tiendu:crane-status",
    exit: "tiendu:crane-exit",
  },
  chicken: {
    start: "tiendu:chicken-start",
    command: "tiendu:chicken-command",
    status: "tiendu:chicken-status",
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

export function dispatchGameCommand(
  eventName: string,
  action: GameCommandAction,
): void {
  window.dispatchEvent(
    new CustomEvent<GameCommandDetail>(eventName, { detail: { action } }),
  );
}

export function readGameCommand(event: Event): GameCommandAction | null {
  if (!(event instanceof CustomEvent) || !event.detail) return null;
  const action = (event.detail as Partial<GameCommandDetail>).action;
  return action === "start" ||
    action === "pause" ||
    action === "restart" ||
    action === "exit" ||
    action === "drop" ||
    action === "jump"
    ? action
    : null;
}

export function dispatchGameStatus(
  eventName: string,
  detail: GameStatusDetail,
): void {
  window.dispatchEvent(new CustomEvent<GameStatusDetail>(eventName, { detail }));
}

export function dispatchGameExit<T extends object>(
  eventName: string,
  detail: T,
): void {
  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}
