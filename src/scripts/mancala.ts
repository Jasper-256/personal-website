import { type Board, type Side, SIZE, PITS, createBoard, playMove, pitOf, storeOf, isStore } from "./mancala-board";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const scoreEl = document.getElementById("score")!;
const difficultyEl = document.getElementById("difficulty") as HTMLSelectElement;
const newGameEl = document.getElementById("newgame")!;

const worker = new Worker(new URL("./mancala-worker.ts", import.meta.url), { type: "module" });

let DPR = window.devicePixelRatio || 1;

// The human always plays side 0 (bottom row, store on the right).
const HUMAN: Side = 0;
const AI: Side = 1;

// ---- Layout ----
// Everything is laid out on a horizontal board in "units", then rotated a quarter
// turn clockwise when the CSS makes the canvas taller than it is wide (narrow portrait
// screens: human column on the left, store at the bottom).

const LEN = 8.4;
const WID = 3.2;
const PIT_R = 0.43;
const STORE_HX = 0.42;
const STORE_HY = 1.0;
const STONE_R = 0.1;

interface Geo {
  x: number;
  y: number;
  // Hole half extents, in px.
  hx: number;
  hy: number;
  // Half extents of the area stone centers can rest in, in px.
  ux: number;
  uy: number;
  // Count label position, in px.
  lx: number;
  ly: number;
}

let vertical = false;
let unit = 1;
let cssW = 0;
let cssH = 0;
let geo: Geo[] = [];

function canonical(p: number): [number, number, number, number, number] {
  // [x, y, hx, hy, labelY]
  if (p === 6) return [7.7, 1.6, STORE_HX, STORE_HY, 2.93];
  if (p === 13) return [0.7, 1.6, STORE_HX, STORE_HY, 0.27];
  if (p < 6) return [1.7 + p, 2.2, PIT_R, PIT_R, 2.93];
  return [1.7 + (12 - p), 1.0, PIT_R, PIT_R, 0.27];
}

function layout(w: number, h: number): void {
  // Orientation comes from the measured box rather than a media query, so the
  // drawing always agrees with the size the browser actually gave the canvas.
  vertical = h > w;
  cssW = w;
  cssH = h;
  DPR = window.devicePixelRatio || 1;
  unit = vertical ? cssW / WID : cssW / LEN;
  canvas.width = Math.round(cssW * DPR);
  canvas.height = Math.round(cssH * DPR);
  geo = [];
  for (let p = 0; p < SIZE; p++) {
    const [x, y, hx, hy, ly] = canonical(p);
    const pad = STONE_R + 0.03;
    const [sx, sy] = toScreen(x, y);
    const [lx, lly] = toScreen(x, ly);
    const [shx, shy] = vertical ? [hy, hx] : [hx, hy];
    geo.push({ x: sx, y: sy, hx: shx * unit, hy: shy * unit, ux: (shx - pad) * unit, uy: (shy - pad) * unit, lx, ly: lly });
  }
}

function toScreen(x: number, y: number): [number, number] {
  return vertical ? [(WID - y) * unit, x * unit] : [x * unit, y * unit];
}

// ---- Colors and cached layers ----

const STONE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00", "#00acc1", "#ec407a"];

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mix(hex: string, target: number, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const f = (c: number) => Math.round(c + (target - c) * amount);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

const boardLayer = document.createElement("canvas");
let stoneSprites: HTMLCanvasElement[] = [];
let spriteR = 0;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function holePath(g: CanvasRenderingContext2D, q: Geo, grow = 0): void {
  if (q.hx === q.hy) {
    g.beginPath();
    g.arc(q.x, q.y, q.hx + grow, 0, Math.PI * 2);
  } else {
    roundRect(g, q.x - q.hx - grow, q.y - q.hy - grow, (q.hx + grow) * 2, (q.hy + grow) * 2, Math.min(q.hx, q.hy) + grow);
  }
}

function buildBoardLayer(): void {
  boardLayer.width = canvas.width;
  boardLayer.height = canvas.height;
  const g = boardLayer.getContext("2d")!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const w = cssW;
  const h = cssH;

  // Wooden body, lit from the top.
  roundRect(g, 1, 1, w - 2, h - 2, 0.3 * unit);
  const body = g.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, "#cf9255");
  body.addColorStop(0.5, "#b97b40");
  body.addColorStop(1, "#9c6230");
  g.fillStyle = body;
  g.fill();

  // Grain runs along the long axis.
  g.save();
  g.clip();
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 26; i++) {
    const across = rnd() * WID;
    const amp = 0.02 + rnd() * 0.06;
    const freq = 0.6 + rnd() * 1.4;
    const phase = rnd() * Math.PI * 2;
    g.beginPath();
    for (let a = -0.2; a <= LEN + 0.2; a += 0.1) {
      const [x, y] = toScreen(a, across + Math.sin(a * freq + phase) * amp);
      a === -0.2 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(95, 52, 18, ${0.07 + rnd() * 0.1})`;
    g.lineWidth = 0.5 + rnd() * 1.6;
    g.stroke();
  }
  g.restore();

  roundRect(g, 1, 1, w - 2, h - 2, 0.3 * unit);
  g.strokeStyle = "rgba(80, 42, 12, 0.7)";
  g.lineWidth = 2;
  g.stroke();
  roundRect(g, 3, 3, w - 6, h - 6, 0.3 * unit - 2);
  g.strokeStyle = "rgba(255, 222, 170, 0.25)";
  g.lineWidth = 1;
  g.stroke();

  for (const q of geo) {
    // Lit lower rim.
    holePath(g, q, 1.5);
    const rim = g.createLinearGradient(0, q.y - q.hy, 0, q.y + q.hy);
    rim.addColorStop(0, "rgba(70, 38, 12, 0.5)");
    rim.addColorStop(1, "rgba(255, 228, 185, 0.55)");
    g.fillStyle = rim;
    g.fill();

    // Concave hole, darker toward the top edge.
    holePath(g, q);
    const r = Math.max(q.hx, q.hy);
    const hole = g.createRadialGradient(q.x, q.y + Math.min(q.hx, q.hy) * 0.35, 0, q.x, q.y, r * 1.1);
    hole.addColorStop(0, "#7a4824");
    hole.addColorStop(0.7, "#5e3518");
    hole.addColorStop(1, "#43230c");
    g.fillStyle = hole;
    g.fill();

    g.save();
    holePath(g, q);
    g.clip();
    g.translate(0, 0.07 * unit);
    holePath(g, q, 0.04 * unit);
    g.strokeStyle = "rgba(30, 14, 2, 0.35)";
    g.lineWidth = 0.12 * unit;
    g.stroke();
    g.restore();
  }
}

function buildStoneSprites(): void {
  spriteR = STONE_R * unit;
  const size = Math.ceil((spriteR * 2.6 + 2) * DPR);
  stoneSprites = STONE_COLORS.map((color) => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d")!;
    g.scale(DPR, DPR);
    const m = size / DPR / 2;
    const r = spriteR;
    // Contact shadow.
    g.beginPath();
    g.ellipse(m + r * 0.12, m + r * 0.22, r * 1.02, r * 0.95, 0, 0, Math.PI * 2);
    g.fillStyle = "rgba(20, 8, 0, 0.35)";
    g.fill();
    // Glassy body.
    const grad = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
    grad.addColorStop(0, mix(color, 255, 0.55));
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, mix(color, 0, 0.5));
    g.beginPath();
    g.arc(m, m, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = mix(color, 0, 0.6);
    g.globalAlpha = 0.5;
    g.lineWidth = 0.6;
    g.stroke();
    // Specular highlight.
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(m - r * 0.33, m - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    return c;
  });
}

// ---- Stones ----
// Every stone is tracked individually so it can be animated between pits.
// A stone always lives in the list of the pit it ends up in; while its animation
// runs it is drawn along a path of keyframes instead.

interface Key {
  t: number;
  pit: number;
  // Offset from the pit center: either normalized within the resting area, or in board units.
  u: number;
  v: number;
  rest: boolean;
  // Lift off the board, 0 = resting, 1 = held in hand.
  z: number;
  // Extra lift at the middle of the segment ending at this key.
  arc: number;
}

interface Stone {
  color: number;
  u: number;
  v: number;
  keys: Key[] | null;
}

let pits: Stone[][] = [];

function randomInDisc(): [number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// Picks a resting spot that keeps stones in a pit spread out.
function pickRest(p: number): [number, number] {
  const sx = geo[p].ux;
  const sy = geo[p].uy;
  let best: [number, number] = [0, 0];
  let bestD = -1;
  for (let i = 0; i < 12; i++) {
    const [u, v] = randomInDisc();
    let d = Infinity;
    for (const s of pits[p]) d = Math.min(d, Math.hypot((s.u - u) * sx, (s.v - v) * sy));
    if (d > bestD) {
      bestD = d;
      best = [u, v];
    }
  }
  return best;
}

function resetStones(b: Board): void {
  pits = Array.from({ length: SIZE }, () => []);
  const colors: number[] = [];
  let total = 0;
  for (const n of b) total += n;
  for (let i = 0; i < total; i++) colors.push(i % STONE_COLORS.length);
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  for (let p = 0; p < SIZE; p++) {
    for (let k = 0; k < b[p]; k++) {
      const [u, v] = pickRest(p);
      pits[p].push({ color: colors.pop()!, u, v, keys: null });
    }
  }
}

function keyPos(k: Key): [number, number] {
  const q = geo[k.pit];
  return k.rest ? [q.x + k.u * q.ux, q.y + k.v * q.uy] : [q.x + k.u * unit, q.y + k.v * unit];
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Position and lift of an animating stone at time `now`.
function stoneAt(keys: Key[], now: number): [number, number, number] {
  let i = 1;
  while (i < keys.length - 1 && keys[i].t <= now) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const t = b.t > a.t ? Math.min(1, Math.max(0, (now - a.t) / (b.t - a.t))) : 1;
  const e = ease(t);
  const [ax, ay] = keyPos(a);
  const [bx, by] = keyPos(b);
  return [ax + (bx - ax) * e, ay + (by - ay) * e, a.z + (b.z - a.z) * e + b.arc * Math.sin(Math.PI * t)];
}

let animEnd = 0;

const LIFT_MS = 200;
const FLY_MS = 480;
const FLY_STAGGER = 45;

// Animates picking up every stone in `src` and dropping one into each pit of `drops`,
// carrying the rest along as a handful. Returns when the last stone lands.
function animateSow(src: number, drops: number[], start: number): number {
  const hand = pits[src].splice(0);
  const n = drops.length;
  const hop = n <= 10 ? 170 : Math.max(80, 1700 / n);
  const path = [src, ...drops];
  const lifted = start + LIFT_MS;
  for (let k = 0; k < n; k++) {
    const s = hand[k];
    // Tight golden-angle cluster for the handful.
    const ca = k * 2.39996;
    const cr = 0.17 * Math.sqrt((k + 0.5) / n);
    const cu = Math.cos(ca) * cr;
    const cv = Math.sin(ca) * cr;
    const keys: Key[] = [
      { t: start, pit: src, u: s.u, v: s.v, rest: true, z: 0, arc: 0 },
      { t: lifted, pit: src, u: cu, v: cv, rest: false, z: 1, arc: 0 },
    ];
    for (let j = 1; j <= k; j++) keys.push({ t: lifted + j * hop, pit: path[j], u: cu, v: cv, rest: false, z: 1, arc: 0.3 });
    const dest = path[k + 1];
    const [u, v] = pickRest(dest);
    keys.push({ t: lifted + (k + 1) * hop, pit: dest, u, v, rest: true, z: 0, arc: 0.3 });
    s.u = u;
    s.v = v;
    s.keys = keys;
    pits[dest].push(s);
  }
  const end = lifted + n * hop;
  animEnd = Math.max(animEnd, end);
  requestDraw();
  return end;
}

// Flies every stone in `from` pits to `store`, a few at a time.
function animateToStore(from: number[], store: number, start: number): number {
  let k = 0;
  let end = start;
  for (const p of from) {
    for (const s of pits[p].splice(0)) {
      const t0 = start + k * FLY_STAGGER;
      const [u, v] = pickRest(store);
      s.keys = [
        { t: t0, pit: p, u: s.u, v: s.v, rest: true, z: 0, arc: 0 },
        { t: t0 + FLY_MS, pit: store, u, v, rest: true, z: 0, arc: 1.6 },
      ];
      s.u = u;
      s.v = v;
      pits[store].push(s);
      end = t0 + FLY_MS;
      k++;
    }
  }
  animEnd = Math.max(animEnd, end);
  requestDraw();
  return end;
}

// ---- Rendering ----

let rafId = 0;

function requestDraw(): void {
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function frame(): void {
  rafId = 0;
  const now = performance.now();
  draw(now);
  if (now < animEnd || (gameOver && overlayAlpha < 1)) requestDraw();
}

function drawStone(s: Stone, x: number, y: number, z: number): void {
  const sprite = stoneSprites[s.color];
  const scale = 1 + 0.18 * z;
  const size = (sprite.width / DPR) * scale;
  ctx.drawImage(sprite, x - size / 2, y - size / 2 - z * 0.12 * unit, size, size);
}

function playable(p: number): boolean {
  return !busy && !gameOver && turn === HUMAN && p >= 0 && p < PITS && board[p] > 0;
}

let lastScore = "";

function draw(now: number): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.drawImage(boardLayer, 0, 0, cssW, cssH);

  // Playable pits glow on the human's turn.
  for (let p = 0; p < PITS; p++) {
    if (!playable(p)) continue;
    const q = geo[p];
    holePath(ctx, q, 2);
    ctx.strokeStyle = p === hoverPit ? "rgba(255, 244, 214, 0.95)" : "rgba(255, 236, 190, 0.4)";
    ctx.lineWidth = p === hoverPit ? 3 : 2;
    ctx.stroke();
  }

  const counts = new Array<number>(SIZE).fill(0);
  const moving: [Stone, number, number, number][] = [];
  for (let p = 0; p < SIZE; p++) {
    const q = geo[p];
    for (const s of pits[p]) {
      if (s.keys && now >= s.keys[s.keys.length - 1].t) s.keys = null;
      if (!s.keys) {
        counts[p]++;
        drawStone(s, q.x + s.u * q.ux, q.y + s.v * q.uy, 0);
      } else if (now < s.keys[0].t) {
        counts[s.keys[0].pit]++;
        const [x, y] = keyPos(s.keys[0]);
        drawStone(s, x, y, 0);
      } else {
        moving.push([s, ...stoneAt(s.keys, now)]);
      }
    }
  }

  moving.sort((a, b) => a[3] - b[3]);
  for (const [, x, y, z] of moving) {
    if (z < 0.05) continue;
    ctx.beginPath();
    ctx.ellipse(x + 0.04 * unit, y + 0.05 * unit, spriteR * (1 + 0.1 * z), spriteR * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(20, 8, 0, ${0.25 / (1 + z)})`;
    ctx.fill();
  }
  for (const [s, x, y, z] of moving) drawStone(s, x, y, z);

  ctx.font = `bold ${Math.round(0.25 * unit)}px Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let p = 0; p < SIZE; p++) {
    const q = geo[p];
    ctx.fillStyle = "rgba(60, 30, 8, 0.6)";
    ctx.fillText(String(counts[p]), q.lx + 1, q.ly + 1);
    ctx.fillStyle = isStore(p) ? "#fff6e6" : "rgba(255, 240, 220, 0.9)";
    ctx.fillText(String(counts[p]), q.lx, q.ly);
  }

  const score = `You: ${counts[storeOf(HUMAN)]} | Computer: ${counts[storeOf(AI)]}`;
  if (score !== lastScore) {
    scoreEl.textContent = score;
    lastScore = score;
  }

  if (gameOver) drawGameOverOverlay();
}

let overlayAlpha = 0;
let overlayStart = 0;
let gameOverMessage = "";
let gameOverScore = "";

function drawGameOverOverlay(): void {
  overlayAlpha = Math.min(1, (performance.now() - overlayStart) / 600);
  if (overlayAlpha <= 0) return;
  roundRect(ctx, 1, 1, cssW - 2, cssH - 2, 0.3 * unit);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * overlayAlpha})`;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = overlayAlpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const big = Math.round(Math.min(cssW, cssH) * 0.13);
  ctx.font = `bold ${big}px Menlo, monospace`;
  ctx.fillStyle = "#fff";
  ctx.fillText(gameOverMessage, cssW / 2, cssH / 2 - big * 0.5);
  ctx.font = `${Math.round(big * 0.6)}px Menlo, monospace`;
  ctx.fillStyle = "#ccc";
  ctx.fillText(gameOverScore, cssW / 2, cssH / 2 + big * 0.55);
  ctx.restore();
}

// ---- Game flow ----

let board: Board = createBoard();
let turn: Side = HUMAN;
let firstSide: Side = HUMAN;
let gameOver = false;
let busy = false;
let hoverPit = -1;
let gameGen = 0;
let aiThinkStart = 0;

const AI_DELAY = 800;
// Expert searches as deep as it can in this long; easier levels stop at a fixed depth.
const AI_TIME = 1000;

const sleepUntil = (t: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, t - performance.now())));

async function doMove(side: Side, i: number): Promise<void> {
  const gen = gameGen;
  busy = true;
  const src = pitOf(side, i);
  const res = playMove(board, side, i);
  const who = side === HUMAN ? "You" : "Computer";

  await sleepUntil(animateSow(src, res.drops, performance.now()));
  if (gen !== gameGen) return;

  if (res.capture) {
    const n = pits[res.capture.pit].length + pits[res.capture.opposite].length;
    statusEl.textContent = `${who} captured ${n}!`;
    await sleepUntil(animateToStore([res.capture.opposite, res.capture.pit], storeOf(side), performance.now() + 150));
    if (gen !== gameGen) return;
  }

  if (res.gameOver) {
    const start = performance.now() + 300;
    const end0 = animateToStore([0, 1, 2, 3, 4, 5], storeOf(0), start);
    const end1 = animateToStore([7, 8, 9, 10, 11, 12], storeOf(1), start);
    await sleepUntil(Math.max(end0, end1) + 150);
    if (gen !== gameGen) return;
    endGame();
    return;
  }

  turn = res.next;
  startTurn(res.extraTurn);
}

function startTurn(extraTurn: boolean): void {
  if (turn === HUMAN) {
    busy = false;
    statusEl.textContent = extraTurn ? "Extra turn! Go again" : "Your turn";
    requestDraw();
    return;
  }
  busy = true;
  aiThinkStart = performance.now();
  statusEl.textContent = extraTurn ? "Computer goes again..." : "Thinking...";
  requestDraw();
  worker.postMessage({ board, side: AI, time: AI_TIME, depth: parseInt(difficultyEl.value) || 0, gen: gameGen });
}

worker.onmessage = (e: MessageEvent<{ move: number; gen: number }>) => {
  const { move, gen } = e.data;
  if (gen !== gameGen) return;
  const remaining = AI_DELAY - (performance.now() - aiThinkStart);
  setTimeout(
    () => {
      if (gen === gameGen) doMove(AI, move);
    },
    Math.max(0, remaining),
  );
};

function endGame(): void {
  gameOver = true;
  busy = false;
  const you = board[storeOf(HUMAN)];
  const cpu = board[storeOf(AI)];
  statusEl.textContent = "Game over";
  if (you > cpu) {
    gameOverMessage = "You win!";
    gameOverScore = `${you} - ${cpu}`;
  } else if (cpu > you) {
    gameOverMessage = "Computer wins";
    gameOverScore = `${cpu} - ${you}`;
  } else {
    gameOverMessage = "Draw";
    gameOverScore = `${you} - ${cpu}`;
  }
  overlayStart = performance.now();
  overlayAlpha = 0;
  requestDraw();
}

function newGame(): void {
  gameGen++;
  firstSide = firstSide === HUMAN ? AI : HUMAN;
  worker.postMessage({ reset: true });
  board = createBoard();
  resetStones(board);
  turn = firstSide;
  gameOver = false;
  busy = false;
  hoverPit = -1;
  animEnd = 0;
  overlayAlpha = 0;
  startTurn(false);
}

// ---- Events ----

function pitAt(e: MouseEvent): number {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let p = 0; p < PITS; p++) {
    const q = geo[p];
    if (Math.hypot(x - q.x, y - q.y) < q.hx * 1.15) return p;
  }
  return -1;
}

canvas.addEventListener("click", (e: MouseEvent) => {
  const p = pitAt(e);
  if (!playable(p)) return;
  hoverPit = -1;
  canvas.style.cursor = "default";
  doMove(HUMAN, p);
});

canvas.addEventListener("pointermove", (e: PointerEvent) => {
  const p = pitAt(e);
  const next = playable(p) && e.pointerType === "mouse" ? p : -1;
  canvas.style.cursor = next >= 0 ? "pointer" : "default";
  if (next !== hoverPit) {
    hoverPit = next;
    requestDraw();
  }
});

canvas.addEventListener("pointerleave", () => {
  if (hoverPit !== -1) {
    hoverPit = -1;
    requestDraw();
  }
});

newGameEl.addEventListener("click", newGame);

function resize(w: number, h: number): void {
  if (w === 0 || h === 0) return;
  if (w === cssW && h === cssH && DPR === (window.devicePixelRatio || 1)) return;
  layout(w, h);
  buildBoardLayer();
  buildStoneSprites();
  // Resizing the canvas clears it, so repaint before this frame is shown.
  if (pits.length) draw(performance.now());
  requestDraw();
}

// The window resize event can fire mid-rotation (notably on iOS) before the new
// layout settles, so watch the canvas box itself instead.
new ResizeObserver((entries) => {
  const box = entries[entries.length - 1].contentRect;
  resize(box.width, box.height);
}).observe(canvas);

// ---- Init ----

const initial = canvas.getBoundingClientRect();
resize(initial.width, initial.height);
resetStones(board);
statusEl.textContent = "Your turn";
