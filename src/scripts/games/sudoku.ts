import { generateSudokuPuzzle, type SudokuDifficulty } from "./sudoku-generator";
import { conflictIndexes, isSolved, peerIndexes, SUDOKU_CELL_COUNT } from "./sudoku-rules";
import {
  dispatchGameExit,
  dispatchGameStatus,
  GAME_EVENTS,
  readGameCommand,
} from "./shared/events";
import { mountAllGames } from "./shared/mount";

interface HistoryEntry {
  board: number[];
  notes: number[][];
}

const DIFFICULTY_LABELS: Record<SudokuDifficulty, string> = {
  casual: "CASUAL",
  standard: "STANDARD",
  expert: "EXPERT",
};

export function mountSudokuGames(): void {
  mountAllGames("[data-sudoku-game]", "sudokuInitialized", mountSudokuGame);
}

function mountSudokuGame(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("[data-sudoku-grid]");
  const difficultyOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-difficulty]");
  const timerOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-timer]");
  const blanksOutput = root.querySelector<HTMLOutputElement>("[data-sudoku-blanks]");
  const message = root.querySelector<HTMLElement>("[data-sudoku-message]");
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

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const currentElapsed = (): number =>
    completed || !startedAt ? elapsedMs : elapsedMs + performance.now() - startedAt;

  const updateTimer = (): void => {
    if (timerOutput) timerOutput.textContent = formatTime(currentElapsed());
  };

  const startTimer = (): void => {
    if (timerId !== null) window.clearInterval(timerId);
    startedAt = performance.now();
    elapsedMs = 0;
    updateTimer();
    timerId = window.setInterval(updateTimer, 250);
  };

  const stopTimer = (): void => {
    if (!completed && startedAt) elapsedMs += performance.now() - startedAt;
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
    if (undoButton) undoButton.disabled = history.length === 0 || completed;
    if (eraseButton) eraseButton.disabled = completed || isGiven(selectedIndex);
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

  const newPuzzle = (nextDifficulty = difficulty): void => {
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
    startTimer();
    render();
    grid.focus({ preventScroll: true });
  };

  const checkCompletion = (): void => {
    if (!isSolved(board, solution)) return;
    completed = true;
    stopTimer();
    render();
  };

  const enterNumber = (value: number): void => {
    if (completed || isGiven(selectedIndex) || value < 1 || value > 9) return;
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
  };

  const erase = (): void => {
    if (completed || isGiven(selectedIndex)) return;
    const cellNotes = notes[selectedIndex]!;
    if ((board[selectedIndex] ?? 0) === 0 && cellNotes.size === 0) return;
    snapshot();
    board[selectedIndex] = 0;
    cellNotes.clear();
    render();
  };

  const undo = (): void => {
    if (completed) return;
    const entry = history.pop();
    if (!entry) return;
    restoreSnapshot(entry);
    render();
  };

  const toggleNotes = (): void => {
    if (completed) return;
    notesMode = !notesMode;
    render();
  };

  const moveSelection = (rowDelta: number, columnDelta: number): void => {
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
    active = false;
    root.hidden = true;
    dispatchGameExit(GAME_EVENTS.sudoku.exit, { score: 0, highScore: 0 });
  };

  const startGame = (): void => {
    active = true;
    root.hidden = false;
    buildGrid();
    newPuzzle("standard");
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
    const cell = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sudoku-cell]") : null;
    if (!cell || !active) return;
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

  noteButton?.addEventListener("click", toggleNotes);
  undoButton?.addEventListener("click", undo);
  eraseButton?.addEventListener("click", erase);
  newButton?.addEventListener("click", () => newPuzzle());
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener(GAME_EVENTS.sudoku.start, startGame);
  window.addEventListener(GAME_EVENTS.sudoku.command, onCommand);

  buildGrid();
}
