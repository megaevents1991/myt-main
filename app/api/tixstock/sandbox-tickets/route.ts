/**
 * The ticket cards of the hidden SANDBOX checkout: `GET /api/tixstock/sandbox-tickets?db_event_id=&ticket_quantity=`.
 *
 * Answers only for an `is_test` event that carries `tixstock_booking` (TixStock's health check). For every other
 * event - every real one - it answers 404 before any call to TixStock: a real event's ticket step keeps
 * `/api/tixstock/tickets` and the production feed.
 *
 * It reads TixStock's sandbox feed and answers; it NEVER writes `tickets_and_rates` and never drops a cache.
 *
 *   200 { cards, mapListings, venueCountryCode, tixEventId }
 *   400 bad parameters · 404 not a sandbox booking event · 502 the sandbox did not answer · 503 no sandbox token here
 */
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/eventsData";
import { supplierEventId } from "@/lib/suppliers";
import { isSandboxBookingEvent } from "@/lib/tixstock-booking/rules";
import { sandboxCards } from "@/lib/tixstock-booking/sandbox-cards";
import { sandboxClient } from "@/lib/tixstock-booking/site-env";
import { hasObstructedViewRestriction, isExcludedSection } from "@/lib/tixstock-feed";
import type { TixStockListing } from "@/lib/tixstock.types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The ticket step's own ceiling (`MAX_TICKETS`). */
const MAX_QUANTITY = 9;

const answer = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const eventId = Number(params.get("db_event_id"));
  const qty = Number(params.get("ticket_quantity"));
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
    return answer({ error: "bad_request" }, 400);
  }

  try {
    const { events } = await getEvents(eventId);
    const event = events?.[0];
    if (!event || !isSandboxBookingEvent(event)) return answer({ error: "not_found" }, 404);

    const tixEventId = supplierEventId(
      (event.tickets_and_rates ?? []).filter((t) => t?.available !== false),
      "tixstock",
      event.type,
    );
    if (!tixEventId) return answer({ error: "not_found" }, 404);

    const client = sandboxClient();
    if (!client) return answer({ error: "sandbox_not_configured" }, 503);

    const [listings, country] = await Promise.all([client.listings(tixEventId), client.eventVenueCountry(tixEventId)]);
    if (!listings.ok) {
      console.error("[tixstock-sandbox-tickets] feed not read:", listings.kind, listings.kind === "refused" ? listings.status : listings.detail);
      return answer({ error: "sandbox_unavailable" }, 502);
    }

    // The same two filters the regular route applies before anything is shown: excluded sections, restricted view.
    const excluded = event.tx_excluded_sections ?? [];
    const mapListings = (listings.data as unknown as TixStockListing[]).filter(
      (l) => !isExcludedSection(l, excluded) && !hasObstructedViewRestriction(l),
    );

    return answer(
      {
        cards: sandboxCards(mapListings, qty),
        mapListings,
        // The Italian attendee form follows the TixStock event's own venue, never our event's location.
        venueCountryCode: country.ok ? country.data : null,
        tixEventId,
      },
      200,
    );
  } catch (e) {
    console.error("[tixstock-sandbox-tickets] failed:", e instanceof Error ? e.message : String(e));
    return answer({ error: "internal" }, 500);
  }
}
