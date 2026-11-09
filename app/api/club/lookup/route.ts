import { NextResponse } from "next/server";
import { lookupClub } from "@/lib/club/join";
import { clubDeps, clubSiteUrl } from "@/lib/club/db";
import { clubCtx, isOwnSiteJsonPost, readJson, requestOrigin } from "@/lib/club/request";

export const dynamic = "force-dynamic";

/** POST { email, eventId, hp } → ClubAnswer without a name, or not_found (spec §8). */
export async function POST(request: Request) {
  if (!isOwnSiteJsonPost(request)) return NextResponse.json({ ok: false, kind: "invalid" }, { status: 403 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ ok: false, kind: "invalid" });
  const answer = await lookupClub(body, clubCtx(request, body), clubDeps({ siteUrl: clubSiteUrl(requestOrigin(request)) }));
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}
