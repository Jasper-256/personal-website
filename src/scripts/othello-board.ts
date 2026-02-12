export const EMPTY = 0 as const;
export const BLACK = 1 as const;
export const WHITE = 2 as const;
export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Board = Cell[][];
export type Pos = [number, number];

export const SIZE = 8;
export const CELL = 60;
export const BOARD_PX = CELL * SIZE;

export const DIRS: Pos[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export const WEIGHTS: number[][] = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, -1, -1, 1, -2, 10],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [10, -2, 1, -1, -1, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

export function createBoard(): Board {
  const b: Board = [];
  for (let r = 0; r < SIZE; r++) {
    b[r] = [];
    for (let c = 0; c < SIZE; c++) {
      b[r][c] = EMPTY;
    }
  }
  b[3][3] = WHITE;
  b[3][4] = BLACK;
  b[4][3] = BLACK;
  b[4][4] = WHITE;
  return b;
}

export function copyBoard(b: Board): Board {
  return b.map((row) => row.slice()) as Board;
}

export function getFlips(b: Board, row: number, col: number, player: Cell): Pos[] {
  if (b[row][col] !== EMPTY) return [];
  const opp: Cell = player === BLACK ? WHITE : BLACK;
  const allFlips: Pos[] = [];
  for (const [dr, dc] of DIRS) {
    const flips: Pos[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && b[r][c] === opp) {
      flips.push([r, c]);
      r += dr;
      c += dc;
    }
    if (flips.length > 0 && r >= 0 && r < SIZE && c >= 0 && c < SIZE && b[r][c] === player) {
      allFlips.push(...flips);
    }
  }
  return allFlips;
}

export function getValidMoves(b: Board, player: Cell): Pos[] {
  const moves: Pos[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getFlips(b, r, c, player).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

export function makeMove(b: Board, row: number, col: number, player: Cell): Board {
  const nb = copyBoard(b);
  const flips = getFlips(b, row, col, player);
  nb[row][col] = player;
  for (const [r, c] of flips) {
    nb[r][c] = player;
  }
  return nb;
}

export function countPieces(b: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === BLACK) black++;
      else if (b[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}
