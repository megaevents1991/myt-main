/**
 * Backfill RateHawk guest ratings into the `hotels` table.
 *
 * WHY: the per-hotel reviews endpoint (hotel_reviews_by_ids) is NOT enabled on
 * our key, but the full reviews DUMP endpoint IS active. This script pulls the
 * dump once, matches it against the hids we already cache, and writes
 * guest_rating / guest_review_count / guest_detailed_ratings onto those rows.
 *
 * Offline hotels inherit the score from `hotels` via their hid at read time, so
 * filling `hotels` covers online AND offline-with-hid. Offline rows without a
 * hid have no source — set a manual rating in the backoffice form instead.
 *
 * Run:  node scripts/backfill-guest-ratings.mjs
 * Re-runnable + incremental-safe (always overwrites with latest dump values).
 *
 * The dump is the FULL RateHawk reviews feed (all properties), a large gzipped,
 * effectively line-delimited JSON object: { "<slug>": {hid,rating,...}, ... }.
 * We stream + gunzip + read line-by-line so memory stays flat.
 */
import fs from "fs";
import zlib from "zlib";
import readline from "readline";
import { Readable } from "stream";

// ── env ──────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const SUPABASE_URL = env.NEXT_SECRET_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_SECRET_SUPABASE_SERVICE_KEY;
const AUTH = Buffer.from(
  `${env.EMERGING_TRAVEL_API_KEY}:${env.EMERGING_TRAVEL_API_SECRET}`
).toString("base64");
const sbHead = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// ── 1) load every cached hid into a Set ──────────────────────────────────────
async function loadHids() {
  const hids = new Set();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/hotels?select=hid`, {
      headers: { ...sbHead, Range: `${from}-${from + PAGE - 1}` },
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) if (r.hid != null) hids.add(r.hid);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from % 20000 === 0) console.log(`  loaded ${hids.size} hids…`);
  }
  return hids;
}

// ── 2) get the signed dump URL ───────────────────────────────────────────────
async function getDumpUrl() {
  const res = await fetch(
    "https://api.worldota.net/api/b2b/v3/hotel/reviews/dump/",
    {
      method: "POST",
      headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en" }),
    }
  );
  const json = await res.json();
  if (!json?.data?.url) {
    throw new Error(`No dump URL (status ${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  console.log("Dump last_update:", json.data.last_update);
  return json.data.url;
}

// Parse one line of the dump object: `"<slug>":{<json>},` → the value object.
function parseLine(line) {
  const s = line.trim();
  if (s.length < 2 || s[0] !== '"') return null; // skip `{` / `}`
  const sep = s.indexOf('":'); // end of the slug key
  if (sep === -1) return null;
  let valueStr = s.slice(sep + 2);
  if (valueStr.endsWith(",")) valueStr = valueStr.slice(0, -1);
  try {
    return JSON.parse(valueStr);
  } catch {
    return null;
  }
}

// ── 3) PATCH a single hotel row by hid ───────────────────────────────────────
async function patchHotel(rec) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/hotels?hid=eq.${rec.hid}`,
    {
      method: "PATCH",
      headers: { ...sbHead, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        guest_rating: rec.guest_rating,
        guest_review_count: rec.guest_review_count,
        guest_detailed_ratings: rec.guest_detailed_ratings,
        guest_rating_updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) console.error(`  PATCH hid ${rec.hid} failed ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

// Bounded-concurrency pool over a queue of records.
async function runPool(records, concurrency = 25) {
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < records.length) {
      const rec = records[i++];
      await patchHotel(rec);
      if (++done % 500 === 0) console.log(`  updated ${done}/${records.length}…`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ── main ─────────────────────────────────────────────────────────────────────
console.log("Loading cached hids from `hotels`…");
const hidSet = await loadHids();
console.log(`Cached hids: ${hidSet.size}`);

console.log("Requesting reviews dump URL…");
const url = await getDumpUrl();

console.log("Streaming + matching dump (this can take a few minutes)…");
const resp = await fetch(url);
const gunzip = Readable.fromWeb(resp.body).pipe(zlib.createGunzip());
const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });

const matches = [];
let scanned = 0;
for await (const line of rl) {
  const rec = parseLine(line);
  scanned++;
  if (scanned % 200000 === 0)
    console.log(`  scanned ${scanned} properties, matched ${matches.length}…`);
  if (!rec || rec.hid == null || typeof rec.rating !== "number") continue;
  if (!hidSet.has(rec.hid)) continue;
  matches.push({
    hid: rec.hid,
    guest_rating: Math.round(rec.rating * 10) / 10,
    // The dump's `reviews` array is only a small SAMPLE of recent reviews, not
    // the true total — so we never derive a count from it. Real counts only come
    // from manual overrides on offline hotels.
    guest_review_count: null,
    guest_detailed_ratings: rec.detailed_ratings ?? null,
  });
}
console.log(`Scan done. ${scanned} properties scanned, ${matches.length} matched our hids.`);

console.log("Writing scores to `hotels`…");
await runPool(matches);
console.log(`DONE. Updated ${matches.length} hotels with guest ratings.`);
