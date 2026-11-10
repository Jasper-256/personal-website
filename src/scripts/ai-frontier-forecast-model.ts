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
 * GPT-4 Turbo (Nov 2023): Epoch dates this model family 2024-01-25 because it folds in
 * gpt-4-0125-preview (a January 2024 update, whose METR time horizon feeds the score). The family
 * is named for, and mostly scored on, the original GPT-4 Turbo (gpt-4-1106-preview), released
 * 2023-11-06.
 */
export const DATE_OVERRIDES: Record<string, string> = {
  "GPT-4 Turbo (Nov 2023)": "2023-11-06",
};

/** Frontier models that get a direct label on wide screens (the first and latest always do). */
export const LABELLED_MODELS = ["o1-mini", "GPT-5", "Claude Fable 5"];

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
 * ECI at the date its default forecast reaches each milestone. On the site as of 2026-11-10, its
 * default run reaches Automated Coder at ECI ~182.4 and Superhuman AI Researcher at ~198.1.
 */
export const MILESTONES = [
  { label: "Automated Coder", eci: 183 },
  { label: "Superhuman AI Researcher", eci: 198 },
];

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
 * Models that scored higher than every model released before them, from FRONTIER_START_DATE on.
 * Models released the same day compete with each other; only the best can set the record.
 */
export function frontierModels(eciRows: Row[]): FrontierPoint[] {
  const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v));
  const models = eciRows
    .map((r) => ({
      name: r["Display name"] || r["Model"],
      key: r["Model"],
      org: r["Organization"],
      date: DATE_OVERRIDES[r["Model"]] ?? r["date"],
      eci: num(r["eci"]),
      lo: num(r["eci_ci_low"]),
      hi: num(r["eci_ci_high"]),
    }))
    .filter((m): m is typeof m & { eci: number } => m.eci !== null && Number.isFinite(m.eci) && /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .filter((m) => m.date >= FRONTIER_START_DATE)
    .filter((m) => !EXCLUDED_MODELS.some((re) => re.test(m.key)))
    .sort((a, b) => a.date.localeCompare(b.date) || b.eci - a.eci);

  const frontier: FrontierPoint[] = [];
  for (const m of models) {
    if (frontier.length && m.eci <= frontier[frontier.length - 1].eci) continue;
    frontier.push({ name: m.name, org: m.org, date: m.date, eci: m.eci, lo: m.lo, hi: m.hi, label: LABELLED_MODELS.includes(m.key) });
  }
  if (frontier.length) {
    frontier[0].label = true;
    frontier[frontier.length - 1].label = true;
  }
  return frontier;
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
export function buildForecast(csv: { eci: string; metr: string; metadata: string }): Forecast {
  const eciRows = parseCsv(csv.eci);
  const points = frontierModels(eciRows);
  const trend = fitTrend(
    TREND_KIND,
    points.map((p) => toYear(p.date)),
    points.map((p) => p.eci),
  );
  const horizon = horizonFit(eciRows, parseCsv(csv.metr), parseCsv(csv.metadata));
  const milestones = MILESTONES.map(({ label, eci }) => {
    const year = trendYear(trend, eci);
    return { label, eci, date: year === null ? null : Math.round(fromYear(year)) };
  });
  return { points, trend, horizon, milestones };
}

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  if (h < 24) return h < 10 ? `${h.toFixed(1)} h` : `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 365) {
    const days = d < 10 ? d.toFixed(1) : String(Math.round(d));
    return `${days} ${days === "1.0" ? "day" : "days"}`;
  }
  const y = d / 365.2425;
  const years = y < 10 ? y.toFixed(1) : Math.round(y).toLocaleString("en-US");
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
