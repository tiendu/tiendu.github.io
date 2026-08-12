import { countSolutions, SUDOKU_CELL_COUNT } from "./sudoku-rules";

export type SudokuDifficulty = "casual" | "standard" | "expert";

export interface SudokuPuzzle {
  difficulty: SudokuDifficulty;
  puzzle: number[];
  solution: number[];
  blanks: number;
}

export const SUDOKU_DIFFICULTY_RANGES: Record<SudokuDifficulty, readonly [number, number]> = {
  casual: [38, 41],
  standard: [44, 47],
  expert: [50, 53],
};

function shuffle<T>(input: readonly T[]): T[] {
  const values = [...input];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex]!, values[index]!];
  }
  return values;
}

function shuffledGroups(): number[] {
  return shuffle([0, 1, 2]).flatMap((group) =>
    shuffle([0, 1, 2]).map((offset) => group * 3 + offset),
  );
}

export function generateSolvedBoard(): number[] {
  const rows = shuffledGroups();
  const columns = shuffledGroups();
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const pattern = (row: number, column: number): number =>
    (row * 3 + Math.floor(row / 3) + column) % 9;

  return rows.flatMap((row) =>
    columns.map((column) => digits[pattern(row, column)]!),
  );
}

function randomTarget([minimum, maximum]: readonly [number, number]): number {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function carve(solution: readonly number[], targetBlanks: number): number[] {
  const puzzle = [...solution];
  let blanks = 0;

  for (const index of shuffle(Array.from({ length: SUDOKU_CELL_COUNT }, (_, value) => value))) {
    if (blanks >= targetBlanks) break;
    const previous = puzzle[index]!;
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) === 1) blanks += 1;
    else puzzle[index] = previous;
  }

  return puzzle;
}

export function generateSudokuPuzzle(difficulty: SudokuDifficulty): SudokuPuzzle {
  const range = SUDOKU_DIFFICULTY_RANGES[difficulty];
  const target = randomTarget(range);
  let bestPuzzle: number[] | null = null;
  let bestSolution: number[] | null = null;
  let bestBlanks = -1;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const solution = generateSolvedBoard();
    const puzzle = carve(solution, target);
    const blanks = puzzle.filter((value) => value === 0).length;

    if (blanks > bestBlanks) {
      bestPuzzle = puzzle;
      bestSolution = solution;
      bestBlanks = blanks;
    }
    if (blanks >= target) {
      return { difficulty, puzzle, solution, blanks };
    }
  }

  if (!bestPuzzle || !bestSolution) {
    throw new Error("Sudoku generation failed");
  }
  return { difficulty, puzzle: bestPuzzle, solution: bestSolution, blanks: bestBlanks };
}
