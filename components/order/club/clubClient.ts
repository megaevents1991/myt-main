// MEGA CLUB - the browser side of the club: the remembered-member cookie and the analytics pushes (spec §5.5, §5.7).
// No personal data in either: the cookie holds the code, the number and (only from this device's own form) a first name.
import { trackEvent } from "@/lib/mixpanel";
import { CLUB_COOKIE, CLUB_COOKIE_DAYS, serializeClubCookie, type ClubCookie } from "@/lib/club/rules";
import type { ClubAnswer } from "@/lib/club/join";
import { CLUB_HANDOFF_KEY, readClubHandoff, type ClubHandoff } from "@/lib/club/confirm";

export type ClubOk = Extract<ClubAnswer, { ok: true }>;

export function writeClubCookie(c: ClubCookie): void {
  try {
    const maxAge = CLUB_COOKIE_DAYS * 24 * 3600;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CLUB_COOKIE}=${encodeURIComponent(serializeClubCookie(c))}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* a blocked cookie only means no auto-apply next time */
  }
}

export function clearClubCookie(): void {
  try {
    document.cookie = `${CLUB_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* nothing to clear */
  }
}

/** D17: what this tab carries over the payment page to the confirmation page (null = carry nothing). */
export function writeClubHandoff(h: ClubHandoff | null): void {
  try {
    if (h) sessionStorage.setItem(CLUB_HANDOFF_KEY, JSON.stringify(h));
    else sessionStorage.removeItem(CLUB_HANDOFF_KEY);
  } catch {
    /* a blocked storage only means no club block after the order */
  }
}

export function readClubHandoffInTab(orderId: string): ClubHandoff | null {
  try {
    return readClubHandoff(sessionStorage.getItem(CLUB_HANDOFF_KEY), orderId, Date.now());
  } catch {
    return null;
  }
}

function pushDataLayer(payload: Record<string, unknown>): void {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(payload);
  } catch {
    /* analytics never breaks the order */
  }
}

export function trackClubJoin(method: "popup" | "row" | "page" | "inline" | "confirmation", returning: boolean): void {
  pushDataLayer({ event: "club_join", club_method: method, returning });
  try {
    trackEvent("Club_Join", { method, returning });
  } catch {
    /* analytics never breaks the order */
  }
}

export function trackClubApplied(method: "lookup" | "cookie"): void {
  pushDataLayer({ event: "club_member_applied", club_method: method });
  try {
    trackEvent("Club_Member_Applied", { method });
  } catch {
    /* analytics never breaks the order */
  }
}

/** POST to a club route; a network failure or a non-JSON answer reads as `error`, never a throw. */
export async function postClub(path: "/api/club/join" | "/api/club/lookup", body: Record<string, unknown>): Promise<ClubAnswer> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, path: location.pathname }),
    });
    const data = (await res.json().catch(() => null)) as ClubAnswer | null;
    return data && typeof data.ok === "boolean" ? data : { ok: false, kind: "error" };
  } catch {
    return { ok: false, kind: "error" };
  }
}
