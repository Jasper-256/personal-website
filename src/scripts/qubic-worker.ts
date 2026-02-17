import { type Board, type Cell, EMPTY, PLAYER_X, PLAYER_O, WIN_LINES, CELL_LINES, getValidMoves, makeMove, checkWin, isFull } from "./qubic-board";

function evaluate(board: Board, aiPlayer: Cell): number {
  const opp: Cell = aiPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  let score = 0;

  for (const line of WIN_LINES) {
    let ai = 0,
      op = 0;
    for (const cell of line) {
      if (board[cell] === aiPlayer) ai++;
      else if (board[cell] === opp) op++;
    }
    if (ai > 0 && op > 0) continue;
    if (ai === 4) return 100000;
    if (op === 4) return -100000;
    if (ai > 0) score += ai === 3 ? 100 : ai === 2 ? 10 : 1;
    if (op > 0) score -= op === 3 ? 100 : op === 2 ? 10 : 1;
  }

  return score;
}

function orderMoves(moves: number[]): number[] {
  return moves.slice().sort((a, b) => CELL_LINES[b].length - CELL_LINES[a].length);
}

function minimax(board: Board, depth: number, alpha: number, beta: number, isMaximizing: boolean, aiPlayer: Cell): number {
  const result = checkWin(board);
  if (result.winner === aiPlayer) return 100000 + depth;
  if (result.winner !== EMPTY) return -100000 - depth;
  if (isFull(board)) return 0;
  if (depth === 0) return evaluate(board, aiPlayer);

  const opp: Cell = aiPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  const currentPlayer: Cell = isMaximizing ? aiPlayer : opp;
  const moves = orderMoves(getValidMoves(board));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nb = makeMove(board, move, currentPlayer);
      const ev = minimax(nb, depth - 1, alpha, beta, false, aiPlayer);
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nb = makeMove(board, move, currentPlayer);
      const ev = minimax(nb, depth - 1, alpha, beta, true, aiPlayer);
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

self.onmessage = (e: MessageEvent<{ board: Uint8Array; aiPlayer: Cell; depth: number; gen: number }>) => {
  const board = new Uint8Array(e.data.board) as Board;
  const { aiPlayer, depth, gen } = e.data;

  const moves = getValidMoves(board);
  if (moves.length === 0) {
    self.postMessage({ move: -1, gen });
    return;
  }

  // Quick check: can AI win immediately?
  for (const move of moves) {
    if (checkWin(makeMove(board, move, aiPlayer)).winner === aiPlayer) {
      self.postMessage({ move, gen });
      return;
    }
  }

  const ordered = orderMoves(moves);
  const opp: Cell = aiPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  let bestScore = -Infinity;
  let bestMove = ordered[0];

  for (const move of ordered) {
    const nb = makeMove(board, move, aiPlayer);
    const score = minimax(nb, depth - 1, -Infinity, Infinity, false, aiPlayer);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  self.postMessage({ move: bestMove, gen });
};
