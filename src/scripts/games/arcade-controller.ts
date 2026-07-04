import {
  GAME_EVENTS,
  type BreakoutExitDetail,
  type ChickenExitDetail,
  type InvadersExitDetail,
  type ScoreExitDetail,
} from "./shared/events";

export type GameId = "snake" | "invaders" | "breakout" | "chicken";

type ExitDetail =
  | ScoreExitDetail
  | InvadersExitDetail
  | BreakoutExitDetail
  | ChickenExitDetail;

interface ArcadeHost {
  wrapper: HTMLElement;
  profileView: HTMLElement | null;
  profileCopy: HTMLElement | null;
  shell: HTMLElement | null;
  terminalInput: HTMLInputElement | null;
  footerState: Element | null;
  finePointer: MediaQueryList;
  clearResponse: () => void;
  showResponse: (message: string) => void;
  resizeTerminalInput: () => void;
}

interface GameDefinition {
  id: GameId;
  aliases: readonly string[];
  startEvent: string;
  exitEvent: string;
  rootSelector: string;
  overlaySelector: string;
  stateSelector: string;
  progressSelector: string;
  actionSelector: string;
  pauseSelector: string;
  readyStatus: (progress: string, finePointer: boolean) => string;
  activeStatus: (progress: string, finePointer: boolean) => string;
  syncStatus: (
    state: string,
    progress: string,
    overlayVisible: boolean,
    finePointer: boolean,
  ) => { text: string; pauseLabel?: string; pauseDisabled?: boolean };
  exitMessage: (detail: ExitDetail) => string;
}

export interface ArcadeController {
  isActive: () => boolean;
  openCommand: (command: string) => boolean;
}

const score = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const positive = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const format = (value: number, width: number): string =>
  String(Math.max(0, Math.floor(value))).padStart(width, "0");

const definitions: readonly GameDefinition[] = [
  {
    id: "snake",
    aliases: ["snake"],
    startEvent: GAME_EVENTS.snake.start,
    exitEvent: GAME_EVENTS.snake.exit,
    rootSelector: "[data-snake-game]",
    overlaySelector: "[data-snake-overlay]",
    stateSelector: "[data-snake-state]",
    progressSelector: "[data-snake-mode]",
    actionSelector: "[data-snake-action]",
    pauseSelector: '[data-snake-action="pause"]',
    readyStatus: (mode, fine) =>
      `${mode} · READY · ${fine ? "ARROWS/WASD" : "USE CONTROLS"}`,
    activeStatus: (mode, fine) =>
      `${mode} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
    syncStatus: (state, mode, overlayVisible, fine) => {
      if (state === "PAUSED") {
        return { text: `${mode} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "GAME OVER" || state === "SYSTEM CLEARED") {
        return {
          text: `${mode} · ${state} · SELECT MODE OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state === "SELECT MODE") {
        return { text: "SELECT MODE · FREE OR MAZE", pauseDisabled: true };
      }
      if (state === "PRESS A DIRECTION") {
        return {
          text: `${mode} · READY · ${fine ? "ARROWS/WASD" : "USE CONTROLS"}`,
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return {
          text: `${mode} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
        };
      }
      return { text: `${mode} · READY` };
    },
    exitMessage: (detail) =>
      `SNAKE CLOSED · SCORE ${format(score(detail.score), 4)} · HIGH ${format(score(detail.highScore), 4)}`,
  },
  {
    id: "invaders",
    aliases: ["invaders", "invader"],
    startEvent: GAME_EVENTS.invaders.start,
    exitEvent: GAME_EVENTS.invaders.exit,
    rootSelector: "[data-invaders-game]",
    overlaySelector: "[data-invaders-overlay]",
    stateSelector: "[data-invaders-state]",
    progressSelector: "[data-invaders-wave]",
    actionSelector: "[data-invaders-action]",
    pauseSelector: '[data-invaders-action="pause"]',
    readyStatus: (wave, fine) =>
      `WAVE ${wave} · READY · ${fine ? "A/D + SPACE" : "USE CONTROLS"}`,
    activeStatus: (wave, fine) =>
      `WAVE ${wave} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
    syncStatus: (state, wave, overlayVisible, fine) => {
      if (state === "PAUSED") {
        return { text: `WAVE ${wave} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "GAME OVER") {
        return {
          text: `WAVE ${wave} · GAME OVER · RESTART OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state === "SHIP LOST") {
        return { text: `WAVE ${wave} · RECOVERING`, pauseDisabled: true };
      }
      if (state.startsWith("WAVE ") && state.endsWith(" CLEARED")) {
        return { text: `${state} · NEXT SIGNAL`, pauseDisabled: true };
      }
      if (state === "PRESS FIRE OR MOVE") {
        return {
          text: `WAVE ${wave} · READY · ${fine ? "A/D + SPACE" : "USE CONTROLS"}`,
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return {
          text: `WAVE ${wave} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
        };
      }
      return { text: `WAVE ${wave} · READY` };
    },
    exitMessage: (detail) => {
      const wave = positive((detail as Partial<InvadersExitDetail>).wave, 1);
      return `INVADERS CLOSED · SCORE ${format(score(detail.score), 4)} · HIGH ${format(score(detail.highScore), 4)} · WAVE ${format(wave, 2)}`;
    },
  },
  {
    id: "breakout",
    aliases: ["breakout", "arkanoid"],
    startEvent: GAME_EVENTS.breakout.start,
    exitEvent: GAME_EVENTS.breakout.exit,
    rootSelector: "[data-breakout-game]",
    overlaySelector: "[data-breakout-overlay]",
    stateSelector: "[data-breakout-state]",
    progressSelector: "[data-breakout-level]",
    actionSelector: "[data-breakout-action]",
    pauseSelector: '[data-breakout-action="pause"]',
    readyStatus: (level, fine) =>
      `LEVEL ${level} · READY · ${fine ? "A/D + SPACE" : "USE CONTROLS"}`,
    activeStatus: (level, fine) =>
      `LEVEL ${level} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
    syncStatus: (state, level, overlayVisible, fine) => {
      if (state === "PAUSED") {
        return { text: `LEVEL ${level} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "GAME OVER") {
        return {
          text: `LEVEL ${level} · GAME OVER · RESTART OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state === "BALL LOST") {
        return { text: `LEVEL ${level} · RECOVERING`, pauseDisabled: true };
      }
      if (state.startsWith("LEVEL ") && state.endsWith(" CLEARED")) {
        return { text: `${state} · NEXT BOARD`, pauseDisabled: true };
      }
      if (state === "PRESS FIRE OR MOVE") {
        return {
          text: `LEVEL ${level} · READY · ${fine ? "A/D + SPACE" : "USE CONTROLS"}`,
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return {
          text: `LEVEL ${level} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
        };
      }
      return { text: `LEVEL ${level} · READY` };
    },
    exitMessage: (detail) => {
      const level = positive((detail as Partial<BreakoutExitDetail>).level, 1);
      return `BREAKOUT CLOSED · SCORE ${format(score(detail.score), 4)} · HIGH ${format(score(detail.highScore), 4)} · LEVEL ${format(level, 2)}`;
    },
  },
  {
    id: "chicken",
    aliases: ["chicken", "freerange", "free-range"],
    startEvent: GAME_EVENTS.chicken.start,
    exitEvent: GAME_EVENTS.chicken.exit,
    rootSelector: "[data-chicken-game]",
    overlaySelector: "[data-chicken-overlay]",
    stateSelector: "[data-chicken-state]",
    progressSelector: "[data-chicken-speed]",
    actionSelector: "[data-chicken-action]",
    pauseSelector: '[data-chicken-action="pause"]',
    readyStatus: (speed, fine) =>
      `SPEED ${speed} · READY · ${fine ? "SPACE/UP" : "TAP TO JUMP"}`,
    activeStatus: (speed, fine) =>
      `SPEED ${speed} · ACTIVE · ${fine ? "ESC EXIT" : "TAP TO FLAP"}`,
    syncStatus: (state, speed, overlayVisible, fine) => {
      if (state === "PAUSED") {
        return { text: `SPEED ${speed} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "GAME OVER") {
        return {
          text: `SPEED ${speed} · GAME OVER · RESTART OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state === "CRASHED") {
        return {
          text: `SPEED ${speed} · COLLISION`,
          pauseDisabled: true,
        };
      }
      if (state === "PRESS JUMP") {
        return {
          text: `SPEED ${speed} · READY · ${fine ? "SPACE/UP" : "TAP TO JUMP"}`,
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return {
          text: `SPEED ${speed} · ACTIVE · ${fine ? "ESC EXIT" : "TAP TO FLAP"}`,
        };
      }
      return { text: `SPEED ${speed} · READY` };
    },
    exitMessage: (detail) => {
      const speedLevel = positive(
        (detail as Partial<ChickenExitDetail>).speed,
        1,
      );
      return `FREE RANGE CLOSED · SCORE ${format(score(detail.score), 4)} · HIGH ${format(score(detail.highScore), 4)} · SPEED ${format(speedLevel, 2)}`;
    },
  },
];

function setPauseButton(
  button: HTMLButtonElement | null,
  label = "PAUSE",
  disabled = false,
): void {
  if (!button) return;
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute("aria-pressed", label === "RESUME" ? "true" : "false");
}

function normalizeProgress(value: string, id: GameId): string {
  const fallback = id === "snake" ? "--" : "01";
  const cleaned = value.trim().toUpperCase();
  if (!cleaned) return fallback;
  return id === "snake" ? cleaned : cleaned.padStart(2, "0");
}

export function createArcadeController(host: ArcadeHost): ArcadeController {
  let activeGame: GameId | null = null;
  const byAlias = new Map<string, GameDefinition>();

  const runtime = new Map<
    GameId,
    {
      definition: GameDefinition;
      root: HTMLElement | null;
      overlay: HTMLElement | null;
      state: Element | null;
      progress: Element | null;
      pauseButton: HTMLButtonElement | null;
    }
  >();

  const setFooter = (value: string): void => {
    if (host.footerState) host.footerState.textContent = value;
  };

  const restoreProfile = (
    definition: GameDefinition,
    detail: ExitDetail,
  ): void => {
    activeGame = null;
    host.wrapper.classList.remove(`${definition.id}-mode`);
    setPauseButton(runtime.get(definition.id)?.pauseButton ?? null);

    if (host.profileView) host.profileView.hidden = false;
    if (host.profileCopy) host.profileCopy.hidden = false;
    if (host.shell) host.shell.hidden = false;

    host.resizeTerminalInput();
    setFooter("READY · TYPE HELP");
    host.showResponse(definition.exitMessage(detail));

    if (host.finePointer.matches && host.terminalInput) {
      window.setTimeout(() => host.terminalInput?.focus(), 0);
    }
  };

  const sync = (definition: GameDefinition): void => {
    if (activeGame !== definition.id) return;
    const game = runtime.get(definition.id);
    if (!game) return;

    const state = game.state?.textContent?.trim().toUpperCase() ?? "";
    const progress = normalizeProgress(
      game.progress?.textContent ?? "",
      definition.id,
    );
    const overlayVisible = game.overlay ? !game.overlay.hidden : false;
    const status = definition.syncStatus(
      state,
      progress,
      overlayVisible,
      host.finePointer.matches,
    );

    setFooter(
      status.text ||
        definition.activeStatus(progress, host.finePointer.matches),
    );
    setPauseButton(
      game.pauseButton,
      status.pauseLabel ?? "PAUSE",
      status.pauseDisabled ?? false,
    );
  };

  const open = (definition: GameDefinition): void => {
    activeGame = definition.id;
    host.wrapper.classList.add(`${definition.id}-mode`);
    if (host.profileView) host.profileView.hidden = true;
    if (host.shell) host.shell.hidden = true;
    host.clearResponse();

    const game = runtime.get(definition.id);
    const progress = normalizeProgress(
      game?.progress?.textContent ?? "",
      definition.id,
    );
    setFooter(definition.readyStatus(progress, host.finePointer.matches));
    setPauseButton(game?.pauseButton ?? null, "PAUSE", true);
    window.dispatchEvent(new CustomEvent(definition.startEvent));
    window.setTimeout(() => sync(definition), 0);
  };

  definitions.forEach((definition) => {
    definition.aliases.forEach((alias) => byAlias.set(alias, definition));

    const root = host.wrapper.querySelector<HTMLElement>(
      definition.rootSelector,
    );
    const overlay = host.wrapper.querySelector<HTMLElement>(
      definition.overlaySelector,
    );
    const state = host.wrapper.querySelector(definition.stateSelector);
    const progress = host.wrapper.querySelector(definition.progressSelector);
    const pauseButton = host.wrapper.querySelector<HTMLButtonElement>(
      definition.pauseSelector,
    );

    runtime.set(definition.id, {
      definition,
      root,
      overlay,
      state,
      progress,
      pauseButton,
    });

    host.wrapper
      .querySelectorAll<HTMLButtonElement>(definition.actionSelector)
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (activeGame !== definition.id) return;
          const action = button.dataset[`${definition.id}Action`];
          const key =
            action === "pause"
              ? "p"
              : action === "restart"
                ? "r"
                : action === "exit"
                  ? "Escape"
                  : null;
          if (!key) return;
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
      });

    if (root) {
      new MutationObserver(() => sync(definition)).observe(root, {
        attributes: true,
        attributeFilter: ["hidden"],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener(definition.exitEvent, (event) => {
      if (activeGame !== definition.id) return;
      const detail =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object"
          ? (event.detail as ExitDetail)
          : ({ score: 0, highScore: 0 } satisfies ScoreExitDetail);
      restoreProfile(definition, detail);
    });
  });

  return {
    isActive: () => activeGame !== null,
    openCommand: (command: string) => {
      if (activeGame) return false;
      const definition = byAlias.get(command);
      if (!definition) return false;
      open(definition);
      return true;
    },
  };
}
