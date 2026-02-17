import { type Cell, EMPTY, P1, P2, totalCells, fromIdx, findWinGroup, isFull } from "./y-board";
export { type Cell, EMPTY, P1, P2, totalCells, findWinGroup, isFull };

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
export const statusEl = document.getElementById("status")!;
export const newGameEl = document.getElementById("newgame")!;
export const swapContainer = document.getElementById("swap-container")!;

const DPR = window.devicePixelRatio || 1;
const S3 = Math.sqrt(3);
export const BOARD_SIZE = 11;

const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

export const state = {
  boardSize: BOARD_SIZE,
  board: [] as Cell[],
  turn: P1 as Cell,
  gameOver: false,
  winCells: null as Set<number> | null,
  hoverIdx: -1,
};

export function resetBoard() {
  state.boardSize = BOARD_SIZE;
  state.board = new Array(totalCells(BOARD_SIZE)).fill(EMPTY);
  state.turn = P1;
  state.gameOver = false;
  state.winCells = null;
  state.hoverIdx = -1;
}

export function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
}

function hexR(): number {
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  const pad = 6;
  const fromW = (w - pad * 2) / (state.boardSize * S3);
  const fromH = (h - pad * 2) / ((state.boardSize - 1) * 1.5 + 2);
  return Math.min(fromW, fromH);
}

function hexCenter(r: number, c: number): [number, number] {
  const s = hexR();
  const cw = canvas.width / DPR;
  const ch = canvas.height / DPR;
  const boardH = (state.boardSize - 1) * 1.5 * s + 2 * s;
  const oy = (ch - boardH) / 2 + s;
  return [cw / 2 + (c - r / 2) * S3 * s, oy + r * 1.5 * s];
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

export function hitTest(px: number, py: number): number {
  const s = hexR();
  const maxD2 = (s * 0.9) ** 2;
  const total = totalCells(state.boardSize);
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

/**
 * Draw the board. `canHover` controls whether hover highlights show.
 * Hover color is based on `state.turn`.
 */
export function draw(canHover: boolean) {
  const s = hexR();
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  const dark = isDark();

  ctx.save();
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, w, h);

  const total = totalCells(state.boardSize);
  const cellS = s * 0.92;
  const p1Fill = "#d94a4a";
  const p2Fill = "#4a90d9";
  const emptyFill = dark ? "#2a2a2a" : "#dcdcdc";
  const borderColor = dark ? "#555" : "#aaa";
  const p1Hover = dark ? "rgba(217,74,74,0.4)" : "rgba(217,74,74,0.3)";
  const p2Hover = dark ? "rgba(74,144,217,0.4)" : "rgba(74,144,217,0.3)";

  for (let i = 0; i < total; i++) {
    const [r, c] = fromIdx(i);
    const [cx, cy] = hexCenter(r, c);

    let fill: string;
    const isWin = state.winCells?.has(i);
    if (state.board[i] === P1) fill = isWin ? "#ff6a6a" : p1Fill;
    else if (state.board[i] === P2) fill = isWin ? "#6ab0ff" : p2Fill;
    else if (i === state.hoverIdx && canHover) fill = state.turn === P1 ? p1Hover : p2Hover;
    else fill = emptyFill;

    hexPath(cx, cy, cellS);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = isWin ? (state.board[i] === P1 ? "#ffa0a0" : "#a0d0ff") : borderColor;
    ctx.lineWidth = isWin ? 2.5 : 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Wire up canvas events. `canPlace` determines if a cell is clickable
 * (used for hover highlight, pointer cursor, and gating clicks).
 * `onPlace` is called when a valid cell is clicked.
 * Returns a `redraw` function the caller should use to trigger redraws
 * (so `canPlace` is re-evaluated).
 */
export function setupEvents(canPlace: (i: number) => boolean, onPlace: (i: number) => void): () => void {
  function canvasXY(e: MouseEvent | Touch): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  const redraw = () => draw(!state.gameOver && canPlace(-1));

  canvas.addEventListener("click", (e) => {
    const [x, y] = canvasXY(e);
    const i = hitTest(x, y);
    if (i >= 0 && canPlace(i)) onPlace(i);
  });

  canvas.addEventListener("mousemove", (e) => {
    const [x, y] = canvasXY(e);
    const i = hitTest(x, y);
    if (i >= 0 && canPlace(i)) {
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = "default";
    }
    if (i !== state.hoverIdx) {
      state.hoverIdx = i;
      redraw();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (state.hoverIdx !== -1) {
      state.hoverIdx = -1;
      redraw();
    }
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const [x, y] = canvasXY(touch);
      const i = hitTest(x, y);
      if (i >= 0 && canPlace(i)) onPlace(i);
      state.hoverIdx = -1;
      redraw();
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    resize();
    redraw();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);

  return redraw;
}

/** Perform the swap: change the single P1 piece to P2, set turn to P1. */
export function doSwap() {
  const total = totalCells(state.boardSize);
  for (let i = 0; i < total; i++) {
    if (state.board[i] === P1) {
      state.board[i] = P2;
      break;
    }
  }
  state.turn = P1;
}
