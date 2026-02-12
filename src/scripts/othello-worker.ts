import { type Board, type Cell, type Pos, BLACK, WHITE, WEIGHTS, getValidMoves, makeMove, countPieces } from "./othello-board";

function evaluate(b: Board, aiCol: Cell): number {
  const opp: Cell = aiCol === BLACK ? WHITE : BLACK;
  let positional = 0;
  let aiCount = 0;
  let oppCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === aiCol) {
        positional += WEIGHTS[r][c];
        aiCount++;
      } else if (b[r][c] === opp) {
        positional -= WEIGHTS[r][c];
        oppCount++;
      }
    }
  }

  const totalPieces = aiCount + oppCount;
  const aiMoves = getValidMoves(b, aiCol).length;
  const oppMoves = getValidMoves(b, opp).length;
  const mobility = aiMoves - oppMoves;

  let corners = 0;
  const cornerPos: Pos[] = [
    [0, 0],
    [0, 7],
    [7, 0],
    [7, 7],
  ];
  for (const [r, c] of cornerPos) {
    if (b[r][c] === aiCol) corners++;
    else if (b[r][c] === opp) corners--;
  }

  const phase = totalPieces / 64;
  return positional * (1 - phase * 0.5) + mobility * 10 * (1 - phase) * 2 + corners * 25 + (aiCount - oppCount) * phase * 2;
}

function finalScore(b: Board, aiCol: Cell): number {
  const counts = countPieces(b);
  const ai = aiCol === BLACK ? counts.black : counts.white;
  const opp = aiCol === BLACK ? counts.white : counts.black;
  if (ai > opp) return 10000 + (ai - opp);
  if (ai < opp) return -10000 - (opp - ai);
  return 0;
}

function orderMoves(moves: Pos[]): Pos[] {
  const corners: Pos[] = [];
  const edges: Pos[] = [];
  const other: Pos[] = [];
  for (const [r, c] of moves) {
    if ((r === 0 || r === 7) && (c === 0 || c === 7)) corners.push([r, c]);
    else if (r === 0 || r === 7 || c === 0 || c === 7) edges.push([r, c]);
    else other.push([r, c]);
  }
  return [...corners, ...edges, ...other];
}

function minimax(b: Board, d: number, alpha: number, beta: number, current: Cell, aiCol: Cell, passed: boolean): number {
  const moves = getValidMoves(b, current);
  const opp: Cell = current === BLACK ? WHITE : BLACK;

  if (d === 0) return evaluate(b, aiCol);

  if (moves.length === 0) {
    if (passed) return finalScore(b, aiCol);
    return minimax(b, d, alpha, beta, opp, aiCol, true);
  }

  const ordered = orderMoves(moves);

  if (current === aiCol) {
    let maxEval = -Infinity;
    for (const [r, c] of ordered) {
      const nb = makeMove(b, r, c, current);
      const ev = minimax(nb, d - 1, alpha, beta, opp, aiCol, false);
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const [r, c] of ordered) {
      const nb = makeMove(b, r, c, current);
      const ev = minimax(nb, d - 1, alpha, beta, opp, aiCol, false);
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

self.onmessage = (e: MessageEvent<{ board: Board; aiColor: Cell; depth: number }>) => {
  const { board, aiColor, depth } = e.data;
  let moves = getValidMoves(board, aiColor);
  if (moves.length === 0) {
    self.postMessage({ move: null });
    return;
  }

  moves = orderMoves(moves);
  let bestScore = -Infinity;
  let bestMove = moves[0];
  const opp: Cell = aiColor === BLACK ? WHITE : BLACK;

  for (const [r, c] of moves) {
    const nb = makeMove(board, r, c, aiColor);
    const score = minimax(nb, depth - 1, -Infinity, Infinity, opp, aiColor, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  self.postMessage({ move: bestMove });
};
