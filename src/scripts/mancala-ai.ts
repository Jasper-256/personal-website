import { SIZE, TOTAL_STONES } from "./mancala-board";

// Iterative-deepening negamax with alpha-beta and a transposition table.
// Scores are (my store - their store) from the side to move's point of view, which
// is also the exact final margin at game end, so deep searches transition smoothly
// into an exact endgame solver. Entries whose subtree never hit a heuristic leaf are
// marked SOLVED and reused at any depth.

const MAX_PLY = 160;
const MAX_DEPTH = 150;
const SOLVED = 255;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

const TT_BITS = 21;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE);
const ttScore = new Int8Array(TT_SIZE);
const ttDepth = new Uint8Array(TT_SIZE);
const ttFlag = new Uint8Array(TT_SIZE);
const ttMove = new Int8Array(TT_SIZE);

const ZN = TOTAL_STONES + 1;
const zLo = new Int32Array(SIZE * ZN);
const zHi = new Int32Array(SIZE * ZN);
let seed = 0x9e3779b9;
function rand32(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
}
for (let i = 0; i < zLo.length; i++) {
  zLo[i] = rand32();
  zHi[i] = rand32();
}
const SIDE_LO = rand32();
const SIDE_HI = rand32();

const boards: Int8Array[] = Array.from({ length: MAX_PLY + 1 }, () => new Int8Array(SIZE));
const moveBuf = new Int8Array((MAX_PLY + 1) * 6);
const keyBuf = new Int32Array(6);

let nodes = 0;
let deadline = 0;
// Counts heuristic leaves; a subtree that leaves it unchanged was solved exactly.
let heuristic = 0;
const ABORT = new Error("abort");

// Applies a move in place. Returns 0 if the turn passes, 1 for an extra turn, 2 if the game ended.
function apply(c: Int8Array, side: number, i: number): number {
  const base = side * 7;
  const my = base + 6;
  const skip = side === 0 ? 13 : 6;
  const src = base + i;
  let n = c[src];
  c[src] = 0;
  let pos = src;
  while (n > 0) {
    pos++;
    if (pos === 14) pos = 0;
    if (pos === skip) continue;
    c[pos]++;
    n--;
  }
  if (pos !== my && pos >= base && pos < my && c[pos] === 1) {
    const o = 12 - pos;
    if (c[o] > 0) {
      c[my] += c[o] + 1;
      c[pos] = 0;
      c[o] = 0;
    }
  }
  let s0 = 0;
  let s1 = 0;
  for (let k = 0; k < 6; k++) {
    s0 += c[k];
    s1 += c[7 + k];
  }
  if (s0 === 0 || s1 === 0) {
    c[6] += s0;
    c[13] += s1;
    for (let k = 0; k < 6; k++) {
      c[k] = 0;
      c[7 + k] = 0;
    }
    return 2;
  }
  return pos === my ? 1 : 0;
}

// Fills moveBuf for this ply in search order and returns the move count.
function orderMoves(b: Int8Array, side: number, ply: number, ttm: number): number {
  const base = side * 7;
  const off = ply * 6;
  let count = 0;
  for (let i = 5; i >= 0; i--) {
    const n = b[base + i];
    if (n === 0) continue;
    let key: number;
    if (i === ttm) key = 10000;
    else if (n % 13 === 6 - i) key = 1000 + i;
    else {
      key = i;
      if (n < 13) {
        const land = i + n;
        if (land < 6 && b[base + land] === 0) {
          const o = 12 - (base + land);
          if (b[o] > 0) key = 100 + b[o];
        }
      } else if (n === 13) {
        key = 100 + b[12 - (base + i)] + 1;
      }
    }
    // Insertion sort, descending by key.
    let j = count;
    while (j > 0 && keyBuf[j - 1] < key) {
      keyBuf[j] = keyBuf[j - 1];
      moveBuf[off + j] = moveBuf[off + j - 1];
      j--;
    }
    keyBuf[j] = key;
    moveBuf[off + j] = i;
    count++;
  }
  return count;
}

function negamax(ply: number, side: number, depth: number, alpha: number, beta: number): number {
  if ((++nodes & 8191) === 0 && performance.now() > deadline) throw ABORT;
  const b = boards[ply];
  const my = side * 7 + 6;
  const op = side === 0 ? 13 : 6;
  const myS = b[my];
  const opS = b[op];

  // Stores only grow, so the final margin is already bounded.
  const lo = 2 * myS - TOTAL_STONES;
  const hi = TOTAL_STONES - 2 * opS;
  if (lo >= beta) return lo;
  if (hi <= alpha) return hi;

  if (depth === 0 || ply === MAX_PLY) {
    heuristic++;
    return myS - opS;
  }

  let hLo = side === 0 ? 0 : SIDE_LO;
  let hHi = side === 0 ? 0 : SIDE_HI;
  for (let k = 0; k < 14; k++) {
    const z = k * ZN + b[k];
    hLo ^= zLo[z];
    hHi ^= zHi[z];
  }
  const idx = hLo & TT_MASK;
  let ttm = -1;
  if (ttFlag[idx] !== 0 && ttKey[idx] === hHi) {
    ttm = ttMove[idx];
    const d = ttDepth[idx];
    if (d === SOLVED || d >= depth) {
      const s = ttScore[idx];
      const f = ttFlag[idx];
      if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) {
        if (d !== SOLVED) heuristic++;
        return s;
      }
    }
  }

  const before = heuristic;
  const alphaOrig = alpha;
  const count = orderMoves(b, side, ply, ttm);
  const off = ply * 6;
  const c = boards[ply + 1];
  let best = -128;
  let bestMove = -1;
  for (let m = 0; m < count; m++) {
    const i = moveBuf[off + m];
    c.set(b);
    const r = apply(c, side, i);
    let v: number;
    if (r === 2) v = c[my] - c[op];
    else if (r === 1) v = negamax(ply + 1, side, depth - 1, alpha, beta);
    else v = -negamax(ply + 1, side ^ 1, depth - 1, -beta, -alpha);
    if (v > best) {
      best = v;
      bestMove = i;
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) break;
      }
    }
  }

  const storeDepth = heuristic === before ? SOLVED : depth;
  if (ttFlag[idx] === 0 || ttKey[idx] !== hHi || ttDepth[idx] <= storeDepth) {
    ttKey[idx] = hHi;
    ttScore[idx] = best;
    ttDepth[idx] = storeDepth;
    ttFlag[idx] = best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT;
    ttMove[idx] = bestMove;
  }
  return best;
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
  solved: boolean;
}

export function resetAi(): void {
  ttFlag.fill(0);
}

// Finds the best pit (0-5) for `side` within roughly `timeMs`.
export function findBestMove(board: ArrayLike<number>, side: number, timeMs: number, maxDepth = MAX_DEPTH): SearchResult {
  const start = performance.now();
  deadline = start + timeMs;
  nodes = 0;
  const root = boards[0];
  for (let k = 0; k < SIZE; k++) root[k] = board[k];
  const my = side * 7 + 6;
  const op = side === 0 ? 13 : 6;

  const legal: number[] = [];
  for (let i = 0; i < 6; i++) if (root[side * 7 + i] > 0) legal.push(i);
  const result: SearchResult = { move: legal[0] ?? -1, score: 0, depth: 0, nodes: 0, solved: false };
  if (legal.length <= 1) return result;

  let prevBest = -1;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const before = heuristic;
    const count = orderMoves(root, side, 0, prevBest);
    const c = boards[1];
    let best = -128;
    let bestMove = -1;
    let alpha = -128;
    try {
      for (let m = 0; m < count; m++) {
        const i = moveBuf[m];
        c.set(root);
        const r = apply(c, side, i);
        let v: number;
        if (r === 2) v = c[my] - c[op];
        else if (r === 1) v = negamax(1, side, depth - 1, alpha, 128);
        else v = -negamax(1, side ^ 1, depth - 1, -128, -alpha);
        if (v > best) {
          best = v;
          bestMove = i;
          if (v > alpha) alpha = v;
        }
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      // The previous best is searched first, so anything that beat it at this depth is trustworthy.
      if (bestMove >= 0 && bestMove !== prevBest) {
        result.move = bestMove;
        result.score = best;
      }
      break;
    }
    prevBest = bestMove;
    result.move = bestMove;
    result.score = best;
    result.depth = depth;
    if (heuristic === before) {
      result.solved = true;
      break;
    }
    if (performance.now() > deadline) break;
  }
  result.nodes = nodes;
  return result;
}
