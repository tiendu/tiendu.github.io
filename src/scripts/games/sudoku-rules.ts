export const SUDOKU_SIZE = 9;
export const SUDOKU_CELL_COUNT = SUDOKU_SIZE * SUDOKU_SIZE;
const ALL_DIGITS_MASK = 0b1111111110;

function boxIndex(row: number, column: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(column / 3);
}

function bitCount(value: number): number {
  let count = 0;
  let current = value;
  while (current !== 0) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

export function countSolutions(input: readonly number[], limit = 2): number {
  if (input.length !== SUDOKU_CELL_COUNT || limit <= 0) return 0;

  const board = [...input];
  const rowMasks = Array<number>(SUDOKU_SIZE).fill(0);
  const columnMasks = Array<number>(SUDOKU_SIZE).fill(0);
  const boxMasks = Array<number>(SUDOKU_SIZE).fill(0);

  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    const value = board[index] ?? 0;
    if (value === 0) continue;
    if (!Number.isInteger(value) || value < 1 || value > 9) return 0;

    const row = Math.floor(index / SUDOKU_SIZE);
    const column = index % SUDOKU_SIZE;
    const box = boxIndex(row, column);
    const bit = 1 << value;
    if ((rowMasks[row]! & bit) || (columnMasks[column]! & bit) || (boxMasks[box]! & bit)) {
      return 0;
    }
    rowMasks[row]! |= bit;
    columnMasks[column]! |= bit;
    boxMasks[box]! |= bit;
  }

  let solutions = 0;

  const search = (): void => {
    if (solutions >= limit) return;

    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
      if (board[index] !== 0) continue;
      const row = Math.floor(index / SUDOKU_SIZE);
      const column = index % SUDOKU_SIZE;
      const box = boxIndex(row, column);
      const mask = ALL_DIGITS_MASK & ~(rowMasks[row]! | columnMasks[column]! | boxMasks[box]!);
      const candidates = bitCount(mask);
      if (candidates === 0) return;
      if (candidates < bestCount) {
        bestIndex = index;
        bestMask = mask;
        bestCount = candidates;
        if (candidates === 1) break;
      }
    }

    if (bestIndex === -1) {
      solutions += 1;
      return;
    }

    const row = Math.floor(bestIndex / SUDOKU_SIZE);
    const column = bestIndex % SUDOKU_SIZE;
    const box = boxIndex(row, column);

    let candidates = bestMask;
    while (candidates !== 0 && solutions < limit) {
      const bit = candidates & -candidates;
      candidates ^= bit;
      const value = Math.log2(bit);

      board[bestIndex] = value;
      rowMasks[row]! |= bit;
      columnMasks[column]! |= bit;
      boxMasks[box]! |= bit;

      search();

      board[bestIndex] = 0;
      rowMasks[row]! ^= bit;
      columnMasks[column]! ^= bit;
      boxMasks[box]! ^= bit;
    }
  };

  search();
  return solutions;
}

export function conflictIndexes(board: readonly number[]): Set<number> {
  const conflicts = new Set<number>();
  if (board.length !== SUDOKU_CELL_COUNT) return conflicts;

  const markDuplicates = (indexes: readonly number[]): void => {
    const seen = new Map<number, number>();
    for (const index of indexes) {
      const value = board[index] ?? 0;
      if (value === 0) continue;
      const previous = seen.get(value);
      if (previous === undefined) seen.set(value, index);
      else {
        conflicts.add(previous);
        conflicts.add(index);
      }
    }
  };

  for (let row = 0; row < SUDOKU_SIZE; row += 1) {
    markDuplicates(Array.from({ length: SUDOKU_SIZE }, (_, column) => row * SUDOKU_SIZE + column));
  }
  for (let column = 0; column < SUDOKU_SIZE; column += 1) {
    markDuplicates(Array.from({ length: SUDOKU_SIZE }, (_, row) => row * SUDOKU_SIZE + column));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const indexes: number[] = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          indexes.push((boxRow * 3 + row) * SUDOKU_SIZE + boxColumn * 3 + column);
        }
      }
      markDuplicates(indexes);
    }
  }

  return conflicts;
}

export function peerIndexes(index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= SUDOKU_CELL_COUNT) return [];
  const row = Math.floor(index / SUDOKU_SIZE);
  const column = index % SUDOKU_SIZE;
  const peers = new Set<number>();

  for (let offset = 0; offset < SUDOKU_SIZE; offset += 1) {
    peers.add(row * SUDOKU_SIZE + offset);
    peers.add(offset * SUDOKU_SIZE + column);
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      peers.add((boxRow + rowOffset) * SUDOKU_SIZE + boxColumn + columnOffset);
    }
  }

  peers.delete(index);
  return [...peers];
}

export function isSolved(board: readonly number[], solution: readonly number[]): boolean {
  return (
    board.length === SUDOKU_CELL_COUNT &&
    solution.length === SUDOKU_CELL_COUNT &&
    board.every((value, index) => value === solution[index])
  );
}
