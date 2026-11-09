import { NextResponse } from "next/server";
import { leaveClub } from "@/lib/club/join";
import { clubDeps, clubSiteUrl } from "@/lib/club/db";
import { clubCtx, isOwnSiteJsonPost, readJson, requestOrigin } from "@/lib/club/request";

export const dynamic = "force-dynamic";

/** POST { t } from the unsubscribe page's "עזיבת המועדון" (D13): the updates stop and the member code goes off. */
export async function POST(request: Request) {
  if (!isOwnSiteJsonPost(request)) return NextResponse.json({ ok: false, kind: "not_found" }, { status: 403 });
  const body = await readJson(request);
  const answer = await leaveClub(body?.t, clubCtx(request), clubDeps({ siteUrl: clubSiteUrl(requestOrigin(request)) }));
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}
