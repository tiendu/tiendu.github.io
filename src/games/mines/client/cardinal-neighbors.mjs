// Neighbors are ordered top, left, right, bottom for stable BFS routes.
export function cardinalNeighbors(cell, size) {
  const row = Math.floor(cell / size);
  const col = cell % size;
  return [
    ...(row > 0 ? [cell - size] : []),
    ...(col > 0 ? [cell - 1] : []),
    ...(col + 1 < size ? [cell + 1] : []),
    ...(row + 1 < size ? [cell + size] : []),
  ];
}
