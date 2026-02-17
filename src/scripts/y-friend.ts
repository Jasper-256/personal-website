import { type Cell, EMPTY, P1, P2, BOARD_SIZE, totalCells, findWinGroup, isFull, doSwap, state, statusEl, newGameEl, swapContainer, resetBoard, resize, draw, setupEvents } from "./y-render";

let moveCount = 0;
let swapAvailable = false;

function updateSwapUI() {
  if (swapAvailable) {
    swapContainer.innerHTML = '<span class="pointer" id="swap-btn">Steal move</span>';
    document.getElementById("swap-btn")!.addEventListener("click", handleSwap);
  } else {
    swapContainer.innerHTML = "";
  }
}

function handleSwap() {
  if (!swapAvailable) return;
  doSwap();
  swapAvailable = false;
  moveCount = 2;
  statusEl.textContent = "Red's turn";
  updateSwapUI();
  redraw();
}

function makeMove(i: number) {
  state.board[i] = state.turn;
  moveCount++;

  const group = findWinGroup(state.board, state.turn, state.boardSize);
  if (group) {
    state.winCells = new Set(group);
    state.gameOver = true;
    swapAvailable = false;
    statusEl.textContent = (state.turn === P1 ? "Red" : "Blue") + " wins!";
    updateSwapUI();
    redraw();
    return;
  }

  if (isFull(state.board, state.boardSize)) {
    state.gameOver = true;
    swapAvailable = false;
    statusEl.textContent = "Draw";
    updateSwapUI();
    redraw();
    return;
  }

  state.turn = state.turn === P1 ? P2 : P1;

  if (moveCount === 1) {
    swapAvailable = true;
    statusEl.textContent = "Blue's turn";
  } else {
    swapAvailable = false;
    statusEl.textContent = (state.turn === P1 ? "Red" : "Blue") + "'s turn";
  }

  updateSwapUI();
  redraw();
}

function newGame() {
  resetBoard();
  moveCount = 0;
  swapAvailable = false;
  statusEl.textContent = "Red's turn";
  updateSwapUI();
  redraw();
}

const redraw = setupEvents((i) => !state.gameOver && (i < 0 || state.board[i] === EMPTY), makeMove);

newGameEl.addEventListener("click", newGame);
resize();
newGame();
