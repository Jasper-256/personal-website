// Refreshes the Epoch AI data behind /ai-frontier-forecast.
//
//   npm run update:epoch
//
// Downloads Epoch's public benchmark archive, extracts the three CSVs the page is computed
// from into src/data/epoch/, and records the retrieval date. Everything on the page (frontier
// models, trend line, milestone dates, time-horizon formula) is derived from these files at build
// time, so after running this, rebuild/deploy and the page updates itself.

import { inflateRawSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://epoch.ai/data/benchmark_data.zip";
const FILES = {
  "epoch_capabilities_index/eci_scores.csv": "eci_scores.csv",
  "metr_time_horizons_external.csv": "metr_time_horizons_external.csv",
  "model_metadata.csv": "model_metadata.csv",
};
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../src/data/epoch");

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

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
const zip = Buffer.from(await response.arrayBuffer());
const entries = readZipEntries(zip, Object.keys(FILES));

mkdirSync(OUT_DIR, { recursive: true });
for (const [entry, file] of Object.entries(FILES)) {
  const data = entries.get(entry);
  if (!data) throw new Error(`${entry} is missing from ${SOURCE_URL}; Epoch may have reorganized the archive`);
  writeFileSync(join(OUT_DIR, file), data);
  console.log(`${file}: ${data.length.toLocaleString()} bytes`);
}

const retrieved = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT_DIR, "source.json"), JSON.stringify({ url: SOURCE_URL, retrieved }, null, 2) + "\n");
console.log(`Retrieved ${retrieved}. Rebuild the site to update /ai-frontier-forecast.`);
