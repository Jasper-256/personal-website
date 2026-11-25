// Refreshes all the data behind /ai-frontier-forecast in one go.
//
//   npm run update:forecast
//
// - Epoch AI: downloads Epoch's public benchmark archive and extracts the CSVs the page is computed
//   from into src/data/epoch/ (the benchmark scores used to estimate ECI for pre-2023 models go in
//   benchmarks/).
// - METR: downloads the per-model time horizons behind the time-horizon trend figure of METR's latest
//   capability update into src/data/metr/. METR publishes these per blog post, at a URL that changes
//   with each post, so when METR publishes a newer update, set METR_DATA_URL (and METR_PAGE_URL)
//   to its figure's "Download data (JSON)" link.
//
// Everything is downloaded and run through the page's own formulas before anything is written, so a
// broken source stops the update with an explanation and leaves the current data untouched. On
// success it records one retrieval date for the page footer. Everything on the page (frontier models,
// trend line, milestone dates, time-horizon formula) is derived from these files at build time, so
// after running this, rebuild/deploy and the page updates itself.

import { inflateRawSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildForecast, METR_SERIES } from "../../src/scripts/ai-frontier-forecast-model.ts";

const EPOCH_URL = "https://epoch.ai/data/benchmark_data.zip";
const BENCHMARKS = ["mmlu", "hella_swag", "piqa", "bool_q", "wino_grande", "arc_ai2", "open_book_qa", "lambada", "trivia_qa", "gsm8k"];
const EPOCH_FILES = {
  "epoch_capabilities_index/eci_scores.csv": "eci_scores.csv",
  "model_metadata.csv": "model_metadata.csv",
  ...Object.fromEntries(BENCHMARKS.map((b) => [`${b}_external.csv`, `benchmarks/${b}_external.csv`])),
};

/** METR's Q4 2026 capability update, Figure 10 ("Across TH1.1 and TH2 ..."). */
const METR_PAGE_URL = "https://metr.org/blog/2026-11-20-q4-2026-capability-update/";
const METR_DATA_URL = "https://metr.org/assets/images/q4-2026-capability-update/cad6b5d98261f80c.json";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../src/data");
const EPOCH_DIR = join(DATA_DIR, "epoch");
const METR_FILE = join(DATA_DIR, "metr/time_horizons.json");
const SOURCE_FILE = join(DATA_DIR, "forecast-source.json");

/** Minimal zip reader: walks the central directory and inflates the requested entries. */
function readZipEntries(zip, wanted) {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip archive (no end of central directory record)");

  const entries = new Map();
  let p = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("Corrupt zip central directory");
    const method = zip.readUInt16LE(p + 10);
    const compressedSize = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;
    if (!wanted.includes(name)) continue;

    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) entries.set(name, Buffer.from(data));
    else if (method === 8) entries.set(name, inflateRawSync(data));
    else throw new Error(`Unsupported zip compression method ${method} for ${name}`);
  }
  return entries;
}

class UpdateError extends Error {}

async function download(name, url) {
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new UpdateError(`${name}: couldn't reach ${url} (${e.cause?.message ?? e.message})`);
  }
  if (!response.ok) throw new UpdateError(`${name}: ${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchEpoch() {
  const zip = await download("Epoch", EPOCH_URL);
  let entries;
  try {
    entries = readZipEntries(zip, Object.keys(EPOCH_FILES));
  } catch (e) {
    throw new UpdateError(`Epoch: ${EPOCH_URL} isn't a readable zip archive (${e.message})`);
  }
  const missing = Object.keys(EPOCH_FILES).filter((entry) => !entries.has(entry));
  if (missing.length) throw new UpdateError(`Epoch: the archive no longer contains ${missing.join(", ")}; Epoch may have reorganized it`);
  return new Map(Object.entries(EPOCH_FILES).map(([entry, file]) => [file, entries.get(entry)]));
}

const METR_HINT =
  `METR's data URL may have changed. Find the "Download data (JSON)" link under the time-horizon trend ` +
  `figure ("${METR_SERIES}") in METR's latest capability update (https://metr.org/blog/), then set ` +
  `METR_DATA_URL and METR_PAGE_URL in tools/forecast-data/update.mjs.`;

async function fetchMetr() {
  const data = await download("METR", METR_DATA_URL).catch((e) => {
    throw new UpdateError(`${e.message}\n${METR_HINT}`);
  });
  let json;
  try {
    json = JSON.parse(data.toString("utf8"));
  } catch {
    throw new UpdateError(`METR: ${METR_DATA_URL} isn't JSON any more.\n${METR_HINT}`);
  }
  const rows = (json.panels ?? []).flatMap((p) => p.tables ?? []).find((t) => t.name === "models")?.rows ?? [];
  if (!rows.some((r) => r.series === METR_SERIES)) {
    throw new UpdateError(`METR: ${METR_DATA_URL} no longer has a "models" table with "${METR_SERIES}" rows.\n${METR_HINT}`);
  }
  return data;
}

async function main() {
  const [epoch, metr] = await Promise.all([fetchEpoch(), fetchMetr()]);

  // Run the page's formulas on the new data. Anything they can't use (a METR model with no ECI
  // score, a missing column, ...) throws here, before any file is replaced.
  let forecast;
  try {
    forecast = buildForecast({
      eci: epoch.get("eci_scores.csv").toString("utf8"),
      metadata: epoch.get("model_metadata.csv").toString("utf8"),
      benchmarks: Object.fromEntries(BENCHMARKS.map((b) => [b, epoch.get(`benchmarks/${b}_external.csv`).toString("utf8")])),
      metrJson: metr.toString("utf8"),
    });
  } catch (e) {
    throw new UpdateError(`The new data doesn't work with the page's formulas: ${e.message}`);
  }
  const { horizon, trend, points } = forecast;
  if (![horizon.slope, horizon.intercept, trend.fit.slope, trend.fit.intercept].every(Number.isFinite) || horizon.slope <= 0 || !points.length) {
    throw new UpdateError("The new data produced an unusable forecast (no frontier models, or a trend or time-horizon fit that isn't a rising line)");
  }

  mkdirSync(join(EPOCH_DIR, "benchmarks"), { recursive: true });
  mkdirSync(dirname(METR_FILE), { recursive: true });
  for (const [file, data] of epoch) {
    writeFileSync(join(EPOCH_DIR, file), data);
    console.log(`epoch/${file}: ${data.length.toLocaleString()} bytes`);
  }
  writeFileSync(METR_FILE, metr);
  console.log(`metr/time_horizons.json: ${metr.length.toLocaleString()} bytes`);

  const retrieved = new Date().toISOString().slice(0, 10);
  const source = { retrieved, epoch: { url: EPOCH_URL }, metr: { page: METR_PAGE_URL, url: METR_DATA_URL } };
  writeFileSync(SOURCE_FILE, JSON.stringify(source, null, 2) + "\n");
  const latest = points[points.length - 1];
  console.log(
    `\nRetrieved ${retrieved}: ${points.length} frontier models (latest ${latest.name}, ECI ${latest.eci.toFixed(1)}), ` +
      `time horizon fit on ${horizon.n} METR models. Rebuild the site to update /ai-frontier-forecast.`,
  );
}

try {
  await main();
} catch (e) {
  console.error(`\nUpdate failed; no data was changed.\n${e instanceof UpdateError ? e.message : (e.stack ?? e)}`);
  process.exit(1);
}
