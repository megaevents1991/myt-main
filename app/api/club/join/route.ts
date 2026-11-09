import { NextResponse } from "next/server";
import { joinClub } from "@/lib/club/join";
import { clubDeps, clubSiteUrl } from "@/lib/club/db";
import { clubCtx, readJson, requestOrigin } from "@/lib/club/request";

export const dynamic = "force-dynamic";

/** POST { email, phone, consent: true, firstName?, lastName?, eventId, method, path?, hp } → ClubAnswer (spec §8). */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return NextResponse.json({ ok: false, kind: "invalid" });
  const answer = await joinClub(body, clubCtx(request, body), clubDeps({ siteUrl: clubSiteUrl(requestOrigin(request)) }));
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}
