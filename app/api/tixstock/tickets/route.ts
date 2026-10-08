import { NextRequest, NextResponse } from "next/server";
import { normalizeTxCategory } from "@/lib/tixstock-category";
import { cheapestAvailableTicketPrice } from "@/lib/events/price";
import { invalidateAfterLivePriceSync } from "@/lib/events/livePriceInvalidation";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { supabase } from "@/lib/supabase";
import type { EventTicket } from "@/lib/app.types";
import type { TixStockListing } from "@/lib/tixstock.types";
import { listingCanSatisfyQuantity } from "@/lib/tixstock-quantity";
import {
  fetchTixstockFeed,
  hasObstructedViewRestriction,
  isExcludedSection,
} from "@/lib/tixstock-feed";
import { supplierCostToUsd } from "@/lib/supplier-pricing";
import { ticketSupplier } from "@/lib/suppliers";

/** Convert an amount string in any supported currency to USD, with per-currency markup */
function toUsd(amount: string, currency: string): string {
  const value = parseFloat(amount);
  if (isNaN(value)) return amount;
  // Same formula every live supplier is priced with (lib/supplier-pricing.ts).
  const usd = supplierCostToUsd(value, currency);
  if (usd === null) {
    // Unknown currency - return as-is and log
    console.warn(
      `[TixStock Tickets] Unknown currency "${currency}", not converting`,
    );
    return amount;
  }
  return usd.toFixed(2);
}

// Accent/punctuation-insensitive - TixStock renames venue categories over time.
const normalizeCategory = normalizeTxCategory;

function getCheapestCategoryPrices(
  listings: TixStockListing[],
  requestedQuantity?: number,
) {
  const prices = new Map<string, number>();

  for (const listing of listings) {
    if (
      requestedQuantity !== undefined &&
      !listingCanSatisfyQuantity(listing, requestedQuantity)
    ) {
      continue;
    }

    const category = normalizeCategory(listing.seat_details?.category);
    const amount = Math.ceil(
      parseFloat(listing.proceed_price?.amount ?? "NaN"),
    );
    if (!category || !Number.isFinite(amount)) continue;

    const current = prices.get(category);
    if (current === undefined || amount < current) {
      prices.set(category, amount);
    }
  }

  return prices;
}

async function updateDbTicketPricesFromLiveListings(
  dbEventId: string | null,
  listings: TixStockListing[],
  requestedQuantity: number,
) {
  if (!dbEventId || requestedQuantity !== 2) {
    return { priceUpdates: [], ticketsAndRates: null };
  }

  const numericDbEventId = Number(dbEventId);
  if (!Number.isFinite(numericDbEventId)) {
    console.warn(
      `[TixStock Tickets] Invalid db_event_id for price sync: ${dbEventId}`,
    );
    return { priceUpdates: [], ticketsAndRates: null };
  }

  const { data: eventRow, error: fetchError } = await supabase
    .from("events")
    .select("id,type,tickets_and_rates")
    .eq("id", numericDbEventId)
    .single();

  if (fetchError || !eventRow) {
    console.error(
      "[TixStock Tickets] Failed to fetch DB event for price sync:",
      fetchError,
    );
    return { priceUpdates: [], ticketsAndRates: null };
  }

  if (eventRow.type !== "tx_event") {
    return {
      priceUpdates: [],
      ticketsAndRates: eventRow.tickets_and_rates as EventTicket[] | null,
    };
  }

  const categoryPrices = getCheapestCategoryPrices(listings, requestedQuantity);
  const ticketsAndRates = (eventRow.tickets_and_rates || []) as EventTicket[];
  const priceUpdates: Array<{
    ticket_id: string;
    category: string;
    previous_price: number;
    new_price: number;
  }> = [];

  const nextTicketsAndRates = ticketsAndRates.map((ticket) => {
    // A mixed event also holds other suppliers' tickets - their category names
    // can collide with TixStock's ("Category 1"), so never price them here.
    if (ticketSupplier(ticket, "tx_event") !== "tixstock") return ticket;
    const livePrice = categoryPrices.get(normalizeCategory(ticket.category));
    const priceDiff =
      livePrice !== undefined && Number.isFinite(ticket.price)
        ? livePrice - ticket.price
        : null;
    if (
      livePrice === undefined ||
      !Number.isFinite(ticket.price) ||
      priceDiff === null ||
      Math.abs(priceDiff) <= 1
    ) {
      return ticket;
    }

    priceUpdates.push({
      ticket_id: ticket.id,
      category: ticket.category,
      previous_price: ticket.price,
      new_price: livePrice,
    });

    return { ...ticket, price: livePrice };
  });

  if (priceUpdates.length === 0) {
    return { priceUpdates, ticketsAndRates };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ tickets_and_rates: nextTicketsAndRates })
    .eq("id", numericDbEventId);

  if (updateError) {
    console.error(
      "[TixStock Tickets] Failed to update DB ticket prices:",
      updateError,
    );
    return { priceUpdates: [], ticketsAndRates };
  }

  // Only what this write made stale: this event's order page, and the listings when the
  // cheapest ticket - the one a card shows - is what moved.
  invalidateAfterLivePriceSync(
    numericDbEventId,
    cheapestAvailableTicketPrice(ticketsAndRates) !==
      cheapestAvailableTicketPrice(nextTicketsAndRates),
  );

  console.log(
    `[TixStock Tickets] Synced ${priceUpdates.length} DB ticket price(s) for event ${dbEventId}`,
    priceUpdates,
  );

  return { priceUpdates, ticketsAndRates: nextTicketsAndRates };
}

// The two listing filters - restricted view, excluded sections - live in lib/tixstock-feed.ts
// with the feed read, because the cost snapshot confirm-order takes (lib/ticket-cost.ts) applies
// the very same ones. They and the quantity rule (lib/tixstock-quantity.ts) are MIRRORED in the
// backoffice (`lib/tixstock-listings.ts`) for its price sync: change both, or the sync and this
// route write different prices to the same ticket again (2026-10-07).

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  const dbEventId = req.nextUrl.searchParams.get("db_event_id");
  const requestedQuantity = Number(
    req.nextUrl.searchParams.get("ticket_quantity") ?? "2",
  );
  const excludedSectionsParam =
    req.nextUrl.searchParams.get("excluded_sections") ?? "";
  const excludedSections = excludedSectionsParam
    ? excludedSectionsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id" }, { status: 400 });
  }

  try {
    // toUsd() reads GBP/EUR rates synchronously - make sure they are live first.
    await exchangeRateService.ensureFresh();
    const { firstPage, listings: allListings } =
      await fetchTixstockFeed(eventId);

    // Normalise all proceed_price amounts to USD so the client never has to deal with currencies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalised = allListings.map((l: any) => ({
      ...l,
      proceed_price: {
        amount: toUsd(
          l.proceed_price?.amount ?? "0",
          l.proceed_price?.currency ?? "USD",
        ),
        currency: "USD",
      },
    }));

    // Filter out listings for excluded/disabled sections before returning
    const afterSections = excludedSections.length
      ? normalised.filter(
          (l: TixStockListing) => !isExcludedSection(l, excludedSections),
        )
      : normalised;

    if (excludedSections.length) {
      console.log(
        `[TixStock Tickets] Excluded ${normalised.length - afterSections.length} listing(s) from ${excludedSections.length} excluded section(s)`,
      );
    }

    // Filter out obstructed/restricted-view listings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = afterSections.filter(
      (l: TixStockListing) => !hasObstructedViewRestriction(l),
    );
    const obstructedCount = afterSections.length - filtered.length;
    if (obstructedCount > 0) {
      console.log(
        `[TixStock Tickets] Filtered out ${obstructedCount} obstructed/restricted-view listing(s)`,
      );
    }

    const { priceUpdates, ticketsAndRates } =
      await updateDbTicketPricesFromLiveListings(
        dbEventId,
        filtered,
        Number.isFinite(requestedQuantity) && requestedQuantity > 0
          ? requestedQuantity
          : 2,
      );

    // Return in the same shape the client expects: { success, data: { data: [...] } }
    return NextResponse.json({
      success: true,
      data: { ...firstPage, data: filtered },
      price_updates: priceUpdates,
      tickets_and_rates: ticketsAndRates,
    });
  } catch (error) {
    console.error(
      `[TixStock Tickets] Fetch failed for event ${eventId}:`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to fetch tickets", success: false },
      { status: 500 },
    );
  }
}
