// MEGA CLUB - what a club route reads off the request (spec §8). Server only.
import { readUtmCookieFromHeader } from "@/lib/utm";
import type { ClubCtx } from "@/lib/club/join";

export function requestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}

/** The page the visitor joined from: its path only (never a query string, which may carry a partner's code). */
function pagePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return new URL(raw, "https://x.invalid").pathname.slice(0, 300);
  } catch {
    return null;
  }
}

export function clubCtx(request: Request, body?: Record<string, unknown> | null): ClubCtx {
  return {
    ip: requestIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
    sourcePath: pagePath(body?.path) ?? pagePath(request.headers.get("referer")),
    utm: readUtmCookieFromHeader(request.headers.get("cookie")),
    now: new Date(),
  };
}

/**
 * A join or lookup must come from our own page. A cross-site page can POST text/plain with mode "no-cors" and skip the
 * CORS preflight (request.json() never looks at the type), so: JSON only, and a browser's Sec-Fetch-Site / Origin must
 * name this host. A request with neither header (curl, server to server) is let through - the rate limit still counts it.
 */
export function isOwnSiteJsonPost(request: Request): boolean {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function requestOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}
