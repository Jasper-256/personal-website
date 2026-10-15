// Kalah-style board, as in GamePigeon's capture mode:
//   0-5   side 0 pits (left to right from side 0's view)
//   6     side 0 store
//   7-12  side 1 pits
//   13    side 1 store
// Sowing runs counterclockwise (increasing index) and skips the opponent's store.

export const PITS = 6;
export const SIZE = 14;
export const STONES_PER_PIT = 4;
export const TOTAL_STONES = PITS * 2 * STONES_PER_PIT;

export type Side = 0 | 1;
export type Board = number[];

export const storeOf = (s: Side): number => s * 7 + 6;
export const pitOf = (s: Side, i: number): number => s * 7 + i;
export const opposite = (p: number): number => 12 - p;
export const ownerOf = (p: number): Side => (p < 7 ? 0 : 1);
export const isStore = (p: number): boolean => p === 6 || p === 13;

export function createBoard(): Board {
  const b = new Array<number>(SIZE).fill(STONES_PER_PIT);
  b[6] = 0;
  b[13] = 0;
  return b;
}

export function sideCount(b: ArrayLike<number>, s: Side): number {
  let n = 0;
  for (let i = 0; i < PITS; i++) n += b[s * 7 + i];
  return n;
}

export function legalMoves(b: ArrayLike<number>, s: Side): number[] {
  const moves: number[] = [];
  for (let i = 0; i < PITS; i++) if (b[s * 7 + i] > 0) moves.push(i);
  return moves;
}

export interface MoveResult {
  // Pit index that each sown stone lands in, in order.
  drops: number[];
  // Last stone landed in an empty pit on the mover's side across from a non-empty pit.
  capture: { pit: number; opposite: number } | null;
  extraTurn: boolean;
  gameOver: boolean;
  next: Side;
}

// Plays pit `i` (0-5) for side `s`, mutating `b`. When either side runs out of
// stones, the game ends and each player keeps the stones left on their side.
export function playMove(b: Board, s: Side, i: number): MoveResult {
  const src = pitOf(s, i);
  const skip = storeOf((1 - s) as Side);
  const myStore = storeOf(s);
  let n = b[src];
  b[src] = 0;
  let pos = src;
  const drops: number[] = [];
  while (n > 0) {
    pos = (pos + 1) % SIZE;
    if (pos === skip) continue;
    b[pos]++;
    drops.push(pos);
    n--;
  }

  let capture: MoveResult["capture"] = null;
  const extraTurn = pos === myStore;
  if (!extraTurn && ownerOf(pos) === s && b[pos] === 1 && b[opposite(pos)] > 0) {
    const opp = opposite(pos);
    capture = { pit: pos, opposite: opp };
    b[myStore] += b[opp] + 1;
    b[pos] = 0;
    b[opp] = 0;
  }

  const left0 = sideCount(b, 0);
  const left1 = sideCount(b, 1);
  const gameOver = left0 === 0 || left1 === 0;
  if (gameOver) {
    b[6] += left0;
    b[13] += left1;
    for (let k = 0; k < PITS; k++) {
      b[k] = 0;
      b[7 + k] = 0;
    }
  }

  return { drops, capture, extraTurn, gameOver, next: extraTurn ? s : ((1 - s) as Side) };
}
