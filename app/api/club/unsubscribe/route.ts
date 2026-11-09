import { NextResponse } from "next/server";
import { unsubscribeClub } from "@/lib/club/join";
import { clubDeps, clubSiteUrl } from "@/lib/club/db";
import { clubCtx, readJson, requestOrigin } from "@/lib/club/request";

export const dynamic = "force-dynamic";

/**
 * POST = unsubscribe: the page's button sends { t }, a mail client's one-click (RFC 8058, the List-Unsubscribe-Post
 * header) posts "List-Unsubscribe=One-Click" to ?t=. A GET never unsubscribes (link scanners open every link) - it
 * sends the person to the page with the button.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token: unknown = url.searchParams.get("t");
  if (!token && (request.headers.get("content-type") ?? "").includes("application/json")) {
    token = (await readJson(request))?.t;
  }
  const answer = await unsubscribeClub(token, clubCtx(request), clubDeps({ siteUrl: clubSiteUrl(requestOrigin(request)) }));
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/club/unsubscribe?t=${encodeURIComponent(t)}`, url.origin), 303);
}
