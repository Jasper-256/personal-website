import {
  type Cell, EMPTY, P1, P2,
  totalCells, idx, fromIdx,
  findWinGroup, isFull,
} from "./y-board";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const newGameEl = document.getElementById("newgame")!;
const swapContainer = document.getElementById("swap-container")!;

const DPR = window.devicePixelRatio || 1;
const S3 = Math.sqrt(3);
const BOARD_SIZE = 11;

let boardSize = BOARD_SIZE;
let board: Cell[] = [];
let turn: Cell = P1;
let moveCount = 0;
let gameOver = false;
let winCells: Set<number> | null = null;
let hoverIdx = -1;
let swapAvailable = false;

const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
}

function hexR(): number {
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  const pad = 20;
  const fromW = (w - pad * 2) / (boardSize * S3);
  const fromH = (h - pad * 2) / ((boardSize - 1) * 1.5 + 2);
  return Math.min(fromW, fromH);
}

function hexCenter(r: number, c: number): [number, number] {
  const s = hexR();
  const cw = canvas.width / DPR;
  const ch = canvas.height / DPR;
  const boardH = (boardSize - 1) * 1.5 * s + 2 * s;
  const oy = (ch - boardH) / 2 + s;
  return [
    cw / 2 + (c - r / 2) * S3 * s,
    oy + r * 1.5 * s,
  ];
}

function hexPath(cx: number, cy: number, s: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + s * Math.cos(a);
    const y = cy + s * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function draw() {
  const s = hexR();
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  const dark = isDark();

  ctx.save();
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, w, h);

  const total = totalCells(boardSize);
  const cellS = s * 0.92;
  const p1Fill = "#d94a4a";
  const p2Fill = "#4a90d9";
  const emptyFill = dark ? "#2a2a2a" : "#e0d8c8";
  const borderColor = dark ? "#555" : "#998870";
  const p1Hover = dark ? "rgba(217,74,74,0.4)" : "rgba(217,74,74,0.3)";
  const p2Hover = dark ? "rgba(74,144,217,0.4)" : "rgba(74,144,217,0.3)";

  for (let i = 0; i < total; i++) {
    const [r, c] = fromIdx(i);
    const [cx, cy] = hexCenter(r, c);

    let fill: string;
    const isWin = winCells?.has(i);
    if (board[i] === P1) fill = isWin ? "#ff6a6a" : p1Fill;
    else if (board[i] === P2) fill = isWin ? "#6ab0ff" : p2Fill;
    else if (i === hoverIdx && !gameOver) fill = turn === P1 ? p1Hover : p2Hover;
    else fill = emptyFill;

    hexPath(cx, cy, cellS);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = isWin ? (board[i] === P1 ? "#ffa0a0" : "#a0d0ff") : borderColor;
    ctx.lineWidth = isWin ? 2.5 : 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function hitTest(px: number, py: number): number {
  const s = hexR();
  const maxD2 = (s * 0.9) ** 2;
  const total = totalCells(boardSize);
  let best = -1;
  let bestD2 = maxD2;
  for (let i = 0; i < total; i++) {
    const [r, c] = fromIdx(i);
    const [cx, cy] = hexCenter(r, c);
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

function updateSwapUI() {
  if (swapAvailable) {
    swapContainer.innerHTML = '<span class="pointer" id="swap-btn">Steal move</span>';
    document.getElementById("swap-btn")!.addEventListener("click", doSwap);
  } else {
    swapContainer.innerHTML = "";
  }
}

function doSwap() {
  if (!swapAvailable) return;
  // Find the single placed piece and change it to Blue's color
  const total = totalCells(boardSize);
  for (let i = 0; i < total; i++) {
    if (board[i] === P1) {
      board[i] = P2;
      break;
    }
  }
  // After swap: the piece is now Blue's, and it's Red's turn
  swapAvailable = false;
  turn = P1;
  moveCount = 2;
  statusEl.textContent = "Red's turn";
  updateSwapUI();
  draw();
}

function makeMove(i: number) {
  if (gameOver || board[i] !== EMPTY) return;
  board[i] = turn;
  moveCount++;

  const group = findWinGroup(board, turn, boardSize);
  if (group) {
    winCells = new Set(group);
    gameOver = true;
    swapAvailable = false;
    statusEl.textContent = (turn === P1 ? "Red" : "Blue") + " wins!";
    updateSwapUI();
    draw();
    return;
  }

  if (isFull(board, boardSize)) {
    gameOver = true;
    swapAvailable = false;
    statusEl.textContent = "Draw!";
    updateSwapUI();
    draw();
    return;
  }

  turn = turn === P1 ? P2 : P1;

  // After Blue's first move, if pie rule is on, Red gets the swap option
  if (moveCount === 1) {
    swapAvailable = true;
    statusEl.textContent = "Blue's turn";
  } else {
    swapAvailable = false;
    statusEl.textContent = (turn === P1 ? "Red" : "Blue") + "'s turn";
  }

  updateSwapUI();
  draw();
}

function newGame() {
  boardSize = BOARD_SIZE;
  board = new Array(totalCells(boardSize)).fill(EMPTY);
  turn = P1;
  moveCount = 0;
  gameOver = false;
  winCells = null;
  hoverIdx = -1;
  swapAvailable = false;
  statusEl.textContent = "Red's turn";
  updateSwapUI();
  draw();
}

function canvasXY(e: MouseEvent | Touch): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

canvas.addEventListener("click", (e) => {
  const [x, y] = canvasXY(e);
  const i = hitTest(x, y);
  if (i >= 0) makeMove(i);
});

canvas.addEventListener("mousemove", (e) => {
  const [x, y] = canvasXY(e);
  const i = hitTest(x, y);
  if (i !== hoverIdx) {
    hoverIdx = i;
    draw();
  }
});

canvas.addEventListener("mouseleave", () => {
  if (hoverIdx !== -1) {
    hoverIdx = -1;
    draw();
  }
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const [x, y] = canvasXY(touch);
  const i = hitTest(x, y);
  if (i >= 0) makeMove(i);
  hoverIdx = -1;
  draw();
}, { passive: false });

newGameEl.addEventListener("click", newGame);
window.addEventListener("resize", () => { resize(); draw(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => draw());

resize();
newGame();
