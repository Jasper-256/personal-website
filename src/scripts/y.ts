import { type Cell, EMPTY, P1, P2, BOARD_SIZE, totalCells, findWinGroup, isFull, doSwap, state, statusEl, newGameEl, swapContainer, resetBoard, resize, draw, setupEvents } from "./y-render";

const iterEl = document.getElementById("iterations") as HTMLSelectElement;
const worker = new Worker(new URL("./y-mcts-worker.ts", import.meta.url), { type: "module" });

// Pie-rule lookup table: cells with centrality >= 2 are "strong" enough to steal.
// Centrality for cell (r,c): min(c, r-c, n-1-r)
const STEAL_SET: Set<number> = (() => {
  const s = new Set<number>();
  const n = BOARD_SIZE;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= r; c++) {
      if (Math.min(c, r - c, n - 1 - r) >= 2) s.add((r * (r + 1)) / 2 + c);
    }
  }
  return s;
})();

let playerColor: Cell = P1;
let aiColor: Cell = P2;
let moveCount = 0;
let aiThinking = false;
let playerGoesFirst = true;
let swapAvailable = false;

const AI_DELAY = 400;
let aiThinkStart = 0;
let gameGen = 0;

function colorName(c: Cell): string {
  return c === P1 ? "Red" : "Blue";
}

function updateSwapUI() {
  if (swapAvailable && state.turn === playerColor) {
    swapContainer.innerHTML = '<span class="pointer" id="swap-btn">Steal move</span>';
    document.getElementById("swap-btn")!.addEventListener("click", doPlayerSwap);
  } else {
    swapContainer.innerHTML = "";
  }
}

function doPlayerSwap() {
  if (!swapAvailable) return;
  doSwap();
  swapAvailable = false;
  moveCount = 2;
  updateSwapUI();
  redraw();
  handleAiTurn();
}

function doAiSwap() {
  doSwap();
  swapAvailable = false;
  moveCount = 2;
  statusEl.textContent = `Your turn (${colorName(playerColor).toLowerCase()})`;
  redraw();
}

function checkWin(player: Cell): boolean {
  const group = findWinGroup(state.board, player, state.boardSize);
  if (group) {
    state.winCells = new Set(group);
    state.gameOver = true;
    swapAvailable = false;
    updateSwapUI();
    statusEl.textContent = player === playerColor ? "You win!" : "Computer wins";
    redraw();
    return true;
  }
  if (isFull(state.board, state.boardSize)) {
    state.gameOver = true;
    swapAvailable = false;
    updateSwapUI();
    statusEl.textContent = "Draw";
    redraw();
    return true;
  }
  return false;
}

function handleAiTurn() {
  if (state.gameOver) return;
  if (swapAvailable && state.turn === aiColor) {
    const total = totalCells(state.boardSize);
    let openingIdx = -1;
    for (let i = 0; i < total; i++) {
      if (state.board[i] !== EMPTY) {
        openingIdx = i;
        break;
      }
    }
    if (openingIdx >= 0 && STEAL_SET.has(openingIdx)) {
      statusEl.textContent = "Computer steals";
      redraw();
      const gen = gameGen;
      setTimeout(() => { if (gen === gameGen) doAiSwap(); }, AI_DELAY);
      return;
    }
    swapAvailable = false;
    updateSwapUI();
  }
  aiThinking = true;
  aiThinkStart = performance.now();
  statusEl.textContent = "Thinking...";
  redraw();
  worker.postMessage({
    board: state.board,
    turn: aiColor,
    n: state.boardSize,
    iterations: parseInt(iterEl.value) || 5000,
    C: 1.41,
    gen: gameGen,
  });
}

function applyAiMove(move: number) {
  if (move < 0) return;
  state.board[move] = aiColor;
  moveCount++;
  aiThinking = false;
  if (checkWin(aiColor)) return;
  state.turn = playerColor;
  if (moveCount === 1) {
    swapAvailable = true;
    updateSwapUI();
  }
  statusEl.textContent = `Your turn (${colorName(playerColor).toLowerCase()})`;
  redraw();
}

worker.onmessage = (e: MessageEvent<{ move: number; gen: number }>) => {
  const gen = e.data.gen;
  if (gen !== gameGen) return;
  const elapsed = performance.now() - aiThinkStart;
  const remaining = AI_DELAY - elapsed;
  if (remaining > 0) {
    setTimeout(() => { if (gen === gameGen) applyAiMove(e.data.move); }, remaining);
  } else {
    applyAiMove(e.data.move);
  }
};

function makeMove(i: number) {
  if (swapAvailable) {
    swapAvailable = false;
    updateSwapUI();
  }
  state.board[i] = playerColor;
  moveCount++;
  if (checkWin(playerColor)) return;
  state.turn = aiColor;
  redraw();
  if (moveCount === 1) swapAvailable = true;
  handleAiTurn();
}

function newGame() {
  gameGen++;
  playerGoesFirst = !playerGoesFirst;
  worker.postMessage({ reset: true });
  resetBoard();
  playerColor = playerGoesFirst ? P1 : P2;
  aiColor = playerGoesFirst ? P2 : P1;
  moveCount = 0;
  aiThinking = false;
  swapAvailable = false;
  updateSwapUI();
  if (state.turn === aiColor) {
    handleAiTurn();
  } else {
    statusEl.textContent = `Your turn (${colorName(playerColor).toLowerCase()})`;
    redraw();
  }
}

const redraw = setupEvents((i) => !state.gameOver && !aiThinking && state.turn === playerColor && (i < 0 || state.board[i] === EMPTY), makeMove);

newGameEl.addEventListener("click", newGame);
resize();
resetBoard();
statusEl.textContent = `Your turn (${colorName(playerColor).toLowerCase()})`;
updateSwapUI();
redraw();
