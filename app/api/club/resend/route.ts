import { NextResponse } from "next/server";
import { resendWelcome } from "@/lib/club/join";
import { clubDeps } from "@/lib/club/db";
import { readJson } from "@/lib/club/request";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROD_SITE = "https://www.mega-events.co.il";

/**
 * The backoffice's "Resend welcome mail" (/marketing/club > Members). Header x-hotel-secret =
 * NEXT_SECRET_REVALIDATION_SECRET, body { memberId } → { ok: true } | { ok: false, error }.
 */
export async function POST(request: Request) {
  const secret = process.env.NEXT_SECRET_REVALIDATION_SECRET;
  if (!secret || request.headers.get("x-hotel-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await readJson(request);
  const memberId = body?.memberId;
  if (typeof memberId !== "string" || !UUID.test(memberId)) {
    return NextResponse.json({ ok: false, error: "memberId is not a member id" }, { status: 400 });
  }
  // Staff resend from the backoffice: the mail's links always name the live site.
  return NextResponse.json(await resendWelcome(memberId, clubDeps({ siteUrl: PROD_SITE })));
}
