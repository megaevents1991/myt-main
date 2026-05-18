import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { supabase } from "@/lib/supabase";
import type { EventTicket } from "@/lib/app.types";
import type { TixStockListing } from "@/lib/tixstock.types";

const TIXSTOCK_API_URL = process.env.NEXT_SECRET_TIXSTOCK_API_URL as string;
const TIXSTOCK_TOKEN = process.env.NEXT_SECRET_TIXSTOCK_TOKEN as string;
const REVALIDATE_API_ORIGIN = "https://www.mega-events.co.il";

/** Convert an amount string in any supported currency to USD, with per-currency markup */
function toUsd(amount: string, currency: string): string {
  const value = parseFloat(amount);
  if (isNaN(value)) return amount;
  const cur = currency.toUpperCase();
  if (cur === "USD") return ((value + 40) * 1.035).toFixed(2);
  if (cur === "GBP") {
    const rate = exchangeRateService.getGbpUsdRate().rate;
    return ((value + 35) * rate * 1.035).toFixed(2);
  }
  if (cur === "EUR") {
    const rate = exchangeRateService.getEurUsdRate().rate;
    return ((value + 40) * rate * 1.035).toFixed(2);
  }
  // Unknown currency — return as-is and log
  console.warn(
    `[TixStock Tickets] Unknown currency "${currency}", not converting`,
  );
  return amount;
}

/** Slugify a name the same way the SVG map IDs are built */
function slugify(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeCategory(category: string | undefined | null): string {
  return (category || "").trim().toLowerCase();
}

function listingCanSatisfyQuantity(
  listing: TixStockListing,
  requestedQuantity: number,
): boolean {
  const quantityAvailable =
    listing.number_of_tickets_for_sale?.quantity_available ?? 0;
  const splitQuantity = listing.number_of_tickets_for_sale?.split_quantity ?? 0;

  if (requestedQuantity === 1) {
    return quantityAvailable === 1 || quantityAvailable === splitQuantity;
  }

  return quantityAvailable >= requestedQuantity || splitQuantity >= requestedQuantity;
}

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

async function callRevalidateEndpoint() {
  const secret = process.env.NEXT_SECRET_REVALIDATION_SECRET;
  if (!secret) {
    console.warn(
      "[TixStock Tickets] Skipping /api/revalidate call: missing NEXT_SECRET_REVALIDATION_SECRET",
    );
    return;
  }

  try {
    const revalidateUrl = new URL("/api/revalidate", REVALIDATE_API_ORIGIN);
    revalidateUrl.searchParams.set("secret", secret);

    const response = await fetch(revalidateUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(
        `[TixStock Tickets] /api/revalidate returned ${response.status}: ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error("[TixStock Tickets] Failed to call /api/revalidate:", error);
  }
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

  revalidateTag("events");
  callRevalidateEndpoint();

  console.log(
    `[TixStock Tickets] Synced ${priceUpdates.length} DB ticket price(s) for event ${dbEventId}`,
    priceUpdates,
  );

  return { priceUpdates, ticketsAndRates: nextTicketsAndRates };
}

/** Return true if a restriction text signals any kind of obstructed / degraded view. */
function isObstructedViewText(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    (lower.includes("limited") ||
      lower.includes("side") ||
      lower.includes("restricted") ||
      lower.includes("partial")) &&
    lower.includes("view")
  )
    return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasObstructedViewRestriction(listing: any): boolean {
  const rb = listing.restrictions_benefits;
  if (!rb) return false;
  if (rb.other && isObstructedViewText(String(rb.other))) return true;
  const options: unknown[] = Array.isArray(rb.options) ? rb.options : [];
  return options.some((opt) => {
    const text =
      typeof opt === "string"
        ? opt
        : `${(opt as { name?: string })?.name ?? ""} ${(opt as { value?: string })?.value ?? ""}`;
    return isObstructedViewText(text);
  });
}

/**
 * Return true when a listing's seat_details match one of the excluded
 * section IDs (format: "{category-slug}_{section-number}").
 */
function isExcludedSection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  excludedSections: string[],
): boolean {
  if (excludedSections.length === 0) return false;
  const listingCatSlug = slugify(listing.seat_details?.category ?? "");
  const listingSection = (listing.seat_details?.section ?? "")
    .trim()
    .toLowerCase();
  const listingSectionSlug = slugify(listingSection);

  const parsedExcludedSections = excludedSections
    .map((excl) => {
      const lastUnderscore = excl.lastIndexOf("_");
      if (lastUnderscore === -1) return null;
      return {
        catSlug: excl.substring(0, lastUnderscore),
        sectionId: excl.substring(lastUnderscore + 1).toLowerCase(),
      };
    })
    .filter(
      (section): section is { catSlug: string; sectionId: string } =>
        section !== null,
    );

  const isCategoryOnlyListing =
    listingCatSlug !== "" && listingSectionSlug === listingCatSlug;
  const hasConcreteExcludedSectionInCategory = parsedExcludedSections.some(
    ({ catSlug, sectionId }) =>
      catSlug === listingCatSlug &&
      sectionId !== "" &&
      sectionId !== listingCatSlug,
  );

  return parsedExcludedSections.some(({ catSlug, sectionId }) => {
    if (listingCatSlug !== catSlug) return false;

    if (isCategoryOnlyListing) {
      return hasConcreteExcludedSectionInCategory;
    }

    return listingSection === sectionId;
  });
}

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
    const fetchPage = async (page: number) => {
      const params = new URLSearchParams({
        event_id: eventId,
        per_page: "50",
        order_by: "price",
        sort_order: "asc",
        page: String(page),
      });
      const res = await fetch(
        `${TIXSTOCK_API_URL}/tickets/feed?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${TIXSTOCK_TOKEN}`,
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        throw new Error(`Upstream ${res.status} ${res.statusText}`);
      }
      return res.json();
    };

    // Fetch first page to discover total pages
    const firstPage = await fetchPage(1);
    const lastPage: number = firstPage?.meta?.last_page ?? 1;

    let allListings = firstPage?.data ?? [];

    if (lastPage > 1) {
      const remaining = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 2)),
      );
      for (const page of remaining) {
        allListings = allListings.concat(page?.data ?? []);
      }
    }

    console.log(
      `[TixStock Tickets] Fetched ${allListings.length} listings across ${lastPage} page(s) for event ${eventId}`,
    );

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
