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

function runIterations(root: MCTSNode, board: Cell[], n: number, iterations: number, C: number) {
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
}

function pickBestMove(root: MCTSNode): number {
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

// Persistent state for tree reuse across turns
let prevRoot: MCTSNode | null = null;
let prevBoard: Cell[] | null = null;

/**
 * Try to reuse the tree from the previous search by walking down
 * through the moves that were played since then.
 */
function tryReuseTree(board: Cell[], turn: Cell, n: number): MCTSNode | null {
  if (!prevRoot || !prevBoard) return null;

  const total = totalCells(n);
  // Find cells that were filled since last search
  const newMoves: number[] = [];
  for (let i = 0; i < total; i++) {
    if (prevBoard[i] === EMPTY && board[i] !== EMPTY) {
      newMoves.push(i);
    }
    // If a cell changed color or was un-filled, a swap or reset happened
    if (prevBoard[i] !== EMPTY && prevBoard[i] !== board[i]) return null;
  }

  // Walk down the tree through each new move
  let node: MCTSNode | null = prevRoot;
  for (const move of newMoves) {
    const child: MCTSNode | undefined = node!.children.find((c) => c.move === move);
    if (!child) return null;
    node = child;
  }

  // Verify the turn matches
  if (!node || node.turn !== turn) return null;

  // Detach from parent to free memory above
  node.parent = null;
  return node;
}

self.onmessage = (e: MessageEvent<{ board: Cell[]; turn: Cell; n: number; iterations: number; C: number; gen: number; reset?: boolean }>) => {
  if (e.data.reset) {
    prevRoot = null;
    prevBoard = null;
    return;
  }
  const { board, turn, n, iterations, C, gen } = e.data;

  // Try to reuse the existing tree, otherwise create a fresh root
  const root = tryReuseTree(board, turn, n) ?? createNode(-1, null, turn, board, n);

  runIterations(root, board, n, iterations, C);

  const move = pickBestMove(root);

  // Persist: save root and board with the AI's move applied for next reuse
  if (move >= 0) {
    const nextBoard = board.slice();
    nextBoard[move] = turn;
    // Re-root to the chosen child so next turn starts deeper
    const chosenChild = root.children.find((c) => c.move === move);
    if (chosenChild) {
      chosenChild.parent = null;
      prevRoot = chosenChild;
    } else {
      prevRoot = null;
    }
    prevBoard = nextBoard;
  } else {
    prevRoot = null;
    prevBoard = null;
  }

  self.postMessage({ move, gen });
};
