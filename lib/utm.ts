/**
 * UTM capture - pure decision logic + cookie codec.
 *
 * The `myt_utm` cookie holds the visitor's attribution: `p` (primary = the
 * touch that gets credit) and `h` (history, newest first, capped). Short keys
 * on purpose - the whole serialized value must stay well under the 4KB cookie
 * limit. Spec: myt-backoffice docs/superpowers/specs/2026-08-16-utm-capture-design.md.
 *
 * Everything here is pure and side-effect free so it can be unit-tested;
 * middleware.ts and confirm-order are thin adapters around it.
 */

export const UTM_COOKIE = "myt_utm";
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days, rolling
const HISTORY_MAX = 5;
// Browsers cap the URL-ENCODED cookie name+value at ~4096 bytes; 3800 leaves
// margin for the cookie name and attributes (Max-Age/Path/SameSite/etc).
const ENCODED_COOKIE_BUDGET = 3800;
const VALUE_MAX = 200;

export type CookieTouch = {
  s: string | null; // utm_source
  m: string | null; // utm_medium
  c: string | null; // utm_campaign
  t: string | null; // utm_term
  ct: string | null; // utm_content
  g: string | null; // gclid
  f: string | null; // fbclid
  inf: boolean; // source resolved to a marketing partner (influencer/agent)
  at: string; // ISO timestamp of the touch
};

export type IncomingTouch = Omit<CookieTouch, "inf" | "at">;

export type UtmCookie = { v: 1; p: CookieTouch; h: CookieTouch[] };

/** Insert shape for the shared `utm_touches` table (backoffice owns the schema). */
export type UtmTouchInsert = {
  reservation_id: number;
  position: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  is_influencer: boolean;
  visited_at: string | null;
};

const clean = (v: string | null): string | null => {
  const trimmed = v?.trim();
  return trimmed ? trimmed.slice(0, VALUE_MAX) : null;
};

/** A touch exists if ANY of the 7 params is present (bare gclid counts - Google auto-tagging). */
export function parseUtmParams(sp: URLSearchParams): IncomingTouch | null {
  const touch: IncomingTouch = {
    s: clean(sp.get("utm_source")),
    m: clean(sp.get("utm_medium")),
    c: clean(sp.get("utm_campaign")),
    t: clean(sp.get("utm_term")),
    ct: clean(sp.get("utm_content")),
    g: clean(sp.get("gclid")),
    f: clean(sp.get("fbclid")),
  };
  return Object.values(touch).some((v) => v !== null) ? touch : null;
}

const isTouchShape = (x: unknown): x is CookieTouch =>
  typeof x === "object" && x !== null && typeof (x as CookieTouch).at === "string";

/** Corrupt/foreign cookie → null (treated as absent; next capture writes fresh). */
export function parseUtmCookie(raw: string | undefined | null): UtmCookie | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const cookie = parsed as UtmCookie;
    if (cookie?.v !== 1 || !isTouchShape(cookie.p) || !Array.isArray(cookie.h)) return null;
    return { v: 1, p: cookie.p, h: cookie.h.filter(isTouchShape) };
  } catch {
    return null;
  }
}

/** For runtimes handing us a raw Cookie header instead of a parsed cookie jar. */
export function readUtmCookieFromHeader(cookieHeader: string | null): UtmCookie | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== UTM_COOKIE) continue;
    try {
      return parseUtmCookie(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}

/** Same 7 params = same touch; inf/at are derived, not identity. */
export function sameTouch(a: CookieTouch, b: IncomingTouch): boolean {
  return (
    a.s === b.s && a.m === b.m && a.c === b.c && a.t === b.t &&
    a.ct === b.ct && a.g === b.g && a.f === b.f
  );
}

/**
 * The core rule (approved spec):
 * - identical to current primary → no structural change (caller just refreshes expiry)
 * - influencer primary + non-influencer touch → primary protected, touch recorded in history
 * - otherwise (incl. influencer over influencer) → new touch wins, old primary → history
 */
export function applyUtmCapture(
  existing: UtmCookie | null,
  incoming: IncomingTouch,
  isInfluencer: boolean,
  nowIso: string,
): UtmCookie {
  const touch: CookieTouch = { ...incoming, inf: isInfluencer, at: nowIso };
  if (!existing) return { v: 1, p: touch, h: [] };
  if (sameTouch(existing.p, incoming)) return existing;
  if (existing.p.inf && !isInfluencer)
    return { v: 1, p: existing.p, h: [touch, ...existing.h].slice(0, HISTORY_MAX) };
  return { v: 1, p: touch, h: [existing.p, ...existing.h].slice(0, HISTORY_MAX) };
}

/** Primary is sacred; history is dropped oldest-first until the value fits the budget. */
export function serializeUtmCookie(cookie: UtmCookie): string {
  const h = [...cookie.h];
  let raw = JSON.stringify({ v: 1, p: cookie.p, h });
  while (encodeURIComponent(raw).length > ENCODED_COOKIE_BUDGET && h.length > 0) {
    h.pop();
    raw = JSON.stringify({ v: 1, p: cookie.p, h });
  }
  return raw;
}

/**
 * Does this serialized cookie fit the wire budget? Even a primary-only
 * payload (empty history) can exceed it - the caller (middleware) must skip
 * the Set-Cookie write entirely in that case rather than ship a value the
 * browser will silently drop.
 */
export function utmCookieFits(serialized: string): boolean {
  return encodeURIComponent(serialized).length <= ENCODED_COOKIE_BUDGET;
}

/** The influencer-protected attribution code for the reservation, if any. */
export function influencerPrimaryCode(cookie: UtmCookie | null): string | null {
  return cookie?.p.inf && cookie.p.s ? cookie.p.s : null;
}

/** Cookie → `utm_touches` rows. Primary at position 0, history at 1..n. */
export function touchRows(cookie: UtmCookie | null, reservationId: number): UtmTouchInsert[] {
  if (!cookie) return [];
  return [cookie.p, ...cookie.h].map((t, i) => ({
    reservation_id: reservationId,
    position: i,
    utm_source: t.s,
    utm_medium: t.m,
    utm_campaign: t.c,
    utm_term: t.t,
    utm_content: t.ct,
    gclid: t.g,
    fbclid: t.f,
    is_influencer: t.inf,
    visited_at: t.at ?? null,
  }));
}
