import { generateSudokuPuzzle, type SudokuDifficulty } from "./sudoku-generator";
import { countSolutions, conflictIndexes, isSolved, SUDOKU_CELL_COUNT } from "./sudoku-rules";
import {
  dispatchGameExit,
  dispatchGameStatus,
  GAME_EVENTS,
  readGameCommand,
} from "./shared/events";
import { mountAllGames } from "./shared/mount";
import {
  readStoredSession,
  removeStoredSession,
  writeStoredSession,
} from "./shared/storage";

interface HistoryEntry {
  board: number[];
  notes: number[][];
}

interface SudokuSessionState {
  difficulty: SudokuDifficulty;
  puzzle: number[];
  solution: number[];
  board: number[];
  notes: number[][];
  selectedIndex: number;
  notesMode: boolean;
  elapsedMs: number;
}

const SUDOKU_SESSION_KEY = "tiendu-sudoku-session";
const SUDOKU_SESSION_VERSION = 1;
const MAX_SAVED_ELAPSED_MS = 30 * 24 * 60 * 60 * 1000;

const DIFFICULTY_LABELS: Record<SudokuDifficulty, string> = {
  casual: "CASUAL",
  standard: "STANDARD",
  expert: "EXPERT",
};

const isDifficulty = (value: unknown): value is SudokuDifficulty =>
  value === "casual" || value === "standard" || value === "expert";

const isCellValue = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 9;

const isSolvedCellValue = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 9;

const isBoard = (value: unknown, solved = false): value is number[] =>
  Array.isArray(value) &&
  value.length === SUDOKU_CELL_COUNT &&
  value.every(solved ? isSolvedCellValue : isCellValue);

const isNotes = (value: unknown): value is number[][] =>
  Array.isArray(value) &&
  value.length === SUDOKU_CELL_COUNT &&
  value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length <= 9 &&
      entry.every(isSolvedCellValue) &&
      new Set(entry).size === entry.length,
  );

function isSudokuSessionState(value: unknown): value is SudokuSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SudokuSessionState>;
  if (
    !isDifficulty(state.difficulty) ||
    !isBoard(state.puzzle) ||
    !isBoard(state.solution, true) ||
    !isBoard(state.board) ||
    !isNotes(state.notes) ||
    !Number.isInteger(state.selectedIndex) ||
    (state.selectedIndex ?? -1) < 0 ||
    (state.selectedIndex ?? SUDOKU_CELL_COUNT) >= SUDOKU_CELL_COUNT ||
    typeof state.notesMode !== "boolean" ||
    typeof state.elapsedMs !== "number" ||
    !Number.isFinite(state.elapsedMs) ||
    state.elapsedMs < 0 ||
    state.elapsedMs > MAX_SAVED_ELAPSED_MS ||
    conflictIndexes(state.solution).size !== 0 ||
    countSolutions(state.puzzle, 2) !== 1
  ) {
    return false;
  }

  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    const given = state.puzzle[index] ?? 0;
    if (given !== 0 && given !== state.solution[index]) return false;
    if (given !== 0 && state.board[index] !== given) return false;
  }
  return true;
}

export function mountSudokuGames(): void {
  mountAllGames("[data-sudoku-game]", "sudokuInitialized", mountSudokuGame);
}

function mountSudokuGame(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("[data-sudoku-grid]");
  const difficultyOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-difficulty]");
  const timerOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-timer]");
  const blanksOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-blanks]");
  const message = root.querySelector<HTMLElement>("[data-sudoku-message]");
  const overlay = root.querySelector<HTMLElement>("[data-sudoku-overlay]");
  const resumePicker = root.querySelector<HTMLElement>("[data-sudoku-resume-picker]");
  const resumeSummary = root.querySelector<HTMLElement>("[data-sudoku-resume-summary]");
  const resumeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-sudoku-resume]"),
  );
  const noteButton = root.querySelector<HTMLButtonElement>('[data-sudoku-control="notes"]');
  const undoButton = root.querySelector<HTMLButtonElement>('[data-sudoku-control="undo"]');
  const eraseButton = root.querySelector<HTMLButtonElement>('[data-sudoku-control="erase"]');
  const newButton = root.querySelector<HTMLButtonElement>('[data-sudoku-control="new"]');
  const difficultyButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-sudoku-difficulty-button]"),
  );
  const numberButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-sudoku-number]"),
  );

  if (!grid) return;

  let active = false;
  let completed = false;
  let resumePrompt = false;
  let difficulty: SudokuDifficulty = "standard";
  let puzzle = Array<number>(SUDOKU_CELL_COUNT).fill(0);
  let solution = Array<number>(SUDOKU_CELL_COUNT).fill(0);
  let board = Array<number>(SUDOKU_CELL_COUNT).fill(0);
  let notes = Array.from({ length: SUDOKU_CELL_COUNT }, () => new Set<number>());
  let selectedIndex = 0;
  let notesMode = false;
  let history: HistoryEntry[] = [];
  let startedAt = 0;
  let elapsedMs = 0;
  let timerId: number | null = null;
  let lastPersistAt = 0;

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const currentElapsed = (): number =>
    completed || resumePrompt || !startedAt
      ? elapsedMs
      : elapsedMs + performance.now() - startedAt;

  const clearSession = (): void => removeStoredSession(SUDOKU_SESSION_KEY);

  const persistSession = (): void => {
    if (completed || puzzle.every((value) => value === 0)) {
      clearSession();
      return;
    }
    writeStoredSession<SudokuSessionState>(
      SUDOKU_SESSION_KEY,
      SUDOKU_SESSION_VERSION,
      {
        difficulty,
        puzzle: [...puzzle],
        solution: [...solution],
        board: [...board],
        notes: notes.map((values) => [...values].sort((a, b) => a - b)),
        selectedIndex,
        notesMode,
        elapsedMs: currentElapsed(),
      },
    );
    lastPersistAt = Date.now();
  };

  const updateTimer = (): void => {
    if (timerOutput) timerOutput.textContent = formatTime(currentElapsed());
    if (
      active &&
      !completed &&
      !resumePrompt &&
      Date.now() - lastPersistAt >= 1000
    ) {
      persistSession();
    }
  };

  const startTimer = (reset = false): void => {
    if (timerId !== null) window.clearInterval(timerId);
    if (reset) elapsedMs = 0;
    startedAt = performance.now();
    updateTimer();
    timerId = window.setInterval(updateTimer, 250);
  };

  const stopTimer = (): void => {
    if (!completed && !resumePrompt && startedAt) {
      elapsedMs += performance.now() - startedAt;
    }
    startedAt = 0;
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    updateTimer();
  };

  const publishStatus = (): void => {
    if (!active) return;
    const label = DIFFICULTY_LABELS[difficulty];
    if (resumePrompt) {
      dispatchGameStatus(GAME_EVENTS.sudoku.status, {
        game: "sudoku",
        phase: "saved",
        progress: label,
        text: `${label} · SAVED PUZZLE · CONTINUE OR NEW`,
        pauseDisabled: true,
      });
      return;
    }
    if (completed) {
      dispatchGameStatus(GAME_EVENTS.sudoku.status, {
        game: "sudoku",
        phase: "gameover",
        progress: label,
        text: `${label} · SOLVED · ${formatTime(currentElapsed())} · NEW OR EXIT`,
        pauseDisabled: true,
      });
      return;
    }
    dispatchGameStatus(GAME_EVENTS.sudoku.status, {
      game: "sudoku",
      phase: "playing",
      progress: label,
      text: `${label} · ${notesMode ? "NOTES" : "ENTRY"} · ARROWS/HJKL · 1-9 · N NOTES · ESC EXIT`,
      pauseDisabled: true,
    });
  };

  const snapshot = (): void => {
    history.push({
      board: [...board],
      notes: notes.map((values) => [...values]),
    });
    if (history.length > 100) history.shift();
  };

  const restoreSnapshot = (entry: HistoryEntry): void => {
    board = [...entry.board];
    notes = entry.notes.map((values) => new Set(values));
  };

  const isGiven = (index: number): boolean => (puzzle[index] ?? 0) !== 0;
  const selectedValue = (): number => board[selectedIndex] ?? 0;

  const createNotesMarkup = (cellNotes: ReadonlySet<number>): string =>
    Array.from({ length: 9 }, (_, offset) => {
      const value = offset + 1;
      return `<span>${cellNotes.has(value) ? value : ""}</span>`;
    }).join("");

  const render = (): void => {
    const conflicts = conflictIndexes(board);
    const focusValue = selectedValue();
    const selectedRow = Math.floor(selectedIndex / 9);
    const selectedColumn = selectedIndex % 9;
    const selectedBoxRow = Math.floor(selectedRow / 3);
    const selectedBoxColumn = Math.floor(selectedColumn / 3);

    grid.querySelectorAll<HTMLButtonElement>("[data-sudoku-cell]").forEach((cell) => {
      const index = Number(cell.dataset.sudokuCell);
      const value = board[index] ?? 0;
      const row = Math.floor(index / 9);
      const column = index % 9;
      const sameBox =
        Math.floor(row / 3) === selectedBoxRow &&
        Math.floor(column / 3) === selectedBoxColumn;
      const related = row === selectedRow || column === selectedColumn || sameBox;

      cell.classList.toggle("is-selected", index === selectedIndex);
      cell.classList.toggle("is-related", index !== selectedIndex && related);
      cell.classList.toggle("is-matching", focusValue > 0 && value === focusValue);
      cell.classList.toggle("is-conflict", conflicts.has(index));
      cell.classList.toggle("is-given", isGiven(index));
      cell.classList.toggle("has-value", value > 0);
      cell.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      cell.setAttribute(
        "aria-label",
        `Row ${row + 1}, column ${column + 1}${value ? `, ${value}` : ", empty"}${isGiven(index) ? ", given" : ""}`,
      );

      const valueElement = cell.querySelector<HTMLElement>("[data-sudoku-cell-value]");
      const notesElement = cell.querySelector<HTMLElement>("[data-sudoku-cell-notes]");
      if (valueElement) valueElement.textContent = value ? String(value) : "";
      if (notesElement) {
        notesElement.innerHTML = value ? "" : createNotesMarkup(notes[index] ?? new Set());
      }
    });

    if (difficultyOutput) difficultyOutput.textContent = DIFFICULTY_LABELS[difficulty];
    if (blanksOutput) blanksOutput.textContent = String(puzzle.filter((value) => value === 0).length);
    if (noteButton) {
      noteButton.classList.toggle("is-active", notesMode);
      noteButton.setAttribute("aria-pressed", notesMode ? "true" : "false");
    }
    if (undoButton) undoButton.disabled = history.length === 0 || completed || resumePrompt;
    if (eraseButton) eraseButton.disabled = completed || resumePrompt || isGiven(selectedIndex);
    difficultyButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.dataset.sudokuDifficultyButton === difficulty ? "true" : "false",
      );
    });
    if (message) {
      message.hidden = !completed;
      message.textContent = completed ? "PUZZLE COMPLETE." : "";
    }
    root.classList.toggle("is-complete", completed);
    publishStatus();
  };

  const buildGrid = (): void => {
    if (grid.childElementCount === SUDOKU_CELL_COUNT) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sudoku-cell";
      cell.dataset.sudokuCell = String(index);
      cell.setAttribute("role", "gridcell");
      cell.innerHTML =
        '<span class="sudoku-cell-value" data-sudoku-cell-value></span>' +
        '<span class="sudoku-cell-notes" data-sudoku-cell-notes aria-hidden="true"></span>';
      fragment.append(cell);
    }
    grid.replaceChildren(fragment);
  };

  const chooseInitialCell = (): void => {
    const blank = puzzle.findIndex((value) => value === 0);
    selectedIndex = blank >= 0 ? blank : 0;
  };

  const hideResumePrompt = (): void => {
    resumePrompt = false;
    if (overlay) overlay.hidden = true;
    if (resumePicker) resumePicker.hidden = true;
  };

  const showResumePrompt = (): void => {
    resumePrompt = true;
    stopTimer();
    if (resumeSummary) {
      resumeSummary.textContent = `${DIFFICULTY_LABELS[difficulty]} · ${formatTime(elapsedMs)}`;
    }
    if (resumePicker) resumePicker.hidden = false;
    if (overlay) overlay.hidden = false;
    render();
  };

  const newPuzzle = (nextDifficulty = difficulty): void => {
    hideResumePrompt();
    clearSession();
    difficulty = nextDifficulty;
    const generated = generateSudokuPuzzle(difficulty);
    puzzle = generated.puzzle;
    solution = generated.solution;
    board = [...puzzle];
    notes = Array.from({ length: SUDOKU_CELL_COUNT }, () => new Set<number>());
    history = [];
    notesMode = false;
    completed = false;
    chooseInitialCell();
    startTimer(true);
    render();
    persistSession();
    grid.focus({ preventScroll: true });
  };

  const restoreSession = (state: SudokuSessionState): void => {
    difficulty = state.difficulty;
    puzzle = [...state.puzzle];
    solution = [...state.solution];
    board = [...state.board];
    notes = state.notes.map((values) => new Set(values));
    selectedIndex = state.selectedIndex;
    notesMode = state.notesMode;
    elapsedMs = state.elapsedMs;
    startedAt = 0;
    completed = false;
    history = [];
    updateTimer();
    render();
    showResumePrompt();
  };

  const continueSession = (): void => {
    if (!active || !resumePrompt) return;
    hideResumePrompt();
    startTimer(false);
    render();
    persistSession();
    grid.focus({ preventScroll: true });
  };

  const checkCompletion = (): void => {
    if (!isSolved(board, solution)) return;
    completed = true;
    stopTimer();
    clearSession();
    render();
  };

  const enterNumber = (value: number): void => {
    if (completed || resumePrompt || isGiven(selectedIndex) || value < 1 || value > 9) return;
    snapshot();
    if (notesMode) {
      board[selectedIndex] = 0;
      const cellNotes = notes[selectedIndex]!;
      if (cellNotes.has(value)) cellNotes.delete(value);
      else cellNotes.add(value);
    } else {
      board[selectedIndex] = value;
      notes[selectedIndex]!.clear();
    }
    render();
    checkCompletion();
    persistSession();
  };

  const erase = (): void => {
    if (completed || resumePrompt || isGiven(selectedIndex)) return;
    const cellNotes = notes[selectedIndex]!;
    if ((board[selectedIndex] ?? 0) === 0 && cellNotes.size === 0) return;
    snapshot();
    board[selectedIndex] = 0;
    cellNotes.clear();
    render();
    persistSession();
  };

  const undo = (): void => {
    if (completed || resumePrompt) return;
    const entry = history.pop();
    if (!entry) return;
    restoreSnapshot(entry);
    render();
    persistSession();
  };

  const toggleNotes = (): void => {
    if (completed || resumePrompt) return;
    notesMode = !notesMode;
    render();
    persistSession();
  };

  const moveSelection = (rowDelta: number, columnDelta: number): void => {
    if (resumePrompt) return;
    const row = Math.floor(selectedIndex / 9);
    const column = selectedIndex % 9;
    const nextRow = Math.min(8, Math.max(0, row + rowDelta));
    const nextColumn = Math.min(8, Math.max(0, column + columnDelta));
    selectedIndex = nextRow * 9 + nextColumn;
    render();
  };

  const exitGame = (): void => {
    if (!active) return;
    stopTimer();
    if (!completed) persistSession();
    active = false;
    root.hidden = true;
    dispatchGameExit(GAME_EVENTS.sudoku.exit, { score: 0, highScore: 0 });
  };

  const startGame = (): void => {
    active = true;
    root.hidden = false;
    buildGrid();
    const saved = readStoredSession<SudokuSessionState>(
      SUDOKU_SESSION_KEY,
      SUDOKU_SESSION_VERSION,
      isSudokuSessionState,
    );
    if (saved) restoreSession(saved.state);
    else newPuzzle("standard");
  };

  const onCommand = (event: Event): void => {
    const action = readGameCommand(event);
    if (!active || !action) return;
    if (action === "exit") exitGame();
    else if (action === "restart") newPuzzle();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) return;
    const key = event.key.toLowerCase();

    if (event.key === "Escape") {
      event.preventDefault();
      exitGame();
      return;
    }
    if (resumePrompt) return;
    if (key >= "1" && key <= "9") {
      event.preventDefault();
      enterNumber(Number(key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || key === "0") {
      event.preventDefault();
      erase();
      return;
    }
    if (key === "n") {
      event.preventDefault();
      toggleNotes();
      return;
    }
    if (key === "u") {
      event.preventDefault();
      undo();
      return;
    }
    if (key === "r") {
      event.preventDefault();
      newPuzzle();
      return;
    }

    const movement: Record<string, readonly [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      h: [0, -1],
      j: [1, 0],
      k: [-1, 0],
      l: [0, 1],
    };
    const delta = movement[event.key] ?? movement[key];
    if (delta) {
      event.preventDefault();
      moveSelection(delta[0], delta[1]);
    }
  };

  grid.addEventListener("click", (event) => {
    const cell =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-sudoku-cell]")
        : null;
    if (!cell || !active || resumePrompt) return;
    const index = Number(cell.dataset.sudokuCell);
    if (!Number.isInteger(index)) return;
    selectedIndex = index;
    render();
    grid.focus({ preventScroll: true });
  });

  numberButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = Number(button.dataset.sudokuNumber);
      if (Number.isInteger(value)) enterNumber(value);
      grid.focus({ preventScroll: true });
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.sudokuDifficultyButton;
      if (value === "casual" || value === "standard" || value === "expert") {
        newPuzzle(value);
      }
    });
  });

  resumeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sudokuResume === "continue") continueSession();
      else if (button.dataset.sudokuResume === "new") newPuzzle(difficulty);
    });
  });

  noteButton?.addEventListener("click", toggleNotes);
  undoButton?.addEventListener("click", undo);
  eraseButton?.addEventListener("click", erase);
  newButton?.addEventListener("click", () => newPuzzle());
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener(GAME_EVENTS.sudoku.start, startGame);
  window.addEventListener(GAME_EVENTS.sudoku.command, onCommand);
  window.addEventListener("pagehide", () => {
    if (active && !completed) persistSession();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && active && !completed) {
      persistSession();
    }
  });

  buildGrid();
}
