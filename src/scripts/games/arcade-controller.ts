import {
  GAME_EVENTS,
  dispatchGameCommand,
  type ChickenExitDetail,
  type GameCommandAction,
  type GameStatusDetail,
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
  commandEvent: string;
  statusEvent: string;
  exitEvent: string;
  rootSelector: string;
  progressSelector: string;
  actionSelector: string;
  pauseSelector: string;
  readyStatus: (progress: string, finePointer: boolean) => string;
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
    commandEvent: GAME_EVENTS.snake.command,
    statusEvent: GAME_EVENTS.snake.status,
    exitEvent: GAME_EVENTS.snake.exit,
    rootSelector: "[data-snake-game]",
    progressSelector: "[data-snake-mode]",
    actionSelector: "[data-snake-action]",
    pauseSelector: '[data-snake-action="pause"]',
    readyStatus: (sector, fine) =>
      `SECTOR ${sector} · READY · ${fine ? "ARROWS / WASD" : "USE CONTROLS"}`,
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
    commandEvent: GAME_EVENTS.crane.command,
    statusEvent: GAME_EVENTS.crane.status,
    exitEvent: GAME_EVENTS.crane.exit,
    rootSelector: "[data-crane-game]",
    progressSelector: "[data-crane-height]",
    actionSelector: "[data-crane-action]",
    pauseSelector: '[data-crane-action="pause"]',
    readyStatus: () => "STACK TRACE · READY · TAP/CLICK/SPACE TO DROP",
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
    commandEvent: GAME_EVENTS.chicken.command,
    statusEvent: GAME_EVENTS.chicken.status,
    exitEvent: GAME_EVENTS.chicken.exit,
    rootSelector: "[data-chicken-game]",
    progressSelector: "[data-chicken-speed]",
    actionSelector: "[data-chicken-action]",
    pauseSelector: '[data-chicken-action="pause"]',
    readyStatus: (speed, fine) =>
      `SPEED ${speed} · READY · ${fine ? "SPACE/UP" : "TAP TO JUMP"}`,
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

function actionFromButton(
  definition: GameDefinition,
  button: HTMLButtonElement,
): GameCommandAction | null {
  const value = button.dataset[`${definition.id}Action`];
  return value === "pause" ||
    value === "restart" ||
    value === "exit" ||
    value === "drop" ||
    value === "jump" ||
    value === "start"
    ? value
    : null;
}

export function createArcadeController(host: ArcadeHost): ArcadeController {
  let activeGame: GameId | null = null;
  const byAlias = new Map<string, GameDefinition>();
  const loadedGames = new Set<GameId>();
  const loadingGames = new Map<GameId, Promise<void>>();
  const runtime = new Map<
    GameId,
    {
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

  const loadGame = (definition: GameDefinition): Promise<void> => {
    if (loadedGames.has(definition.id)) return Promise.resolve();

    const existing = loadingGames.get(definition.id);
    if (existing) return existing;

    const loading = definition
      .load()
      .then(() => {
        loadedGames.add(definition.id);
      })
      .finally(() => loadingGames.delete(definition.id));

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
      })
      .catch(() => restoreAfterLoadFailure(definition));
  };

  definitions.forEach((definition) => {
    definition.aliases.forEach((alias) => byAlias.set(alias, definition));

    const progress = host.wrapper.querySelector(definition.progressSelector);
    const pauseButton = host.wrapper.querySelector<HTMLButtonElement>(
      definition.pauseSelector,
    );

    runtime.set(definition.id, { progress, pauseButton });

    host.wrapper
      .querySelectorAll<HTMLButtonElement>(definition.actionSelector)
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (activeGame !== definition.id) return;
          const action = actionFromButton(definition, button);
          if (action) dispatchGameCommand(definition.commandEvent, action);
        });
      });

    window.addEventListener(definition.statusEvent, (event) => {
      if (activeGame !== definition.id || !(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as Partial<GameStatusDetail>;
      if (detail.game !== definition.id || typeof detail.text !== "string") {
        return;
      }
      setFooter(detail.text);
      setPauseButton(
        pauseButton,
        detail.pauseLabel ?? "PAUSE",
        detail.pauseDisabled ?? false,
      );
    });

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
