export const EMPTY = 0 as const;
export const PLAYER_X = 1 as const;
export const PLAYER_O = 2 as const;
export type Cell = typeof EMPTY | typeof PLAYER_X | typeof PLAYER_O;
export type Board = Uint8Array;

export function idx(l: number, r: number, c: number): number {
  return l * 16 + r * 4 + c;
}

export function fromIdx(i: number): [number, number, number] {
  const l = (i >> 4) & 3;
  const r = (i >> 2) & 3;
  const c = i & 3;
  return [l, r, c];
}

function generateWinLines(): number[][] {
  const lines: number[][] = [];

  // Rows (along col axis) in each layer-row
  for (let l = 0; l < 4; l++) for (let r = 0; r < 4; r++) lines.push([idx(l, r, 0), idx(l, r, 1), idx(l, r, 2), idx(l, r, 3)]);

  // Columns (along row axis) in each layer-col
  for (let l = 0; l < 4; l++) for (let c = 0; c < 4; c++) lines.push([idx(l, 0, c), idx(l, 1, c), idx(l, 2, c), idx(l, 3, c)]);

  // Pillars (along layer axis) for each row-col
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) lines.push([idx(0, r, c), idx(1, r, c), idx(2, r, c), idx(3, r, c)]);

  // Diagonals within each layer
  for (let l = 0; l < 4; l++) {
    lines.push([idx(l, 0, 0), idx(l, 1, 1), idx(l, 2, 2), idx(l, 3, 3)]);
    lines.push([idx(l, 0, 3), idx(l, 1, 2), idx(l, 2, 1), idx(l, 3, 0)]);
  }

  // Diagonals in each row plane (layer-col)
  for (let r = 0; r < 4; r++) {
    lines.push([idx(0, r, 0), idx(1, r, 1), idx(2, r, 2), idx(3, r, 3)]);
    lines.push([idx(0, r, 3), idx(1, r, 2), idx(2, r, 1), idx(3, r, 0)]);
  }

  // Diagonals in each col plane (layer-row)
  for (let c = 0; c < 4; c++) {
    lines.push([idx(0, 0, c), idx(1, 1, c), idx(2, 2, c), idx(3, 3, c)]);
    lines.push([idx(0, 3, c), idx(1, 2, c), idx(2, 1, c), idx(3, 0, c)]);
  }

  // Space diagonals
  lines.push([idx(0, 0, 0), idx(1, 1, 1), idx(2, 2, 2), idx(3, 3, 3)]);
  lines.push([idx(0, 0, 3), idx(1, 1, 2), idx(2, 2, 1), idx(3, 3, 0)]);
  lines.push([idx(0, 3, 0), idx(1, 2, 1), idx(2, 1, 2), idx(3, 0, 3)]);
  lines.push([idx(0, 3, 3), idx(1, 2, 2), idx(2, 1, 1), idx(3, 0, 0)]);

  return lines;
}

export const WIN_LINES = generateWinLines();

function computeCellLines(): number[][] {
  const cellLines: number[][] = Array.from({ length: 64 }, () => []);
  for (let i = 0; i < WIN_LINES.length; i++) {
    for (const cell of WIN_LINES[i]) {
      cellLines[cell].push(i);
    }
  }
  return cellLines;
}

export const CELL_LINES = computeCellLines();

export function createBoard(): Board {
  return new Uint8Array(64);
}

export function getValidMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === EMPTY) moves.push(i);
  }
  return moves;
}

export function makeMove(board: Board, pos: number, player: Cell): Board {
  const nb = new Uint8Array(board);
  nb[pos] = player;
  return nb;
}

export function checkWin(board: Board): { winner: Cell; line: number[] | null } {
  for (const line of WIN_LINES) {
    const first = board[line[0]];
    if (first !== EMPTY && board[line[1]] === first && board[line[2]] === first && board[line[3]] === first) {
      return { winner: first as Cell, line };
    }
  }
  return { winner: EMPTY, line: null };
}

export function isFull(board: Board): boolean {
  for (let i = 0; i < 64; i++) {
    if (board[i] === EMPTY) return false;
  }
  return true;
}
