// Exact Kalah(6,4) solver, standard capture rules (capture only if the opposite pit is non-empty;
// game ends when either side is empty, each player keeps their own side).
// V(pits) = optimal (mover's future store gain - opponent's future store gain); independent of stores.
// Positions are canonical: side to move owns indices 0-5 (store 6), opponent 7-12 (store 13).
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>

#define MAXN 48
static uint64_t binom[64][16];
static uint64_t lvlOff[MAXN + 2];
static int DBN = -1;
static int8_t *db;

static void initBinom(void) {
  for (int n = 0; n < 64; n++) { binom[n][0] = 1; for (int k = 1; k < 16; k++) binom[n][k] = n == 0 ? 0 : binom[n - 1][k - 1] + binom[n - 1][k]; }
  lvlOff[0] = 0;
  for (int n = 0; n <= MAXN; n++) lvlOff[n + 1] = lvlOff[n] + binom[n + 11][11];
}

static inline int boardStones(const uint8_t *c) { int n = 0; for (int k = 0; k < 6; k++) n += c[k] + c[7 + k]; return n; }

static inline uint64_t rankOf(const uint8_t *c, int n) {
  uint64_t r = 0; int s = -1;
  for (int k = 0; k < 11; k++) { s += (k < 6 ? c[k] : c[k + 1]) + 1; r += binom[s][k + 1]; }
  return lvlOff[n] + r;
}

// Applies move i for side 0 in place (stores must be 0 on entry). Returns 0 turn passes, 1 extra turn, 2 game over.
static inline int apply(uint8_t *c, int i) {
  int n = c[i]; c[i] = 0; int pos = i;
  while (n > 0) { pos++; if (pos == 14) pos = 0; if (pos == 13) continue; c[pos]++; n--; }
  if (pos < 6 && c[pos] == 1) { int o = 12 - pos; if (c[o] > 0) { c[6] += c[o] + 1; c[pos] = 0; c[o] = 0; } }
  int s0 = 0, s1 = 0;
  for (int k = 0; k < 6; k++) { s0 += c[k]; s1 += c[7 + k]; }
  if (s0 == 0 || s1 == 0) { c[6] += s0; c[13] += s1; for (int k = 0; k < 6; k++) { c[k] = 0; c[7 + k] = 0; } return 2; }
  return pos == 6 ? 1 : 0;
}

static inline void swapSides(const uint8_t *c, uint8_t *o) { for (int k = 0; k < 14; k++) o[k] = c[(k + 7) % 14]; }

// ---- Endgame database ----
static int8_t dbCompute(const uint8_t *c, int n);
static int8_t dbGet(const uint8_t *c, int n) {
  uint64_t idx = rankOf(c, n);
  if (db[idx] != -128) return db[idx];
  return dbCompute(c, n);
}
static int8_t dbCompute(const uint8_t *c, int n) {
  int s0 = 0, s1 = 0;
  for (int k = 0; k < 6; k++) { s0 += c[k]; s1 += c[7 + k]; }
  int best;
  if (s0 == 0 || s1 == 0) best = s0 - s1;
  else {
    best = -128;
    for (int i = 0; i < 6; i++) {
      if (!c[i]) continue;
      uint8_t ch[14]; memcpy(ch, c, 14); ch[6] = ch[13] = 0;
      int r = apply(ch, i), g = ch[6] - ch[13], v;
      ch[6] = ch[13] = 0;
      if (r == 2) v = g;
      else if (r == 1) v = g + dbGet(ch, boardStones(ch));
      else { uint8_t sw[14]; swapSides(ch, sw); v = g - dbGet(sw, boardStones(sw)); }
      if (v > best) best = v;
    }
  }
  db[rankOf(c, n)] = (int8_t)best;
  return (int8_t)best;
}
static uint8_t genC[14];
static void genLevel(int k, int rem, int n) {
  if (k == 11) { genC[12] = rem; if (db[rankOf(genC, n)] == -128) dbCompute(genC, n); return; }
  int slot = k < 6 ? k : k + 1;
  for (int v = 0; v <= rem; v++) { genC[slot] = v; genLevel(k + 1, rem - v, n); }
}
static void buildDb(int N, const char *path) {
  DBN = N;
  db = malloc(lvlOff[N + 1]);
  FILE *f = fopen(path, "rb");
  if (f && fread(db, 1, lvlOff[N + 1], f) == lvlOff[N + 1]) { fclose(f); fprintf(stderr, "loaded db N=%d (%llu entries)\n", N, (unsigned long long)lvlOff[N + 1]); return; }
  if (f) fclose(f);
  memset(db, -128, lvlOff[N + 1]);
  memset(genC, 0, 14);
  for (int n = 0; n <= N; n++) { genLevel(0, n, n); fprintf(stderr, "db level %d done (%llu)\n", n, (unsigned long long)binom[n + 11][11]); }
  f = fopen(path, "wb"); fwrite(db, 1, lvlOff[N + 1], f); fclose(f);
}

// ---- Search above the database ----
typedef struct { uint64_t key; int8_t lo, hi; uint8_t move, n; } TTE;
#define WAYS 4
typedef struct { TTE *t; uint64_t mask; uint64_t nodes; } Ctx;
static uint64_t zob[12][MAXN + 1];

static inline uint64_t hashOf(const uint8_t *c) {
  uint64_t h = 0; for (int k = 0; k < 6; k++) { h ^= zob[k][c[k]]; h ^= zob[6 + k][c[7 + k]]; } return h;
}

static int search(Ctx *x, const uint8_t *c, int alpha, int beta) {
  int n = boardStones(c);
  if (n <= DBN) return dbGet(c, n);
  x->nodes++;
  int s0 = 0, s1 = 0;
  for (int k = 0; k < 6; k++) { s0 += c[k]; s1 += c[7 + k]; }
  if (s0 == 0 || s1 == 0) return s0 - s1;
  uint64_t h = hashOf(c);
  TTE *b = &x->t[(h & x->mask) * WAYS];
  int lo = -n, hi = n, ttm = -1;
  TTE *e = NULL;
  for (int w = 0; w < WAYS; w++) if (b[w].key == h) { e = &b[w]; break; }
  if (e) { lo = e->lo; hi = e->hi; ttm = e->move; }
  if (lo >= beta) return lo;
  if (hi <= alpha) return hi;
  if (lo == hi) return lo;
  if (alpha < lo) alpha = lo;
  if (beta > hi) beta = hi;
  int a0 = alpha;

  int order[6], key[6], cnt = 0;
  for (int i = 5; i >= 0; i--) {
    int s = c[i]; if (!s) continue;
    int k;
    if (i == ttm) k = 10000;
    else if (s % 13 == 6 - i) k = 1000 + i;
    else if (s < 13 && i + s < 6 && c[i + s] == 0 && c[12 - (i + s)] > 0) k = 100 + c[12 - (i + s)];
    else if (s == 13) k = 100 + c[12 - i] + 1;
    else k = i;
    int j = cnt++;
    while (j > 0 && key[j - 1] < k) { key[j] = key[j - 1]; order[j] = order[j - 1]; j--; }
    key[j] = k; order[j] = i;
  }
  int best = -128, bm = order[0];
  for (int m = 0; m < cnt; m++) {
    int i = order[m];
    uint8_t ch[14]; memcpy(ch, c, 14); ch[6] = ch[13] = 0;
    int r = apply(ch, i), g = ch[6] - ch[13], v;
    ch[6] = ch[13] = 0;
    if (r == 2) v = g;
    else if (r == 1) v = g + search(x, ch, alpha - g, beta - g);
    else { uint8_t sw[14]; swapSides(ch, sw); v = g - search(x, sw, g - beta, g - alpha); }
    if (v > best) { best = v; bm = i; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
  }
  // Re-probe: the slot may have been reused during the subtree search.
  e = NULL;
  for (int w = 0; w < WAYS; w++) if (b[w].key == h) { e = &b[w]; break; }
  if (!e) {
    e = &b[0];
    for (int w = 0; w < WAYS; w++) { if (b[w].key == 0) { e = &b[w]; break; } if (b[w].n < e->n) e = &b[w]; }
    e->key = h; e->lo = -n; e->hi = n; e->n = n;
  }
  if (best <= a0) { if (best < e->hi) e->hi = best; }
  else if (best >= beta) { if (best > e->lo) e->lo = best; }
  else { e->lo = e->hi = best; }
  e->move = bm;
  return best;
}

static int mtdf(Ctx *x, const uint8_t *c, int guess) {
  int g = guess, lo = -100, hi = 100;
  while (lo < hi) { int beta = g == lo ? g + 1 : g; g = search(x, c, beta - 1, beta); if (g < beta) hi = g; else lo = g; }
  return g;
}

// Quick depth-limited estimate (exact below the database), used as the MTD(f) first guess.
static int guessSearch(const uint8_t *c, int depth, int alpha, int beta) {
  int n = boardStones(c);
  if (n <= DBN) return dbGet(c, n);
  int s0 = 0, s1 = 0;
  for (int k = 0; k < 6; k++) { s0 += c[k]; s1 += c[7 + k]; }
  if (s0 == 0 || s1 == 0) return s0 - s1;
  if (depth == 0) return 0;
  int best = -128;
  for (int i = 5; i >= 0; i--) {
    if (!c[i]) continue;
    uint8_t ch[14]; memcpy(ch, c, 14); ch[6] = ch[13] = 0;
    int r = apply(ch, i), g = ch[6] - ch[13], v;
    ch[6] = ch[13] = 0;
    if (r == 2) v = g;
    else if (r == 1) v = g + guessSearch(ch, depth - 1, alpha - g, beta - g);
    else { uint8_t sw[14]; swapSides(ch, sw); v = g - guessSearch(sw, depth - 1, g - beta, g - alpha); }
    if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
  }
  return best;
}

// Value of a single move for the mover: >= target ? (zero-window) or exact.
static int moveValue(Ctx *x, const uint8_t *c, int i, int exactGuess, int *exact) {
  uint8_t ch[14]; memcpy(ch, c, 14); ch[6] = ch[13] = 0;
  int r = apply(ch, i), g = ch[6] - ch[13];
  ch[6] = ch[13] = 0;
  if (r == 2) return g;
  if (r == 1) return g + mtdf(x, ch, exactGuess - g);
  uint8_t sw[14]; swapSides(ch, sw); return g - mtdf(x, sw, g - exactGuess);
}
static int moveAtLeast(Ctx *x, const uint8_t *c, int i, int target) {
  uint8_t ch[14]; memcpy(ch, c, 14); ch[6] = ch[13] = 0;
  int r = apply(ch, i), g = ch[6] - ch[13];
  ch[6] = ch[13] = 0;
  if (r == 2) return g >= target;
  if (r == 1) return g + search(x, ch, target - g - 1, target - g) >= target;
  uint8_t sw[14]; swapSides(ch, sw); return g - search(x, sw, g - target, g - target + 1) >= target;
}

// Position value and one optimal move.
static int solveBest(Ctx *x, const uint8_t *c0, int *bestMove) {
  uint8_t c[14]; memcpy(c, c0, 14); c[6] = c[13] = 0;
  int guess = guessSearch(c, 10, -100, 100);
  int V = mtdf(x, c, guess);
  // The highest-numbered move that reaches V, so the book doesn't depend on search order.
  *bestMove = -1;
  for (int i = 5; i >= 0 && *bestMove < 0; i--) if (c[i] && moveAtLeast(x, c, i, V)) *bestMove = i;
  return V;
}

int main(int argc, char **argv) {
  // usage: solver N dbpath ttBits mode < positions
  //   mode best:  "14 ints"         -> "V move secs"
  //   mode grade: "14 ints + move"  -> "V moveValue secs"   (moveValue exact only when < V)
  initBinom();
  int N = atoi(argv[1]); int ttBits = atoi(argv[3]); int grade = argc > 4 && !strcmp(argv[4], "grade");
  uint64_t s = 0x9E3779B97F4A7C15ull;
  for (int k = 0; k < 12; k++) for (int v = 0; v <= MAXN; v++) { s ^= s << 13; s ^= s >> 7; s ^= s << 17; zob[k][v] = s | 1; }
  double t0 = omp_get_wtime();
  buildDb(N, argv[2]);
  fprintf(stderr, "db ready in %.1fs\n", omp_get_wtime() - t0);
  int cap = 1 << 16, np = 0; uint8_t (*pos)[15] = malloc((size_t)cap * 15);
  int v[15];
  for (;;) {
    int got = 0;
    for (int k = 0; k < 14 + grade; k++) got += scanf("%d", &v[k]) == 1;
    if (got < 14 + grade) break;
    if (np == cap) { cap *= 2; pos = realloc(pos, (size_t)cap * 15); }
    for (int k = 0; k < 14 + grade; k++) pos[np][k] = v[k];
    np++;
  }
  int (*out)[2] = malloc((size_t)np * sizeof(*out));
  double *secs = malloc(np * sizeof(double));
  uint64_t totalNodes = 0;
  #pragma omp parallel reduction(+:totalNodes)
  {
    Ctx x; x.mask = (1ull << ttBits) - 1; x.t = calloc((size_t)(x.mask + 1) * WAYS, sizeof(TTE)); x.nodes = 0;
    #pragma omp for schedule(dynamic, 1)
    for (int p = 0; p < np; p++) {
      double a = omp_get_wtime();
      int bm;
      int V = solveBest(&x, pos[p], &bm);
      out[p][0] = V;
      if (grade) {
        int m = pos[p][14];
        uint8_t c[14]; memcpy(c, pos[p], 14); c[6] = c[13] = 0;
        out[p][1] = moveAtLeast(&x, c, m, V) ? V : moveValue(&x, c, m, V, NULL);
      } else out[p][1] = bm;
      secs[p] = omp_get_wtime() - a;
    }
    totalNodes += x.nodes;
    free(x.t);
  }
  for (int p = 0; p < np; p++) printf("%d %d %.3f\n", out[p][0], out[p][1], secs[p]);
  fprintf(stderr, "solved %d positions in %.1fs, %llu nodes\n", np, omp_get_wtime() - t0, (unsigned long long)totalNodes);
  return 0;
}
