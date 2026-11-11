// Everything on /ai-frontier-forecast is derived from Epoch AI's raw CSVs (src/data/epoch/, refreshed with
// `npm run update:epoch`) by the formulas below. Nothing here is hand-entered model data, so new
// data flows through to the frontier, trend line, milestone dates and time-horizon predictions.

// ---------------------------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------------------------

/**
 * The frontier series starts at GPT-4's release. Epoch's index begins in Feb 2023 with LLaMA,
 * which would only count as "frontier" because earlier leading models (GPT-3.5, PaLM) aren't in
 * the index, so models released before this date are ignored.
 */
export const FRONTIER_START_DATE = "2023-03-14";

/**
 * Models left out of the frontier. OpenAI's Pro tiers (GPT-5 Pro, GPT-5.2 Pro, o3-pro, ...) are
 * the same models as their base versions run with much more parallel test-time compute, so they
 * mark a pricier inference setting rather than a new model, and they'd otherwise claim most of
 * OpenAI's records. Matched by name so future Pro releases are excluded automatically.
 */
export const EXCLUDED_MODELS: RegExp[] = [/^GPT-[\d.]+ Pro\b/i, /^o\d+-pro\b/i];

/**
 * Release dates that replace Epoch's. Keep these when refreshing the data.
 *
 * Use public release dates instead of snapshot dates or later availability dates:
 * - Claude 3 Opus: https://www.anthropic.com/news/claude-3-family
 * - Gemini 2.5 Pro: https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-model-thinking-updates-march-2025/
 *
 * GPT-4 Turbo (Nov 2023): Epoch dates this model family 2024-01-25 because it folds in
 * gpt-4-0125-preview (a January 2024 update, whose METR time horizon feeds the score). The family
 * is named for, and mostly scored on, the original GPT-4 Turbo (gpt-4-1106-preview), released
 * 2023-11-06.
 */
export const DATE_OVERRIDES: Record<string, string> = {
  "GPT-4 Turbo (Nov 2023)": "2023-11-06",
  "Claude 3 Opus": "2024-03-04",
  "Gemini 2.5 Pro (Mar 2025)": "2025-03-25",
  // API launch (private beta), rather than the paper date: https://openai.com/index/openai-api/
  "GPT-3 175B (davinci)": "2020-06-11",
};

/** Frontier models that get a direct label on wide screens (the first and latest always do). */
export const LABELLED_MODELS = ["GPT-3 175B (davinci)", "davinci-002", "GPT-4 (Mar 2023)", "Claude 3 Opus", "o1-mini", "GPT-5", "Claude Fable 5"];

/**
 * Only publicly available models are charted: models with these Epoch "Model accessibility" values
 * are left out (and so can't set a record). Kept: API access, open weights, hosted apps without an
 * API, and "Unknown" (mostly hosted Chinese models and PaLM 2, all publicly usable).
 */
export const EXCLUDED_ACCESS = ["Unreleased", "Limited access"];

/**
 * Models from before Epoch's index (it starts in Feb 2023) get an ECI estimated from the older
 * benchmark scores in Epoch's archive (src/data/epoch/benchmarks/). For each benchmark, ECI is
 * regressed on the chance-adjusted logit of the score across models Epoch does score; an old
 * model's estimate is the precision-weighted mean of its per-benchmark predictions, and lo/hi are
 * ±1 standard error. Applied to models Epoch does score (LLaMA-7B to 65B, GPT-4, GPT-3.5 Turbo)
 * this lands within ~4 points. Estimated models join the frontier and the trend fit like any
 * other, and the usual frontier rules decide which of them set records.
 *
 * Each entry: the archive file stem, its score column, and the score a random guess gets.
 */
export const ESTIMATE_BENCHMARKS = [
  { file: "mmlu", column: "EM", chance: 0.25 },
  { file: "hella_swag", column: "Overall accuracy", chance: 0.25 },
  { file: "piqa", column: "Score", chance: 0.5 },
  { file: "bool_q", column: "Score", chance: 0.5 },
  { file: "wino_grande", column: "Accuracy", chance: 0.5 },
  { file: "arc_ai2", column: "Challenge score", chance: 0.25 },
  { file: "open_book_qa", column: "Accuracy", chance: 0.25 },
  { file: "lambada", column: "Score", chance: 0 },
  { file: "trivia_qa", column: "EM", chance: 0 },
  { file: "gsm8k", column: "EM", chance: 0 },
];

/**
 * An old model needs scores on at least this many of ESTIMATE_BENCHMARKS to be estimated. This
 * leaves out T5, whose only usable score is a fine-tuned BoolQ result.
 */
export const ESTIMATE_MIN_BENCHMARKS = 3;

/** Published scores missing from Epoch's archive, added to it before estimating (0-1 scale). */
export const SUPPLEMENTAL_SCORES = [
  // GPT-3 175B few-shot MMLU, from the MMLU paper (Hendrycks et al., 2021, Table 1): https://arxiv.org/abs/2009.03300
  { model: "GPT-3 175B (davinci)", benchmark: "mmlu", score: 0.439 },
];

/** Readable chart names for Epoch's model groups. */
export const NAME_OVERRIDES: Record<string, string> = {
  "GPT-2 (1.5B)": "GPT-2",
  "GPT-3 175B (davinci)": "GPT-3",
  "InstructGPT 175B": "InstructGPT (text-davinci-001)",
  "davinci-002": "GPT-3.5 (text-davinci-002)",
  "davinci-003": "ChatGPT (text-davinci-003)",
};

/**
 * How the frontier is extrapolated. "exponential" fits ln(ECI) linearly on release date
 * (constant % growth per year); "linear" fits ECI itself (constant points per year). The trend
 * line, milestone dates and page text all follow this setting.
 */
export const TREND_KIND: TrendKind = "linear";

/**
 * ECI levels whose date on the trend line is shown, with a countdown, at the top of the page.
 *
 * Thresholds are the AI Futures Model's (https://www.aifuturesmodel.com/): the model's simulated
 * ECI at the date it reaches each milestone. These come from the Q3.5 timelines update run
 * (https://blog.aifutures.org/p/q35-timelines-update-looks-like-the), linked from the post as
 * https://www.aifuturesmodel.com/p?v=2&base=eli-08-16-26&ed=q3.5&rcl=-0.5&suard=7.052322627593112&eudt=3.0130366136756046&ila=60&icaec=1.5
 * As of 2026-11-10 it reaches Superhuman AI Researcher at ECI ~180.93 (Apr 2027) and Top Expert
 * Dominating AI (TED-AI) at ~202.93 (Jun 2027), rounded here to 181 and 203. These use the run's
 * linear ECI-to-log-effective-compute mapping at each milestone, rather than interpolation
 * between its coarse chart samples (which overstates the TED-AI score as ~206.9).
 */
export const MILESTONES = [
  { label: "Superhuman AI Researcher", eci: 181 },
  { label: "Top Expert Dominating AI", eci: 203 },
];

/** Where the chart's "Modern" zoom starts. Display only: the data and trend fit are unchanged. */
export const MODERN_VIEW_START = "2024-01-01";

/** METR suite preferred when a model has several time-horizon measurements. */
const PREFERRED_METR_VERSION = "METR-Horizon-v1.1";

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export interface FrontierPoint {
  name: string;
  org: string;
  date: string;
  eci: number;
  lo: number | null;
  hi: number | null;
  label: boolean;
  /** Score estimated from older benchmarks (see ESTIMATE_BENCHMARKS), not Epoch's ECI. */
  estimated: boolean;
}

/** y = intercept + slope * x */
export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export type TrendKind = "linear" | "exponential";

/** A fit of ECI on decimal year. For "exponential", `fit` is of ln(ECI), so ECI = e^(intercept + slope * year). */
export interface Trend {
  kind: TrendKind;
  fit: LinearFit;
}

export interface Milestone {
  label: string;
  eci: number;
  /** Epoch milliseconds when the trend line reaches `eci`, or null if the trend never does. */
  date: number | null;
}

export interface Forecast {
  points: FrontierPoint[];
  /** ECI as a function of decimal year (see `toYear`). */
  trend: Trend;
  /** log2(50% time horizon in minutes) as a function of ECI. */
  horizon: LinearFit;
  milestones: Milestone[];
}

type Row = Record<string, string>;

// ---------------------------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------------------------

const YEAR_MS = 365.2425 * 86_400_000;

/** ISO date or epoch ms → decimal year. */
export function toYear(date: string | number): number {
  const t = typeof date === "number" ? date : Date.parse(`${date}T00:00:00Z`);
  const y = new Date(t).getUTCFullYear();
  return y + (t - Date.UTC(y, 0, 1)) / YEAR_MS;
}

/** Decimal year → epoch ms (inverse of `toYear`). */
export function fromYear(x: number): number {
  const y = Math.floor(x);
  return Date.UTC(y, 0, 1) + (x - y) * YEAR_MS;
}

/** Ordinary least squares fit of ys on xs. */
export function linearFit(xs: number[], ys: number[]): LinearFit {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: (sxy * sxy) / (sxx * syy), n };
}

export const evaluate = (fit: LinearFit, x: number) => fit.intercept + fit.slope * x;

/** Where the fit reaches y, or null if it never does going forward. */
export const solve = (fit: LinearFit, y: number) => (fit.slope > 0 ? (y - fit.intercept) / fit.slope : null);

/** Fit the frontier trend: ECI (or ln ECI) on decimal year. */
export function fitTrend(kind: TrendKind, years: number[], ecis: number[]): Trend {
  return { kind, fit: linearFit(years, kind === "exponential" ? ecis.map(Math.log) : ecis) };
}

/** Trend ECI at a decimal year. */
export const trendAt = (t: Trend, year: number) => (t.kind === "exponential" ? Math.exp(evaluate(t.fit, year)) : evaluate(t.fit, year));

/** Decimal year when the trend reaches `eci`, or null if it never does going forward. */
export const trendYear = (t: Trend, eci: number) =>
  t.kind === "exponential" ? (eci > 0 ? solve(t.fit, Math.log(eci)) : null) : solve(t.fit, eci);

/** Growth rate of the trend, e.g. "+11.4% / year" or "+15.6 ECI / year". */
export function trendRate(t: Trend): string {
  const rate = t.kind === "exponential" ? (Math.exp(t.fit.slope) - 1) * 100 : t.fit.slope;
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(1)}${t.kind === "exponential" ? "%" : " ECI"} / year`;
}

/** Instantaneous ECI points per year on the trend at a decimal year (constant for a linear trend). */
export const trendSlopeAt = (t: Trend, year: number) => (t.kind === "exponential" ? t.fit.slope * trendAt(t, year) : t.fit.slope);

/** e.g. "+18.5 ECI / year". */
export const formatEciRate = (rate: number) => `${rate >= 0 ? "+" : ""}${rate.toFixed(1)} ECI / year`;

/** Predicted METR 50% time horizon, in minutes, for a model with this ECI. */
export const horizonMinutes = (horizon: LinearFit, eci: number) => 2 ** evaluate(horizon, eci);

/**
 * Models that scored higher than every model released before them, from FRONTIER_START_DATE on
 * (plus the estimated older models, whatever their date). Models with an EXCLUDED_ACCESS level are skipped.
 * Models released the same day compete with each other; only the best can set the record.
 */
export function frontierModels(eciRows: Row[], estimates: EstimatedModel[] = []): FrontierPoint[] {
  const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v));
  const models = eciRows
    .map((r) => ({
      name: r["Display name"] || r["Model"],
      key: r["Model"],
      org: r["Organization"],
      access: r["Model accessibility"],
      date: DATE_OVERRIDES[r["Model"]] ?? r["date"],
      eci: num(r["eci"]),
      lo: num(r["eci_ci_low"]),
      hi: num(r["eci_ci_high"]),
    }))
    .filter((m): m is typeof m & { eci: number } => m.eci !== null && Number.isFinite(m.eci) && /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .filter((m) => m.date >= FRONTIER_START_DATE)
    .filter((m) => !EXCLUDED_MODELS.some((re) => re.test(m.key)))
    .map((m) => ({ ...m, estimated: false }))
    .concat(estimates.map((e) => ({ ...e, date: DATE_OVERRIDES[e.key] ?? e.date, estimated: true })))
    .filter((m) => !EXCLUDED_ACCESS.includes(m.access))
    .sort((a, b) => a.date.localeCompare(b.date) || b.eci - a.eci);

  const frontier: FrontierPoint[] = [];
  for (const m of models) {
    if (frontier.length && m.eci <= frontier[frontier.length - 1].eci) continue;
    frontier.push({
      name: m.name,
      org: m.org,
      date: m.date,
      eci: m.eci,
      lo: m.lo,
      hi: m.hi,
      label: LABELLED_MODELS.includes(m.key),
      estimated: m.estimated,
    });
  }
  if (frontier.length) {
    frontier[0].label = true;
    frontier[frontier.length - 1].label = true;
  }
  return frontier;
}

export interface EstimatedModel {
  key: string;
  name: string;
  org: string;
  date: string;
  access: string;
  eci: number;
  lo: number;
  hi: number;
  /** How many benchmarks the estimate draws on. */
  benchmarks: number;
}

/**
 * ECI estimates for models released before FRONTIER_START_DATE that Epoch doesn't score, from
 * their scores on ESTIMATE_BENCHMARKS (see there for the method).
 */
export function estimateOldModels(eciRows: Row[], metadataRows: Row[], benchmarkRows: Record<string, Row[]>): EstimatedModel[] {
  const eciByModel = new Map(eciRows.filter((r) => r["eci"]).map((r) => [r["Model"], Number(r["eci"])]));
  const metadata = new Map(metadataRows.map((r) => [r["model_version"], r]));
  const groupOf = (version: string) => {
    const m = metadata.get(version);
    if (!m) return version;
    if (eciByModel.has(m["model_group"])) return m["model_group"];
    if (eciByModel.has(m["display_name"])) return m["display_name"];
    return m["model_group"] || m["display_name"] || version;
  };

  // Best score per model group on each benchmark, plus where each group's date/org/access come from
  const scores = new Map<string, Map<string, number>>(ESTIMATE_BENCHMARKS.map((b) => [b.file, new Map()]));
  const info = new Map<string, { date: string; org: string; access: string }>();
  for (const { file, column } of ESTIMATE_BENCHMARKS) {
    for (const r of benchmarkRows[file] ?? []) {
      let score = Number(r[column]);
      if (!r[column] || !Number.isFinite(score)) continue;
      if (score > 1.5) score /= 100;
      const version = r["Model version"];
      const key = groupOf(version);
      const best = scores.get(file)!;
      best.set(key, Math.max(score, best.get(key) ?? -Infinity));
      const m = metadata.get(version);
      const date = m?.["date"] || r["Release date"] || "";
      const prev = info.get(key);
      info.set(key, {
        date: prev?.date && (!date || prev.date <= date) ? prev.date : date,
        org: prev?.org || m?.["organization"] || r["Organization"] || "",
        access: prev?.access || m?.["accessibility"] || "",
      });
    }
  }
  for (const { model, benchmark, score } of SUPPLEMENTAL_SCORES) scores.get(benchmark)?.set(model, score);

  // Chance-adjusted logit, clamped so near-floor and near-ceiling scores stay finite
  const logit = (score: number, chance: number) => {
    const p = Math.min(Math.max((score - chance) / (1 - chance), 0.02), 0.98);
    return Math.log(p / (1 - p));
  };

  // Per benchmark: ECI ~ logit(score) over Epoch-scored models that aren't at the ceiling
  const fits = ESTIMATE_BENCHMARKS.flatMap(({ file, chance }) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [key, score] of scores.get(file)!) {
      const eci = eciByModel.get(key);
      if (eci === undefined || (score - chance) / (1 - chance) >= 0.97) continue;
      xs.push(logit(score, chance));
      ys.push(eci);
    }
    if (xs.length < 8) return [];
    const fit = linearFit(xs, ys);
    const sd = Math.sqrt(xs.reduce((s, x, i) => s + (ys[i] - evaluate(fit, x)) ** 2, 0) / (xs.length - 2));
    return [{ file, chance, fit, sd }];
  });

  const estimates: EstimatedModel[] = [];
  for (const [key, { date, org, access }] of info) {
    if (eciByModel.has(key) || !date || date >= FRONTIER_START_DATE) continue;
    const preds = fits.flatMap(({ file, chance, fit, sd }) => {
      const score = scores.get(file)!.get(key);
      return score === undefined ? [] : [{ eci: evaluate(fit, logit(score, chance)), weight: 1 / sd ** 2 }];
    });
    if (preds.length < ESTIMATE_MIN_BENCHMARKS) continue;
    const total = preds.reduce((s, p) => s + p.weight, 0);
    const eci = preds.reduce((s, p) => s + p.eci * p.weight, 0) / total;
    const se = 1 / Math.sqrt(total);
    estimates.push({ key, name: NAME_OVERRIDES[key] ?? key, org, date, access, eci, lo: eci - se, hi: eci + se, benchmarks: preds.length });
  }
  return estimates.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * log2(METR 50% time horizon) regressed on ECI. One point per model that has both: METR rows
 * are matched to ECI models through Epoch's model metadata, and a model with several
 * measurements uses its PREFERRED_METR_VERSION one, else its longest.
 */
export function horizonFit(eciRows: Row[], metrRows: Row[], metadataRows: Row[]): LinearFit {
  const eciByModel = new Map(eciRows.map((r) => [r["Model"], Number(r["eci"])]));
  const metadata = new Map(metadataRows.map((r) => [r["model_version"], r]));

  const byModel = new Map<string, Row[]>();
  for (const r of metrRows) {
    const meta = metadata.get(r["Model version"]);
    if (!meta) continue;
    const key = eciByModel.has(meta["model_group"]) ? meta["model_group"] : eciByModel.has(meta["display_name"]) ? meta["display_name"] : null;
    if (key === null) continue;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key)!.push(r);
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (const [key, rows] of byModel) {
    const usable = rows.filter((r) => Number(r["Time horizon"]) > 0);
    if (!usable.length) continue;
    const pick =
      usable.find((r) => r["METR version"] === PREFERRED_METR_VERSION) ??
      usable.reduce((a, b) => (Number(b["Time horizon"]) > Number(a["Time horizon"]) ? b : a));
    const eci = eciByModel.get(key)!;
    if (!Number.isFinite(eci)) continue;
    xs.push(eci);
    ys.push(Math.log2(Number(pick["Time horizon"])));
  }
  return linearFit(xs, ys);
}

/** The full page model from Epoch's raw CSV text. */
export function buildForecast(csv: { eci: string; metr: string; metadata: string; benchmarks: Record<string, string> }): Forecast {
  const eciRows = parseCsv(csv.eci);
  const metadataRows = parseCsv(csv.metadata);
  const benchmarkRows = Object.fromEntries(Object.entries(csv.benchmarks).map(([file, text]) => [file, parseCsv(text)]));
  const points = frontierModels(eciRows, estimateOldModels(eciRows, metadataRows, benchmarkRows));
  const trend = fitTrend(
    TREND_KIND,
    points.map((p) => toYear(p.date)),
    points.map((p) => p.eci),
  );
  const horizon = horizonFit(eciRows, parseCsv(csv.metr), metadataRows);
  const milestones = MILESTONES.map(({ label, eci }) => {
    const year = trendYear(trend, eci);
    return { label, eci, date: year === null ? null : Math.round(fromYear(year)) };
  });
  return { points, trend, horizon, milestones };
}

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

/** A duration in the largest fitting unit (sec, min, h, days, years); single-digit values get one decimal. */
export function formatDuration(minutes: number): string {
  const num = (v: number) => (Number(v.toFixed(1)) < 10 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US"));
  if (minutes * 60 < 0.05) return "<0.1 sec";
  if (minutes < 1) return `${num(minutes * 60)} sec`;
  if (minutes < 60) return `${num(minutes)} min`;
  const h = minutes / 60;
  if (h < 24) return `${num(h)} h`;
  const d = h / 24;
  if (d < 365) {
    const days = num(d);
    return `${days} ${days === "1.0" ? "day" : "days"}`;
  }
  const years = num(d / 365.2425);
  return `${years} ${years === "1.0" ? "year" : "years"}`;
}

/**
 * Time from `now` until `target` as [value, unit] pairs: whole calendar years (only once there is
 * at least one), then days, hours, minutes and seconds. Empty once the target has passed.
 */
export function countdownParts(now: number, target: number): [string, string][] {
  if (target <= now) return [];
  const addYears = (t: number, years: number) => {
    const d = new Date(t);
    d.setUTCFullYear(d.getUTCFullYear() + years);
    return d.getTime();
  };
  let years = 0;
  while (addYears(now, years + 1) <= target) years++;
  let left = Math.floor((target - addYears(now, years)) / 1000);
  const days = Math.floor(left / 86400);
  left %= 86400;
  const pad = (v: number) => String(v).padStart(2, "0");
  return [
    ...(years > 0 ? [[String(years), "y"] as [string, string]] : []),
    [String(days), "d"],
    [pad(Math.floor(left / 3600)), "h"],
    [pad(Math.floor((left % 3600) / 60)), "m"],
    [pad(left % 60), "s"],
  ];
}

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

/** RFC 4180 CSV → rows keyed by header (quoted fields may contain commas, quotes and newlines). */
export function parseCsv(text: string): Row[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rows] = records.filter((r) => r.length > 1 || r[0] !== "");
  if (!header) return [];
  const keys = header.map((h) => h.replace(/^﻿/, "").trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}
