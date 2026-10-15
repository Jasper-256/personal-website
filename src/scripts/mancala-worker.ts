import { findBestMove, resetAi } from "./mancala-ai";
import { OpeningBook } from "./mancala-book";

// Max plays proven-optimal book moves in the opening; easier levels stay purely depth limited.
let book: OpeningBook | null = null;
const bookLoad: Promise<void> = fetch("/mancala-book.bin")
  .then((r) => (r.ok ? r.arrayBuffer() : null))
  .then((buf) => {
    if (buf) book = new OpeningBook(buf);
  })
  .catch(() => {});

function bookMove(board: number[], side: number): number {
  if (!book) return -1;
  // The book is keyed from the mover's point of view.
  return book.lookup(side === 0 ? board : [...board.slice(7), ...board.slice(0, 7)]);
}

// depth 0 searches as deep as the time allows; otherwise the search stops at `depth`.
self.onmessage = async (e: MessageEvent<{ reset: true } | { board: number[]; side: number; time: number; depth: number; gen: number }>) => {
  if ("reset" in e.data) {
    resetAi();
    return;
  }
  const { board, side, time, depth, gen } = e.data;
  if (depth === 0) {
    // Don't hold up the first move for long if the book is slow to download.
    if (!book) await Promise.race([bookLoad, new Promise((resolve) => setTimeout(resolve, 1500))]);
    const move = bookMove(board, side);
    if (move >= 0) {
      self.postMessage({ move, gen });
      return;
    }
  }
  // Depth-limited levels start fresh so they can't lean on deeper results left in the
  // transposition table by earlier moves or a harder level chosen mid-game.
  if (depth > 0) resetAi();
  const result = depth > 0 ? findBestMove(board, side, time, depth) : findBestMove(board, side, time);
  self.postMessage({ move: result.move, gen });
};
