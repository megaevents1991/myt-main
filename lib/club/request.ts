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
