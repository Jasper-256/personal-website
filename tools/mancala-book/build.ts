// Builds public/mancala-book.bin, the Max opening book: for every position the AI can face in
// its first turns (any opponent replies, the AI playing book moves), an exactly-optimal move.
//
// Run from the repo root (needs gcc with OpenMP, ~3 GB of RAM and a few minutes):
//   gcc -O3 -march=native -fopenmp -o tools/mancala-book/solver tools/mancala-book/solver.c
//   npx esbuild tools/mancala-book/build.ts --bundle --platform=node --format=esm --outfile=tools/mancala-book/build.mjs
//   node --max-old-space-size=24000 tools/mancala-book/build.mjs
//
// The solver precomputes exact values for every position with up to DB_N stones in pits
// (1.25 GB for 24, cached in CACHE_DIR) and solves everything above that by exact search.
import { createBoard, playMove, legalMoves } from "../../src/scripts/mancala-board";
import { bookKey, BOOK_MIN_STONES } from "../../src/scripts/mancala-book";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";

const CACHE_DIR = process.env.CACHE_DIR ?? `${homedir()}/.cache/mancala-book`;
mkdirSync(CACHE_DIR, { recursive: true });
const SOLVER = process.env.SOLVER ?? "tools/mancala-book/solver";
const DB_N = Number(process.env.DB_N ?? 24);
const DB = `${CACHE_DIR}/db${DB_N}.bin`;
const CACHE = `${CACHE_DIR}/solved.txt`;
const ROUNDS_FIRST = Number(process.env.ROUNDS_FIRST ?? 12);
const ROUNDS_SECOND = Number(process.env.ROUNDS_SECOND ?? 5);
const OUT = process.env.OUT ?? "public/mancala-book.bin";

const key = (c: number[]) => c.slice(0, 6).join(",") + "|" + c.slice(7, 13).join(",");
const norm = (c: number[]) => {
  const d = c.slice();
  d[6] = 0;
  d[13] = 0;
  return d;
};
const swap = (c: number[]) => [...c.slice(7), ...c.slice(0, 7)];

// Exact [value, optimal move] per position, cached on disk across runs.
const solved = new Map<string, number[]>();
if (existsSync(CACHE))
  for (const line of readFileSync(CACHE, "utf8").split("\n")) {
    if (!line) continue;
    const [k, v] = line.split(" ");
    solved.set(k, v.split(",").map(Number));
  }
function solveBatch(cs: number[][]): void {
  const todo = cs.filter((c) => !solved.has(key(c)));
  if (!todo.length) return;
  const t0 = Date.now();
  const res = spawnSync(SOLVER, [String(DB_N), DB, "22", "best"], { input: todo.map((c) => norm(c).join(" ")).join("\n") + "\n", maxBuffer: 1 << 30 });
  if (res.status !== 0) throw new Error("solver failed: " + res.stderr);
  const lines = res.stdout.toString().trim().split("\n");
  let cache = "";
  lines.forEach((l, i) => {
    const vals = l.split(" ").slice(0, 2).map(Number); // [value, optimal move]
    solved.set(key(todo[i]), vals);
    cache += `${key(todo[i])} ${vals.join(",")}\n`;
  });
  appendFileSync(CACHE, cache);
  const secs = lines.map((l) => Number(l.split(" ")[2]));
  console.log(`  solved ${todo.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s (max single ${secs.reduce((a, b) => Math.max(a, b), 0).toFixed(1)}s)`);
}
const valuesOf = (c: number[]) => solved.get(key(c));

// All positions where the AI (side 0) is to move after the opponent finishes its turn.
function oppReplies(c: number[], out: Map<string, number[]>): void {
  for (const m of legalMoves(c, 1)) {
    const d = c.slice();
    const r = playMove(d, 1, m);
    if (r.gameOver) continue;
    if (r.next === 1) oppReplies(d, out);
    else out.set(key(d), norm(d));
  }
}

{
  const book = new Map<string, number>();
  const visited = new Set<string>();
  let storedTotal = 0;
  const pitStones = (c: number[]) => c.reduce((a, v, i) => a + (i % 7 === 6 ? 0 : v), 0);
  for (const [name, rounds, start] of [
    ["AI first", ROUNDS_FIRST, true],
    ["AI second", ROUNDS_SECOND, false],
  ] as const) {
    let frontier = new Map<string, number[]>();
    const b0 = createBoard();
    if (start) frontier.set(key(b0), norm(b0));
    else oppReplies(swap(b0), frontier);
    for (let round = 1; round <= rounds; round++) {
      const next = new Map<string, number[]>();
      let pending = [...frontier.values()].filter((c) => !visited.has(key(c)));
      let decisions = 0;
      let stored = 0;
      while (pending.length) {
        pending.forEach((c) => visited.add(key(c)));
        solveBatch(pending.filter((c) => legalMoves(c, 0).length > 1));
        const again = new Map<string, number[]>();
        for (const c of pending) {
          const legal = legalMoves(c, 0);
          let m = legal[0];
          if (legal.length > 1) {
            m = valuesOf(c)![1];
            if (!legal.includes(m)) throw new Error("solver returned an illegal move for " + key(c));
            book.set(key(c), m);
            decisions++;
            if (pitStones(c) >= BOOK_MIN_STONES) stored++;
          }
          const d = c.slice();
          const r = playMove(d, 0, m);
          if (r.gameOver) continue;
          if (r.next === 0) {
            if (!visited.has(key(d))) again.set(key(d), norm(d));
          } else oppReplies(d, next);
        }
        pending = [...again.values()];
      }
      storedTotal += stored;
      console.log(`${name} turn ${round}: ${decisions} positions, ${stored} stored (total stored ${storedTotal}, ${((storedTotal * 6) / 1000).toFixed(0)} KB)`);
      frontier = next;
    }
  }

  // Serialize: sorted fingerprints + move/check bytes. Positions that collide on all 37 bits
  // with a different move are dropped (the search handles them).
  const rows: [number, number][] = [];
  for (const [k, m] of book) {
    const [a, b] = k.split("|").map((s) => s.split(",").map(Number));
    const c = [...a, 0, ...b, 0];
    if (a.reduce((x, y) => x + y, 0) + b.reduce((x, y) => x + y, 0) < BOOK_MIN_STONES) continue;
    const [fp, check] = bookKey(c);
    rows.push([fp, (check << 3) | m]);
  }
  rows.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const dedup: [number, number][] = [];
  let dropped = 0;
  for (let i = 0; i < rows.length; i++) {
    const same = rows.filter((r, j) => j >= i - 3 && j <= i + 3 && r[0] === rows[i][0] && r[1] >> 3 === rows[i][1] >> 3);
    if (same.some((r) => (r[1] & 7) !== (rows[i][1] & 7))) {
      dropped++;
      continue;
    }
    if (dedup.length && dedup.at(-1)![0] === rows[i][0] && dedup.at(-1)![1] === rows[i][1]) continue;
    dedup.push(rows[i]);
  }
  const n = dedup.length;
  const buf = new ArrayBuffer(n * 6);
  const fps = new Uint32Array(buf, 0, n);
  const info = new Uint16Array(buf, n * 4, n);
  dedup.forEach(([fp, inf], i) => {
    fps[i] = fp;
    info[i] = inf;
  });
  writeFileSync(OUT, new Uint8Array(buf));
  console.log(`wrote ${OUT}: ${n} entries, ${((n * 6) / 1e6).toFixed(2)} MB (${dropped} dropped for fingerprint clashes)`);
  // Keep every solved book position (including ones below the size cutoffs) for testing.
  writeFileSync(`${CACHE_DIR}/book-positions.txt`, [...book].map(([k, m]) => `${k} ${m}`).join("\n") + "\n");
}
