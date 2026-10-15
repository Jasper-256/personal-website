import { findBestMove, resetAi } from "./mancala-ai";

// depth 0 searches as deep as the time allows; otherwise the search stops at `depth`.
self.onmessage = (e: MessageEvent<{ reset: true } | { board: number[]; side: number; time: number; depth: number; gen: number }>) => {
  if ("reset" in e.data) {
    resetAi();
    return;
  }
  const { board, side, time, depth, gen } = e.data;
  // Depth-limited levels start fresh so they can't lean on deeper results left in the
  // transposition table by earlier moves or a harder level chosen mid-game.
  if (depth > 0) resetAi();
  const result = depth > 0 ? findBestMove(board, side, time, depth) : findBestMove(board, side, time);
  self.postMessage({ move: result.move, gen });
};
