import { revalidatePath, revalidateTag } from "next/cache";
import { getCachedEvents } from "@/lib/eventsData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const path = searchParams.get("path");

  if (secret !== process.env.NEXT_SECRET_REVALIDATION_SECRET) {
    return new Response("Invalid token", { status: 401 });
  }

  try {
    console.log("[Revalidation] Starting revalidation process...");

    // First, revalidate the events cache tag
    revalidateTag("events");
    console.log("[Revalidation] Revalidated events cache tag");

    if (path) {
      // Revalidate specific path if provided
      revalidatePath(path as string);
      console.log(`[Revalidation] Revalidated specific path: ${path}`);
    } else {
      // Revalidate all critical paths when new events are added
      console.log("[Revalidation] Revalidating all paths...");

      // Homepage
      revalidatePath("/", "page");
      console.log("[Revalidation] ✓ Homepage");

      // Order layout (this will revalidate all /order/* pages)
      revalidatePath("/order", "layout");
      console.log("[Revalidation] ✓ All order pages");

      // Sitemap
      revalidatePath("/sitemap.xml", "page");
      console.log("[Revalidation] ✓ Sitemap");

      // Football pages
      revalidatePath("/football", "page");
      revalidatePath("/football", "layout");
      console.log("[Revalidation] ✓ Football pages");

      // Artists pages
      revalidatePath("/artists", "page");
      revalidatePath("/artists", "layout");
      console.log("[Revalidation] ✓ Artists pages");

      // Get events count for logging
      const { events } = await getCachedEvents();
      console.log(
        `[Revalidation] Complete! Found ${events.length} events. New pages will be generated on-demand.`,
      );
    }

    return new Response(
      JSON.stringify({
        revalidated: true,
        message: path ? `Revalidated path: ${path}` : "Revalidated all pages",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[Revalidation] Error:", error);
    return new Response(
      JSON.stringify({
        revalidated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
