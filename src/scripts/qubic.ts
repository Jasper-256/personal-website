import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Board, type Cell, EMPTY, PLAYER_X, PLAYER_O, fromIdx, createBoard, getValidMoves, makeMove, checkWin, isFull } from "./qubic-board";

// ---- DOM ----

const container = document.getElementById("game-container")!;
const statusEl = document.getElementById("status")!;
const depthEl = document.getElementById("depth") as HTMLSelectElement;
const newGameEl = document.getElementById("newgame")!;
const overlayEl = document.getElementById("game-over")!;
const overlayMsgEl = document.getElementById("game-over-msg")!;

// ---- Worker ----

const worker = new Worker(new URL("./qubic-worker.ts", import.meta.url), { type: "module" });

// ---- Game state ----

let board: Board = createBoard();
let playerPiece: Cell = PLAYER_X;
let aiPiece: Cell = PLAYER_O;
let currentTurn: Cell = PLAYER_X;
let gameOver = false;
let aiThinking = false;
let playerGoesFirst = true;
let winLine: number[] | null = null;

// ---- Three.js setup ----

const scene = new THREE.Scene();
const ZOOM = 1.25;
const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 200);
// Slightly askew from a direct corner view
camera.position.set(16 * ZOOM, 6 * ZOOM, 12 * ZOOM);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const DEFAULT_CAM_POS = new THREE.Vector3(16 * ZOOM, 6 * ZOOM, 12 * ZOOM);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);

// ---- Camera reset animation ----

let cameraResetting = false;
let lastFrame: number | null = null;
const RESET_SPEED = 15;

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") cameraResetting = true;
});

// ---- Lighting ----

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
dirLight2.position.set(-5, -3, -5);
scene.add(dirLight2);

// ---- Board constants ----

const SPACING = 1.2;
const LAYER_SPACING = 2.0;

function cellPos(l: number, r: number, c: number): THREE.Vector3 {
  return new THREE.Vector3((c - 1.5) * SPACING, (l - 1.5) * LAYER_SPACING, (r - 1.5) * SPACING);
}

// ---- Grid visuals ----

function createGrid(): void {
  const lineMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 });
  const pillarMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.15 });
  const T = 0.3;

  function addSegment(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.LineBasicMaterial): void {
    const start = new THREE.Vector3().lerpVectors(a, b, T);
    const end = new THREE.Vector3().lerpVectors(a, b, 1 - T);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    scene.add(new THREE.Line(geo, mat));
  }

  // Horizontal segments between adjacent points
  for (let l = 0; l < 4; l++) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        addSegment(cellPos(l, r, c), cellPos(l, r, c + 1), lineMat);
      }
    }
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 3; r++) {
        addSegment(cellPos(l, r, c), cellPos(l, r + 1, c), lineMat);
      }
    }
  }

  // Vertical pillars between adjacent layers
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      for (let l = 0; l < 3; l++) {
        addSegment(cellPos(l, r, c), cellPos(l + 1, r, c), pillarMat);
      }
    }
  }
}

// ---- Position markers ----

const dotGeo = new THREE.SphereGeometry(0.05, 6, 6);
const dotMat = new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.4 });
const dots: THREE.Mesh[] = [];

function createDots(): void {
  for (let i = 0; i < 64; i++) {
    const [l, r, c] = fromIdx(i);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(cellPos(l, r, c));
    scene.add(dot);
    dots.push(dot);
  }
}

// ---- Click targets ----

const clickTargets: THREE.Mesh[] = [];
const targetGeo = new THREE.SphereGeometry(0.35, 8, 8);
const targetMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });

function createClickTargets(): void {
  for (let i = 0; i < 64; i++) {
    const [l, r, c] = fromIdx(i);
    const mesh = new THREE.Mesh(targetGeo, targetMat);
    mesh.position.copy(cellPos(l, r, c));
    mesh.userData.cellIndex = i;
    scene.add(mesh);
    clickTargets.push(mesh);
  }
}

// ---- Pieces ----

const pieceGeo = new THREE.SphereGeometry(0.28, 24, 24);
const pieceMeshes: (THREE.Mesh | null)[] = new Array(64).fill(null);

function createPieceMaterial(player: Cell): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: player === PLAYER_X ? 0x4a9eff : 0xff5555,
    metalness: 0.3,
    roughness: 0.4,
  });
}

// ---- Piece animation ----

interface PieceAnim {
  index: number;
  startTime: number;
}

const pieceAnims: PieceAnim[] = [];
const PIECE_ANIM_DURATION = 200;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function placePiece(pos: number, player: Cell): void {
  dots[pos].visible = false;
  const [l, r, c] = fromIdx(pos);
  const mesh = new THREE.Mesh(pieceGeo, createPieceMaterial(player));
  mesh.position.copy(cellPos(l, r, c));
  mesh.scale.setScalar(0);
  scene.add(mesh);
  pieceMeshes[pos] = mesh;
  pieceAnims.push({ index: pos, startTime: performance.now() });
}

function clearPieces(): void {
  for (let i = 0; i < 64; i++) {
    if (pieceMeshes[i]) {
      scene.remove(pieceMeshes[i]!);
      pieceMeshes[i] = null;
    }
    dots[i].visible = true;
  }
  pieceAnims.length = 0;
}

// ---- Hover ----

const hoverMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), new THREE.MeshStandardMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.35 }));
hoverMesh.visible = false;
scene.add(hoverMesh);

// ---- Raycasting ----

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getHoveredCell(e: MouseEvent): number | null {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const targets = clickTargets.filter((t) => board[t.userData.cellIndex] === EMPTY);
  const intersects = raycaster.intersectObjects(targets);
  if (intersects.length > 0) return intersects[0].object.userData.cellIndex;
  return null;
}

// ---- Events ----

let pointerStart = { x: 0, y: 0 };

renderer.domElement.addEventListener("pointerdown", (e: PointerEvent) => {
  pointerStart = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener("mousemove", (e: MouseEvent) => {
  if (gameOver || aiThinking || pieceAnims.length > 0 || currentTurn !== playerPiece) {
    hoverMesh.visible = false;
    renderer.domElement.style.cursor = "default";
    return;
  }
  const cellIdx = getHoveredCell(e);
  if (cellIdx !== null) {
    const [l, r, c] = fromIdx(cellIdx);
    hoverMesh.position.copy(cellPos(l, r, c));
    (hoverMesh.material as THREE.MeshStandardMaterial).color.set(playerPiece === PLAYER_X ? 0x4a9eff : 0xff5555);
    hoverMesh.visible = true;
    renderer.domElement.style.cursor = "pointer";
  } else {
    hoverMesh.visible = false;
    renderer.domElement.style.cursor = "default";
  }
});

renderer.domElement.addEventListener("click", (e: MouseEvent) => {
  // Ignore clicks that were drags
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  if (dx * dx + dy * dy > 25) return;

  if (gameOver || aiThinking || pieceAnims.length > 0 || currentTurn !== playerPiece) return;
  const cellIdx = getHoveredCell(e);
  if (cellIdx !== null) applyPlayerMove(cellIdx);
});

// ---- Game flow ----

function applyPlayerMove(pos: number): void {
  board = makeMove(board, pos, playerPiece);
  placePiece(pos, playerPiece);
  hoverMesh.visible = false;

  const result = checkWin(board);
  if (result.winner !== EMPTY) {
    gameOver = true;
    winLine = result.line;
    highlightWinLine();
    showGameOver("You win!");
    return;
  }
  if (isFull(board)) {
    gameOver = true;
    showGameOver("Draw");
    return;
  }

  currentTurn = aiPiece;
  handleAiTurn();
}

const GAME_DELAY = 800;
let aiThinkStart = 0;

function handleAiTurn(): void {
  aiThinking = true;
  aiThinkStart = performance.now();
  statusEl.textContent = "Thinking...";
  worker.postMessage({
    board: board,
    aiPlayer: aiPiece,
    depth: parseInt(depthEl.value) || 3,
  });
}

function applyAiMove(pos: number): void {
  if (pos < 0) {
    aiThinking = false;
    return;
  }

  board = makeMove(board, pos, aiPiece);
  placePiece(pos, aiPiece);
  aiThinking = false;

  const result = checkWin(board);
  if (result.winner !== EMPTY) {
    gameOver = true;
    winLine = result.line;
    highlightWinLine();
    showGameOver("Computer wins");
    return;
  }
  if (isFull(board)) {
    gameOver = true;
    showGameOver("Draw");
    return;
  }

  currentTurn = playerPiece;
  statusEl.textContent = `Your turn (${playerPiece === PLAYER_X ? "blue" : "red"})`;
}

worker.onmessage = (e: MessageEvent<{ move: number }>) => {
  const elapsed = performance.now() - aiThinkStart;
  const remaining = GAME_DELAY - elapsed;
  if (remaining > 0) {
    setTimeout(() => applyAiMove(e.data.move), remaining);
  } else {
    applyAiMove(e.data.move);
  }
};

// ---- Win highlight ----

let winLineMesh: THREE.Line | null = null;

function highlightWinLine(): void {
  if (!winLine) return;

  // Highlight winning pieces
  for (const i of winLine) {
    const mesh = pieceMeshes[i];
    if (mesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = 0.5;
    }
  }

  // Draw a line through the winning pieces
  const winner = board[winLine[0]];
  const color = winner === PLAYER_X ? 0x4a9eff : 0xff5555;
  const points = winLine.map((i) => {
    const [l, r, c] = fromIdx(i);
    return cellPos(l, r, c);
  });

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  winLineMesh = new THREE.Line(geo, mat);
  scene.add(winLineMesh);
}

// ---- Game over overlay ----

function showGameOver(msg: string): void {
  statusEl.textContent = "Game over";
  overlayMsgEl.textContent = msg;
  overlayEl.classList.add("visible");
}

function hideGameOver(): void {
  overlayEl.classList.remove("visible");
}

// ---- New game ----

newGameEl.addEventListener("click", () => {
  playerGoesFirst = !playerGoesFirst;
  board = createBoard();
  playerPiece = playerGoesFirst ? PLAYER_X : PLAYER_O;
  aiPiece = playerGoesFirst ? PLAYER_O : PLAYER_X;
  currentTurn = PLAYER_X;
  gameOver = false;
  aiThinking = false;
  winLine = null;
  clearPieces();
  hideGameOver();
  if (winLineMesh) {
    scene.remove(winLineMesh);
    winLineMesh = null;
  }

  if (currentTurn === aiPiece) {
    handleAiTurn();
  } else {
    statusEl.textContent = `Your turn (${playerPiece === PLAYER_X ? "blue" : "red"})`;
  }
});

// ---- Resize ----

function resize(): void {
  const width = container.clientWidth;
  const height = width;
  renderer.setSize(width, height);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

// ---- Animation loop ----

function animate(): void {
  requestAnimationFrame(animate);

  // Piece scale-in animations
  const now = performance.now();
  for (let i = pieceAnims.length - 1; i >= 0; i--) {
    const anim = pieceAnims[i];
    const t = Math.min((now - anim.startTime) / PIECE_ANIM_DURATION, 1);
    const mesh = pieceMeshes[anim.index];
    if (mesh) mesh.scale.setScalar(easeOutBack(t));
    if (t >= 1) pieceAnims.splice(i, 1);
  }

  // Smooth camera reset (spherical interpolation to avoid cutting through center)
  if (cameraResetting) {
    const dt = Math.min((performance.now() - (lastFrame ?? now)) / 1000, 0.05);
    const t = 1 - Math.exp(-RESET_SPEED * dt);

    // Interpolate direction via slerp, distance via scalar lerp
    const curDir = camera.position.clone().sub(controls.target).normalize();
    const defDir = DEFAULT_CAM_POS.clone().sub(DEFAULT_CAM_TARGET).normalize();
    const curDist = camera.position.distanceTo(controls.target);
    const defDist = DEFAULT_CAM_POS.distanceTo(DEFAULT_CAM_TARGET);

    curDir.lerp(defDir, t).normalize();
    const newDist = curDist + (defDist - curDist) * t;

    controls.target.lerp(DEFAULT_CAM_TARGET, t);
    camera.position.copy(controls.target).addScaledVector(curDir, newDist);

    if (camera.position.distanceTo(DEFAULT_CAM_POS) < 0.15) {
      camera.position.copy(DEFAULT_CAM_POS);
      controls.target.copy(DEFAULT_CAM_TARGET);
      cameraResetting = false;
    }
  }
  lastFrame = now;

  controls.update();
  renderer.render(scene, camera);
}

// ---- Init ----

createGrid();
createDots();
createClickTargets();
resize();
animate();
statusEl.textContent = "Your turn (blue)";
