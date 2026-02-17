import { type Board, type Cell, type Pos, EMPTY, BLACK, WHITE, SIZE, CELL, BOARD_PX, createBoard, getFlips, getValidMoves, makeMove, countPieces } from "./othello-board";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const scoreEl = document.getElementById("score")!;
const depthEl = document.getElementById("depth") as HTMLSelectElement;
const newGameEl = document.getElementById("newgame")!;

const worker = new Worker(new URL("./othello-worker.ts", import.meta.url), { type: "module" });

let board: Board;
let playerColor: Cell = BLACK;
let aiColor: Cell = WHITE;
let currentTurn: Cell = BLACK;
let gameOver = false;
let aiThinking = false;
let playerGoesFirst = true;

// ---- Animation state ----

interface FlipAnim {
  row: number;
  col: number;
  fromColor: Cell;
  toColor: Cell;
  delay: number;
}

let animating = false;
let flipAnims: FlipAnim[] = [];
let animStartTime = 0;
let animCallback: (() => void) | null = null;
let placedPiece: Pos | null = null;

const FLIP_DURATION = 300;
const FLIP_STAGGER = 50;
const PLACE_DURATION = 150;

// HiDPI setup
const dpr = window.devicePixelRatio || 1;
canvas.width = BOARD_PX * dpr;
canvas.height = BOARD_PX * dpr;
ctx.scale(dpr, dpr);

// ---- Rendering ----

function drawPiece(cx: number, cy: number, color: Cell, scaleX = 1, scale = 1): void {
  const radius = CELL / 2 - 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scaleX * scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = color === BLACK ? "#1a1a1a" : "#f8f8f8";
  ctx.fill();
  ctx.strokeStyle = color === BLACK ? "#000" : "#c8c8c8";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function draw(): void {
  const validMoves = !gameOver && !aiThinking && !animating && currentTurn === playerColor ? getValidMoves(board, playerColor) : [];

  // Board background
  ctx.fillStyle = "#2d8b4e";
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);

  // Grid lines
  ctx.strokeStyle = "#1a5c30";
  ctx.lineWidth = 1;
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, BOARD_PX);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(BOARD_PX, i * CELL);
    ctx.stroke();
  }

  // Guide dots
  ctx.fillStyle = "#1a5c30";
  const dots: Pos[] = [
    [2, 2],
    [2, 6],
    [6, 2],
    [6, 6],
  ];
  for (const [r, c] of dots) {
    ctx.beginPath();
    ctx.arc(c * CELL, r * CELL, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const now = performance.now();

  // Build set of animating positions
  const animPositions = new Set<string>();
  if (animating) {
    for (const anim of flipAnims) {
      animPositions.add(`${anim.row},${anim.col}`);
    }
    if (placedPiece) {
      animPositions.add(`${placedPiece[0]},${placedPiece[1]}`);
    }
  }

  // Static pieces
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY && !animPositions.has(`${r},${c}`)) {
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        drawPiece(cx, cy, board[r][c]);
      }
    }
  }

  // Animated pieces
  if (animating) {
    const elapsed = now - animStartTime;

    // Placed piece (pop-in)
    if (placedPiece) {
      const [pr, pc] = placedPiece;
      const cx = pc * CELL + CELL / 2;
      const cy = pr * CELL + CELL / 2;
      const t = Math.min(elapsed / PLACE_DURATION, 1);
      const scale = t < 1 ? 0.5 + 0.5 * easeOutBack(t) : 1;
      drawPiece(cx, cy, board[pr][pc], 1, scale);
    }

    // Flipping pieces
    for (const anim of flipAnims) {
      const cx = anim.col * CELL + CELL / 2;
      const cy = anim.row * CELL + CELL / 2;
      const t = Math.max(0, Math.min((elapsed - anim.delay) / FLIP_DURATION, 1));
      if (t <= 0) {
        drawPiece(cx, cy, anim.fromColor);
      } else if (t >= 1) {
        drawPiece(cx, cy, anim.toColor);
      } else {
        const scaleX = Math.abs(Math.cos(t * Math.PI));
        const color = t < 0.5 ? anim.fromColor : anim.toColor;
        drawPiece(cx, cy, color, Math.max(scaleX, 0.02));
      }
    }

    // Check if all animations complete
    const lastDelay = flipAnims.length > 0 ? flipAnims[flipAnims.length - 1].delay : 0;
    const totalDuration = Math.max(PLACE_DURATION, lastDelay + FLIP_DURATION);
    if (elapsed < totalDuration) {
      requestAnimationFrame(draw);
    } else {
      animating = false;
      flipAnims = [];
      placedPiece = null;
      const cb = animCallback;
      animCallback = null;
      draw();
      if (cb) cb();
      return;
    }
  }

  // Valid move indicators
  for (const [r, c] of validMoves) {
    const cx = c * CELL + CELL / 2;
    const cy = r * CELL + CELL / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
  }

  // Score
  const counts = countPieces(board);
  scoreEl.textContent = `Black: ${counts.black} | White: ${counts.white}`;

  // Game over overlay
  if (gameOver) {
    drawGameOverOverlay();
  }
}

function animateMove(row: number, col: number, player: Cell, flips: Pos[], callback: () => void): void {
  const opp: Cell = player === BLACK ? WHITE : BLACK;

  // Sort flips by distance from placed piece for a ripple stagger
  const sorted = flips.slice().sort((a, b) => {
    const da = Math.abs(a[0] - row) + Math.abs(a[1] - col);
    const db = Math.abs(b[0] - row) + Math.abs(b[1] - col);
    return da - db;
  });

  flipAnims = sorted.map((pos, i) => ({
    row: pos[0],
    col: pos[1],
    fromColor: opp,
    toColor: player,
    delay: PLACE_DURATION * 0.5 + i * FLIP_STAGGER,
  }));

  placedPiece = [row, col];
  animating = true;
  animStartTime = performance.now();
  animCallback = callback;

  requestAnimationFrame(draw);
}

// ---- Game Flow ----

function colorName(c: Cell): string {
  return c === BLACK ? "black" : "white";
}

let gameOverOverlayAlpha = 0;
let gameOverMessage = "";
let gameOverScore = "";

function checkGameEnd(): boolean {
  const playerMoves = getValidMoves(board, playerColor);
  const aiMoves = getValidMoves(board, aiColor);
  if (playerMoves.length === 0 && aiMoves.length === 0) {
    gameOver = true;
    const counts = countPieces(board);
    const playerCount = playerColor === BLACK ? counts.black : counts.white;
    const aiCount = playerColor === BLACK ? counts.white : counts.black;
    statusEl.textContent = "Game over";
    if (playerCount > aiCount) {
      gameOverMessage = "You win!";
      gameOverScore = `${playerCount} - ${aiCount}`;
    } else if (aiCount > playerCount) {
      gameOverMessage = "Computer wins";
      gameOverScore = `${aiCount} - ${playerCount}`;
    } else {
      gameOverMessage = "Draw";
      gameOverScore = `${playerCount} - ${aiCount}`;
    }
    gameOverOverlayAlpha = 0;
    animateGameOverOverlay();
    return true;
  }
  return false;
}

function animateGameOverOverlay(): void {
  gameOverOverlayAlpha = Math.min(gameOverOverlayAlpha + 0.04, 1);
  draw();
  if (gameOverOverlayAlpha < 1) {
    requestAnimationFrame(animateGameOverOverlay);
  }
}

function drawGameOverOverlay(): void {
  const alpha = gameOverOverlayAlpha;
  if (alpha <= 0) return;

  // Darken the board
  ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);

  // Message text
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(gameOverMessage, BOARD_PX / 2, BOARD_PX / 2 - 20);

  // Score subtitle
  ctx.font = "24px Menlo, monospace";
  ctx.fillStyle = "#ccc";
  ctx.fillText(gameOverScore, BOARD_PX / 2, BOARD_PX / 2 + 25);
  ctx.restore();
}

function handlePlayerTurn(): void {
  if (gameOver) return;
  const moves = getValidMoves(board, playerColor);
  if (moves.length === 0) {
    statusEl.textContent = "Your turn was skipped";
    currentTurn = aiColor;
    draw();
    const gen = gameGen;
    setTimeout(() => { if (gen === gameGen) handleAiTurn(); }, GAME_DELAY + 375);
    return;
  }
  statusEl.textContent = `Your turn (${colorName(playerColor)})`;
  draw();
}

function handleAiTurn(): void {
  if (gameOver) return;
  const moves = getValidMoves(board, aiColor);
  if (moves.length === 0) {
    statusEl.textContent = "Computer's turn was skipped";
    currentTurn = playerColor;
    draw();
    const gen = gameGen;
    setTimeout(() => { if (gen === gameGen) handlePlayerTurn(); }, GAME_DELAY + 375);
    return;
  }
  aiThinking = true;
  aiThinkStart = performance.now();
  statusEl.textContent = "Thinking...";
  draw();
  worker.postMessage({
    board,
    aiColor,
    depth: parseInt(depthEl.value) || 4,
    gen: gameGen,
  });
}

const GAME_DELAY = 1000;
let aiThinkStart = 0;
let gameGen = 0;

function applyAiMove(move: Pos | null): void {
  if (move) {
    const flips = getFlips(board, move[0], move[1], aiColor);
    board = makeMove(board, move[0], move[1], aiColor);
    aiThinking = false;
    animateMove(move[0], move[1], aiColor, flips, () => {
      currentTurn = playerColor;
      if (!checkGameEnd()) {
        handlePlayerTurn();
      }
    });
  } else {
    aiThinking = false;
    currentTurn = playerColor;
    if (!checkGameEnd()) {
      handlePlayerTurn();
    }
  }
}

worker.onmessage = (e: MessageEvent<{ move: Pos | null; gen: number }>) => {
  const gen = e.data.gen;
  if (gen !== gameGen) return;
  const elapsed = performance.now() - aiThinkStart;
  const remaining = GAME_DELAY - elapsed;
  if (remaining > 0) {
    setTimeout(() => { if (gen === gameGen) applyAiMove(e.data.move); }, remaining);
  } else {
    applyAiMove(e.data.move);
  }
};

// ---- Events ----

canvas.addEventListener("click", (e: MouseEvent) => {
  if (gameOver || aiThinking || animating || currentTurn !== playerColor) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * BOARD_PX;
  const y = ((e.clientY - rect.top) / rect.height) * BOARD_PX;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
  const flips = getFlips(board, row, col, playerColor);
  if (flips.length === 0) return;

  board = makeMove(board, row, col, playerColor);
  currentTurn = aiColor;
  animateMove(row, col, playerColor, flips, () => {
    if (!checkGameEnd()) {
      handleAiTurn();
    }
  });
});

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (gameOver || aiThinking || animating || currentTurn !== playerColor) {
    canvas.style.cursor = "default";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * BOARD_PX;
  const y = ((e.clientY - rect.top) / rect.height) * BOARD_PX;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (row >= 0 && row < SIZE && col >= 0 && col < SIZE && getFlips(board, row, col, playerColor).length > 0) {
    canvas.style.cursor = "pointer";
  } else {
    canvas.style.cursor = "default";
  }
});

newGameEl.addEventListener("click", () => {
  gameGen++;
  playerGoesFirst = !playerGoesFirst;
  board = createBoard();
  playerColor = playerGoesFirst ? BLACK : WHITE;
  aiColor = playerGoesFirst ? WHITE : BLACK;
  currentTurn = BLACK;
  gameOver = false;
  aiThinking = false;
  animating = false;
  flipAnims = [];
  placedPiece = null;
  animCallback = null;
  gameOverOverlayAlpha = 0;
  gameOverMessage = "";
  gameOverScore = "";
  if (currentTurn === aiColor) {
    handleAiTurn();
  } else {
    handlePlayerTurn();
  }
});

// ---- Init ----

board = createBoard();
handlePlayerTurn();
