import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authHeader } from "../keys";

/**
 * POST /api/hotels-warm - warm RateHawk static hotel data around a point.
 *
 * Called by the backoffice ("טען מלונות", lib/actions/hotel-warm-actions.ts) with the shared
 * secret in `x-hotel-secret`. A cold destination has no rows in `hotels`, so the customer
 * page shows at most 14 hotels per load (/api/hotels-info) and the backoffice base-price
 * probe finds no 3★ hotel at all. One call: one `serp/geo` search (RateHawk 10/min, shared
 * with customers) → the hids we do not have yet → up to `max` `hotel/info` calls, 2.5 s
 * apart (30/min) → awaited upsert. Returns what is left so the caller can loop.
 */
export const maxDuration = 60;

const SERP_URL = "https://api.worldota.net/api/b2b/v3/search/serp/geo";
const INFO_URL = "https://api.worldota.net/api/b2b/v3/hotel/info/";
const MAX_PER_CALL = 12;
const INFO_GAP_MS = 2500;
const DUMMY_STAY_DAYS_AHEAD = 45;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoPlus = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type InfoData = {
  id: string; hid: number; name: string; address: string; latitude: number; longitude: number;
  star_rating: number; kind: string; room_groups?: unknown; images_ext?: unknown; amenity_groups?: unknown;
};

export async function POST(request: Request) {
  if (request.headers.get("x-hotel-secret") !== process.env.NEXT_SECRET_REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { lat?: number; lon?: number; radius?: number; name?: string; max?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const lat = Number(body.lat), lon = Number(body.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon required" }, { status: 400 });
  }
  const radius = Math.min(Math.max(Number(body.radius) || 2000, 500), 10000);
  const max = Math.min(Math.max(Number(body.max) || MAX_PER_CALL, 1), 20);
  const city = (body.name || "").toString().slice(0, 120) || "Missing";

  try {
    // 1. Which hotels does RateHawk sell around the point (a real search with dummy dates)?
    const serp = await fetch(SERP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${authHeader}` },
      body: JSON.stringify({
        checkin: isoPlus(DUMMY_STAY_DAYS_AHEAD),
        checkout: isoPlus(DUMMY_STAY_DAYS_AHEAD + 2),
        residency: "il", language: "en", currency: "USD",
        guests: [{ adults: 2, children: [] }],
        latitude: lat, longitude: lon, radius,
      }),
    });
    if (serp.status === 429) {
      return NextResponse.json({ found: 0, existing: 0, loaded: 0, remaining: 0, error: "RateHawk rate limit (search) - try again in a minute" });
    }
    if (!serp.ok) return NextResponse.json({ error: `serp ${serp.status}` }, { status: 502 });
    const serpJson = (await serp.json()) as { data?: { hotels?: { hid: number }[] } };
    const hids = Array.from(new Set((serpJson.data?.hotels ?? []).map((h) => Number(h.hid)).filter(Number.isFinite)));

    // 2. Which of them do we already hold?
    const existing = new Set<number>();
    for (let i = 0; i < hids.length; i += 100) {
      const { data, error } = await supabase.from("hotels").select("hid").in("hid", hids.slice(i, i + 100));
      if (error) throw new Error(`hotels read: ${error.message}`);
      for (const r of data ?? []) existing.add(Number((r as { hid: number }).hid));
    }
    const missing = hids.filter((h) => !existing.has(h));

    // 3. Load a batch of the missing ones, paced.
    const rows: Record<string, unknown>[] = [];
    let error: string | null = null;
    for (const hid of missing.slice(0, max)) {
      if (rows.length) await sleep(INFO_GAP_MS);
      const res = await fetch(INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${authHeader}` },
        body: JSON.stringify({ hid, language: "en" }),
      });
      if (res.status === 429) { error = "RateHawk rate limit (hotel/info) - continue in a minute"; break; }
      if (!res.ok) { console.error(`hotels-warm: hotel/info ${hid} → ${res.status}`); continue; }
      const info = (await res.json()) as { data?: InfoData | null };
      const h = info.data;
      if (!h) continue;
      // Same shape as /api/hotels-info processHotelsData, with a real city instead of "Missing".
      rows.push({
        _id: h.id, hid: h.hid, name: h.name, address: h.address,
        latitude: h.latitude, longitude: h.longitude, star_rating: h.star_rating, kind: h.kind,
        room_groups: JSON.parse(JSON.stringify(h.room_groups || [])),
        images_ext: JSON.parse(JSON.stringify(h.images_ext || [])),
        amenity_groups: JSON.parse(JSON.stringify(h.amenity_groups || [])),
        city,
        guest_rating: null, guest_review_count: null, guest_detailed_ratings: null, guest_rating_updated_at: null,
      });
    }
    if (rows.length) {
      const { error: upErr } = await supabase.from("hotels").upsert(rows, { onConflict: "hid" });
      if (upErr) throw new Error(`hotels upsert: ${upErr.message}`);
    }
    return NextResponse.json({
      found: hids.length,
      existing: existing.size,
      loaded: rows.length,
      remaining: Math.max(0, missing.length - rows.length),
      error,
    });
  } catch (e) {
    console.error("hotels-warm failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "warm failed" }, { status: 500 });
  }
}
