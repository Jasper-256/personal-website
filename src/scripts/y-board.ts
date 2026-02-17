export type Cell = 0 | 1 | 2;
export const EMPTY: Cell = 0;
export const P1: Cell = 1;
export const P2: Cell = 2;

export function totalCells(n: number): number {
  return (n * (n + 1)) / 2;
}

export function idx(r: number, c: number): number {
  return (r * (r + 1)) / 2 + c;
}

export function fromIdx(i: number): [number, number] {
  let r = 0;
  while (((r + 1) * (r + 2)) / 2 <= i) r++;
  return [r, i - (r * (r + 1)) / 2];
}

export function getNeighbors(r: number, c: number, n: number): [number, number][] {
  const nb: [number, number][] = [];
  if (r > 0 && c > 0) nb.push([r - 1, c - 1]);
  if (r > 0 && c < r) nb.push([r - 1, c]);
  if (c > 0) nb.push([r, c - 1]);
  if (c < r) nb.push([r, c + 1]);
  if (r < n - 1) nb.push([r + 1, c]);
  if (r < n - 1) nb.push([r + 1, c + 1]);
  return nb;
}

/** Side 0 = left, Side 1 = right, Side 2 = bottom */
export function cellSides(r: number, c: number, n: number): number[] {
  const sides: number[] = [];
  if (c === 0) sides.push(0);
  if (c === r) sides.push(1);
  if (r === n - 1) sides.push(2);
  return sides;
}

/** Returns the winning connected group, or null */
export function findWinGroup(board: Cell[], player: Cell, n: number): number[] | null {
  const total = totalCells(n);
  const visited = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    if (board[i] !== player || visited[i]) continue;
    const group: number[] = [];
    const sides = new Set<number>();
    const stack = [i];
    visited[i] = 1;

    while (stack.length > 0) {
      const cur = stack.pop()!;
      group.push(cur);
      const [r, c] = fromIdx(cur);
      for (const s of cellSides(r, c, n)) sides.add(s);
      for (const [nr, nc] of getNeighbors(r, c, n)) {
        const ni = idx(nr, nc);
        if (!visited[ni] && board[ni] === player) {
          visited[ni] = 1;
          stack.push(ni);
        }
      }
    }

    if (sides.size === 3) return group;
  }
  return null;
}

export function isFull(board: Cell[], n: number): boolean {
  const total = totalCells(n);
  for (let i = 0; i < total; i++) {
    if (board[i] === EMPTY) return false;
  }
  return true;
}
