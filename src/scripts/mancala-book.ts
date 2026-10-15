// Opening book for the Max setting: a proven-optimal move for every position the AI can
// face in its first turns, generated offline by an exact solver.
//
// Positions are keyed by the 12 pit counts seen from the side to move (indices 0-5 are the
// mover's pits, 7-12 the opponent's); stores don't affect which move is best.
//
// Only positions with at least BOOK_MIN_STONES stones in pits are stored; below that the
// regular search already solves positions exactly within its time budget.
//
// File layout, for N entries sorted by fingerprint:
//   N x uint32  fingerprint (little endian)
//   N x uint16  move (bits 0-2) | 13 extra check bits (bits 3-15)

export const BOOK_MIN_STONES = 21;

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Returns [fingerprint, check bits] for a position with the mover on indices 0-5.
export function bookKey(c: ArrayLike<number>): [number, number] {
  const w0 = c[0] | (c[1] << 6) | (c[2] << 12) | (c[3] << 18);
  const w1 = c[4] | (c[5] << 6) | (c[7] << 12) | (c[8] << 18);
  const w2 = c[9] | (c[10] << 6) | (c[11] << 12) | (c[12] << 18);
  const fp = fmix(w0 ^ fmix(w1 ^ fmix(w2 ^ 0x9e3779b9)));
  const check = fmix(w2 ^ fmix(w1 ^ fmix(w0 ^ 0x7f4a7c15))) & 0x1fff;
  return [fp, check];
}

export class OpeningBook {
  private fps: Uint32Array;
  private info: Uint16Array;

  constructor(buf: ArrayBuffer) {
    const n = buf.byteLength / 6;
    if (!Number.isInteger(n)) throw new Error("bad opening book size");
    this.fps = new Uint32Array(buf, 0, n);
    this.info = new Uint16Array(buf, n * 4, n);
  }

  get size(): number {
    return this.fps.length;
  }

  // Book move (0-5) for the side to move, or -1 if the position isn't in the book.
  lookup(c: ArrayLike<number>): number {
    let stones = 0;
    for (let k = 0; k < 6; k++) stones += c[k] + c[7 + k];
    if (stones < BOOK_MIN_STONES) return -1;
    const [fp, check] = bookKey(c);
    const fps = this.fps;
    let lo = 0;
    let hi = fps.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (fps[mid] < fp) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < fps.length && fps[i] === fp; i++) {
      const info = this.info[i];
      if (info >> 3 !== check) continue;
      const move = info & 7;
      return move < 6 && c[move] > 0 ? move : -1;
    }
    return -1;
  }
}
