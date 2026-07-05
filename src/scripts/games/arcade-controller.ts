import {
  GAME_EVENTS,
  type ChickenExitDetail,
  type ScoreExitDetail,
} from "./shared/events";

export type GameId = "snake" | "crane" | "chicken";
type ExitDetail = ScoreExitDetail | ChickenExitDetail;

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
  load: () => Promise<void>;
  aliases: readonly string[];
  startEvent: string;
  exitEvent: string;
  rootSelector: string;
  overlaySelector: string;
  stateSelector: string;
  progressSelector: string;
  actionSelector: string;
  pauseSelector?: string;
  actionToKey: (action: string | undefined) => string | null;
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
    load: async () => {
      const { mountSnakeGames } = await import("./snake");
      mountSnakeGames();
    },
    aliases: ["snake"],
    startEvent: GAME_EVENTS.snake.start,
    exitEvent: GAME_EVENTS.snake.exit,
    rootSelector: "[data-snake-game]",
    overlaySelector: "[data-snake-overlay]",
    stateSelector: "[data-snake-state]",
    progressSelector: "[data-snake-mode]",
    actionSelector: "[data-snake-action]",
    pauseSelector: '[data-snake-action="pause"]',
    actionToKey: (action) =>
      action === "pause"
        ? "p"
        : action === "restart"
          ? "r"
          : action === "exit"
            ? "Escape"
            : null,
    readyStatus: (sector, fine) =>
      `SECTOR ${sector} · READY · ${fine ? "ARROWS / WASD · SPACE DRIVE" : "USE CONTROLS"}`,
    activeStatus: (sector, fine) =>
      `SECTOR ${sector} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
    syncStatus: (state, sector, overlayVisible, fine) => {
      if (state === "PAUSED") {
        return { text: `SECTOR ${sector} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "RUN TERMINATED" || state === "GRID CLEARED") {
        return {
          text: `SECTOR ${sector} · ${state} · START AGAIN OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state.includes("CLEARED")) {
        return {
          text: `SECTOR ${sector} · CHOOSE LEFT OR RIGHT ROUTE`,
          pauseDisabled: true,
        };
      }
      if (state === "NEON RUN" || state === "SAVED RUN") {
        return {
          text: `SECTOR ${sector} · READY · ${fine ? "ARROWS / WASD · SPACE DRIVE" : "USE CONTROLS"}`,
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return {
          text: `SECTOR ${sector} · ACTIVE · ${fine ? "ESC EXIT" : "USE CONTROLS"}`,
        };
      }
      return { text: `SECTOR ${sector} · READY` };
    },
    exitMessage: (detail) => {
      const snake = detail as Partial<ScoreExitDetail>;
      return `SNAKE CLOSED · SCORE ${format(score(snake.score), 4)} · HIGH ${format(score(snake.highScore), 4)}`;
    },
  },
  {
    id: "crane",
    load: async () => {
      const { mountCraneGames } = await import("./crane");
      mountCraneGames();
    },
    aliases: ["crane", "stack", "cargo", "stacktrace"],
    startEvent: GAME_EVENTS.crane.start,
    exitEvent: GAME_EVENTS.crane.exit,
    rootSelector: "[data-crane-game]",
    overlaySelector: "[data-crane-overlay]",
    stateSelector: "[data-crane-state]",
    progressSelector: "[data-crane-height]",
    actionSelector: "[data-crane-action]",
    actionToKey: (action) =>
      action === "drop"
        ? " "
        : action === "pause"
          ? "p"
          : action === "restart"
            ? "r"
            : action === "exit"
              ? "Escape"
              : null,
    readyStatus: () => "STACK TRACE · READY · TAP/CLICK/SPACE TO DROP",
    activeStatus: (height) => `HEIGHT ${height} · ACTIVE · TIME THE DROP`,
    syncStatus: (state, height, overlayVisible) => {
      if (state === "PAUSED") {
        return { text: `HEIGHT ${height} · GAME PAUSED`, pauseLabel: "RESUME" };
      }
      if (state === "STRUCTURAL FAILURE") {
        return {
          text: `HEIGHT ${height} · STRUCTURAL FAILURE · DROP AGAIN OR EXIT`,
          pauseDisabled: true,
        };
      }
      if (state === "STACK TRACE") {
        return {
          text: "STACK TRACE · READY · TAP/CLICK/SPACE TO DROP",
          pauseDisabled: true,
        };
      }
      if (!overlayVisible || state === "RUNNING") {
        return { text: `HEIGHT ${height} · ACTIVE · TIME THE DROP` };
      }
      return { text: `HEIGHT ${height} · READY` };
    },
    exitMessage: (detail) => {
      const crane = detail as Partial<ScoreExitDetail>;
      return `STACK TRACE CLOSED · HEIGHT ${format(score(crane.score), 3)} · HIGH ${format(score(crane.highScore), 3)}`;
    },
  },
  {
    id: "chicken",
    load: async () => {
      const { mountChickenRunGames } = await import("./chicken-run");
      mountChickenRunGames();
    },
    aliases: ["chicken", "freerange", "free-range"],
    startEvent: GAME_EVENTS.chicken.start,
    exitEvent: GAME_EVENTS.chicken.exit,
    rootSelector: "[data-chicken-game]",
    overlaySelector: "[data-chicken-overlay]",
    stateSelector: "[data-chicken-state]",
    progressSelector: "[data-chicken-speed]",
    actionSelector: "[data-chicken-action]",
    pauseSelector: '[data-chicken-action="pause"]',
    actionToKey: (action) =>
      action === "pause"
        ? "p"
        : action === "restart"
          ? "r"
          : action === "exit"
            ? "Escape"
            : null,
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
        return { text: `SPEED ${speed} · COLLISION`, pauseDisabled: true };
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
      const chicken = detail as Partial<ChickenExitDetail>;
      const speedLevel = positive(chicken.speed, 1);
      return `FREE RANGE CLOSED · SCORE ${format(score(chicken.score), 4)} · HIGH ${format(score(chicken.highScore), 4)} · SPEED ${format(speedLevel, 2)}`;
    },
  },
];

function setPauseButton(
  button: HTMLButtonElement | null,
  label = "PAUSE",
  disabled = false,
): void {
  if (!button) return;

  // Keep this setter idempotent. The arcade controller observes game status
  // elements; rewriting the pause button on every observer callback can create
  // a MutationObserver feedback loop and lock the browser tab.
  if (button.textContent !== label) button.textContent = label;
  if (button.disabled !== disabled) button.disabled = disabled;

  const pressed = label === "RESUME" ? "true" : "false";
  if (button.getAttribute("aria-pressed") !== pressed) {
    button.setAttribute("aria-pressed", pressed);
  }
}

function normalizeProgress(value: string, id: GameId): string {
  const cleaned = value.trim().toUpperCase();
  if (id === "snake") return cleaned || "--";
  if (id === "crane") return cleaned ? cleaned.padStart(3, "0") : "000";
  return cleaned ? cleaned.padStart(2, "0") : "01";
}

export function createArcadeController(host: ArcadeHost): ArcadeController {
  let activeGame: GameId | null = null;
  const byAlias = new Map<string, GameDefinition>();
  const loadedGames = new Set<GameId>();
  const loadingGames = new Map<GameId, Promise<void>>();
  const runtime = new Map<
    GameId,
    {
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

  const loadGame = (definition: GameDefinition): Promise<void> => {
    if (loadedGames.has(definition.id)) return Promise.resolve();

    const existing = loadingGames.get(definition.id);
    if (existing) return existing;

    const loading = definition
      .load()
      .then(() => {
        loadedGames.add(definition.id);
      })
      .finally(() => {
        loadingGames.delete(definition.id);
      });

    loadingGames.set(definition.id, loading);
    return loading;
  };

  const restoreAfterLoadFailure = (definition: GameDefinition): void => {
    if (activeGame !== definition.id) return;
    activeGame = null;
    host.wrapper.classList.remove(`${definition.id}-mode`);
    if (host.profileView) host.profileView.hidden = false;
    if (host.profileCopy) host.profileCopy.hidden = false;
    if (host.shell) host.shell.hidden = false;
    host.resizeTerminalInput();
    setFooter("READY · TYPE HELP");
    host.showResponse(`${definition.id.toUpperCase()} COULD NOT LOAD · TRY AGAIN`);
    if (host.finePointer.matches && host.terminalInput) {
      window.setTimeout(() => host.terminalInput?.focus(), 0);
    }
  };

  const open = (definition: GameDefinition): void => {
    activeGame = definition.id;
    host.wrapper.classList.add(`${definition.id}-mode`);
    if (host.profileView) host.profileView.hidden = true;
    if (host.shell) host.shell.hidden = true;
    host.clearResponse();

    const game = runtime.get(definition.id);
    setPauseButton(game?.pauseButton ?? null, "PAUSE", true);
    setFooter(`${definition.id.toUpperCase()} · LOADING`);

    void loadGame(definition)
      .then(() => {
        if (activeGame !== definition.id) return;
        const progress = normalizeProgress(
          game?.progress?.textContent ?? "",
          definition.id,
        );
        setFooter(definition.readyStatus(progress, host.finePointer.matches));
        window.dispatchEvent(new CustomEvent(definition.startEvent));
        window.setTimeout(() => sync(definition), 0);
      })
      .catch(() => restoreAfterLoadFailure(definition));
  };

  definitions.forEach((definition) => {
    definition.aliases.forEach((alias) => byAlias.set(alias, definition));

    const root = host.wrapper.querySelector<HTMLElement>(definition.rootSelector);
    const overlay = host.wrapper.querySelector<HTMLElement>(
      definition.overlaySelector,
    );
    const state = host.wrapper.querySelector(definition.stateSelector);
    const progress = host.wrapper.querySelector(definition.progressSelector);
    const pauseButton = definition.pauseSelector
      ? host.wrapper.querySelector<HTMLButtonElement>(definition.pauseSelector)
      : null;

    runtime.set(definition.id, {
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
          const key = definition.actionToKey(action);
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

    // Observe only the pieces that actually drive footer status. Observing the
    // entire game subtree also observes the pause button that sync() updates,
    // which can feed mutations back into sync indefinitely.
    if (overlay) {
      new MutationObserver(() => sync(definition)).observe(overlay, {
        attributes: true,
        attributeFilter: ["hidden"],
      });
    }

    for (const statusNode of [state, progress]) {
      if (!statusNode) continue;
      new MutationObserver(() => sync(definition)).observe(statusNode, {
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
