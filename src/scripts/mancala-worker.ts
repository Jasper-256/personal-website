import { findBestMove, resetAi } from "./mancala-ai";

self.onmessage = (e: MessageEvent<{ reset: true } | { board: number[]; side: number; time: number; gen: number }>) => {
  if ("reset" in e.data) {
    resetAi();
    return;
  }
  const { board, side, time, gen } = e.data;
  const result = findBestMove(board, side, time);
  self.postMessage({ move: result.move, gen });
};
