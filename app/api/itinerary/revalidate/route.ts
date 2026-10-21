import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ITINERARY_SETTINGS_TAG } from "@/lib/itinerary/settings.server";

/**
 * POST /api/itinerary/revalidate - the backoffice calls it after saving the
 * "Build Your Euro Trip" settings, so the switch and the rules reach the site now
 * instead of within the hour.
 *
 * Server-to-server with the shared secret in `x-hotel-secret`
 * (NEXT_SECRET_REVALIDATION_SECRET), like /api/homepage-pools.
 */
export async function POST(request: Request) {
  const secret = process.env.NEXT_SECRET_REVALIDATION_SECRET;
  if (!secret || request.headers.get("x-hotel-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    revalidateTag(ITINERARY_SETTINGS_TAG);
    revalidatePath("/euro-trip");
    revalidatePath("/euro-trip/build");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("itinerary revalidate failed:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
