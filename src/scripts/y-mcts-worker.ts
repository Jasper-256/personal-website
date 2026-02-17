import { type Cell, EMPTY, P1, P2, totalCells, findWinGroup } from "./y-board";

function getEmptyCells(board: Cell[], n: number): number[] {
  const empty: number[] = [];
  const total = totalCells(n);
  for (let i = 0; i < total; i++) {
    if (board[i] === EMPTY) empty.push(i);
  }
  return empty;
}

/** Fast random playout from current state. Returns the winning player or EMPTY for draw. */
function simulate(board: Cell[], turn: Cell, n: number): Cell {
  const b = board.slice();
  let cur = turn;
  const empty = getEmptyCells(b, n);
  // Fisher-Yates shuffle
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  let ei = 0;
  while (ei < empty.length) {
    const cell = empty[ei++];
    b[cell] = cur;
    if (findWinGroup(b, cur, n)) return cur;
    cur = cur === P1 ? P2 : P1;
  }
  return EMPTY;
}

interface MCTSNode {
  move: number; // the move that led to this node (-1 for root)
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: number[];
  turn: Cell; // whose turn it is to play FROM this node
}

function createNode(move: number, parent: MCTSNode | null, turn: Cell, board: Cell[], n: number): MCTSNode {
  return {
    move,
    parent,
    children: [],
    visits: 0,
    wins: 0,
    untriedMoves: getEmptyCells(board, n),
    turn,
  };
}

function uctValue(node: MCTSNode, parentVisits: number, C: number): number {
  if (node.visits === 0) return Infinity;
  return node.wins / node.visits + C * Math.sqrt(Math.log(parentVisits) / node.visits);
}

function bestChild(node: MCTSNode, C: number): MCTSNode {
  let best = node.children[0];
  let bestVal = -Infinity;
  for (const child of node.children) {
    const val = uctValue(child, node.visits, C);
    if (val > bestVal) {
      bestVal = val;
      best = child;
    }
  }
  return best;
}

function mcts(board: Cell[], turn: Cell, n: number, iterations: number, C: number): number {
  const root = createNode(-1, null, turn, board, n);

  for (let iter = 0; iter < iterations; iter++) {
    let node = root;
    const b = board.slice();

    // Selection: traverse tree using UCT
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = bestChild(node, C);
      b[node.move] = node.turn === P1 ? P2 : P1; // the move was made by the previous turn's player
    }

    // Expansion: expand one untried move
    if (node.untriedMoves.length > 0) {
      const ri = Math.floor(Math.random() * node.untriedMoves.length);
      const move = node.untriedMoves[ri];
      node.untriedMoves[ri] = node.untriedMoves[node.untriedMoves.length - 1];
      node.untriedMoves.pop();

      b[move] = node.turn;
      const nextTurn = node.turn === P1 ? P2 : P1;
      const child = createNode(move, node, nextTurn, b, n);
      node.children.push(child);
      node = child;
    }

    // Simulation
    const simTurn = node.turn;
    const winner = findWinGroup(b, simTurn === P1 ? P2 : P1, n) ? (simTurn === P1 ? P2 : P1) : simulate(b, simTurn, n);

    // Backpropagation: each node's wins are from the perspective of the
    // player who moved to reach it (opposite of node.turn), so UCT at each
    // level maximises the moving player's outcome.
    while (node !== null) {
      node.visits++;
      const movedPlayer: Cell = node.turn === P1 ? P2 : P1;
      if (winner === movedPlayer) node.wins++;
      else if (winner === EMPTY) node.wins += 0.5;
      node = node.parent!;
    }
  }

  // Pick the child with the most visits
  let bestMove = -1;
  let mostVisits = -1;
  for (const child of root.children) {
    if (child.visits > mostVisits) {
      mostVisits = child.visits;
      bestMove = child.move;
    }
  }
  return bestMove;
}

self.onmessage = (e: MessageEvent<{ board: Cell[]; turn: Cell; n: number; iterations: number; C: number }>) => {
  const { board, turn, n, iterations, C } = e.data;
  const move = mcts(board, turn, n, iterations, C);
  self.postMessage({ move });
};
