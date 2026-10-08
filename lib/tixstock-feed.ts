// Server-only: reads NEXT_SECRET_* env. Never import this from a client component.
import type { EventTicket } from "@/lib/app.types";
import type { TixStockListing } from "@/lib/tixstock.types";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { rawCostToUsd, supplierCostToUsd } from "@/lib/supplier-pricing";
import { normalizeTxCategory } from "@/lib/tixstock-category";
import { categoryMatchesMapId, UNLABELED_SECTION_MARK } from "@/lib/tixstock-map";
import {
  listingCanSatisfyQuantity,
  listingSeatsTogether,
} from "@/lib/tixstock-quantity";

/**
 * TixStock's listing feed for one of THEIR events, shared by the order page's
 * route (app/api/tixstock/tickets) and the cost snapshot confirm-order takes
 * (lib/ticket-cost.ts).
 */

/** The slice of a `/tickets/feed` page we read. The route echoes the rest back untouched. */
export type TixstockFeedPage = {
  data?: TixStockListing[];
  meta?: { last_page?: number };
};

export type TixstockFeed = {
  /** The first page as TixStock sent it (the route hands its meta/links on). */
  firstPage: TixstockFeedPage;
  listings: TixStockListing[];
  lastPage: number;
};

/** One deadline for the whole feed read when a caller is on a checkout's clock. */
export const COST_FEED_TIMEOUT_MS = 4_000;

/**
 * Every page of an event's feed. `proceed_price` is left in the seller's
 * currency. Throws on an upstream error. `timeoutMs` (default: none, exactly the
 * order page's behaviour) puts ONE deadline over all the pages together.
 */
export async function fetchTixstockFeed(
  tixstockEventId: string,
  opts: { timeoutMs?: number } = {},
): Promise<TixstockFeed> {
  const apiUrl = process.env.NEXT_SECRET_TIXSTOCK_API_URL as string;
  const token = process.env.NEXT_SECRET_TIXSTOCK_TOKEN as string;
  const signal = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;

  const fetchPage = async (page: number): Promise<TixstockFeedPage> => {
    const params = new URLSearchParams({
      event_id: tixstockEventId,
      per_page: "50",
      order_by: "price",
      sort_order: "asc",
      page: String(page),
    });
    const res = await fetch(`${apiUrl}/tickets/feed?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) {
      throw new Error(`Upstream ${res.status} ${res.statusText}`);
    }
    return res.json();
  };

  // Fetch first page to discover total pages
  const firstPage = await fetchPage(1);
  const lastPage: number = firstPage?.meta?.last_page ?? 1;

  let allListings: TixStockListing[] = firstPage?.data ?? [];

  if (lastPage > 1) {
    const remaining = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 2)),
    );
    for (const page of remaining) {
      allListings = allListings.concat(page?.data ?? []);
    }
  }

  console.log(
    `[TixStock Tickets] Fetched ${allListings.length} listings across ${lastPage} page(s) for event ${tixstockEventId}`,
  );

  return { firstPage, listings: allListings, lastPage };
}

/** Every listing of a TixStock event, raw (proceed_price in the seller's currency). Shared by the tickets route and the confirm-order cost snapshot. */
export async function fetchTixstockListingsRaw(
  tixstockEventId: string,
  opts: { timeoutMs?: number } = {},
): Promise<TixStockListing[]> {
  return (await fetchTixstockFeed(tixstockEventId, opts)).listings;
}

// The two filters below - restricted view, excluded sections - and the quantity rule
// (lib/tixstock-quantity.ts) decide which listing prices a ticket. They are MIRRORED in the
// backoffice (`lib/tixstock-listings.ts`) for its price sync: change both, or the sync and
// this route write different prices to the same ticket again (2026-10-07).

/** Slugify a name the same way the SVG map IDs are built */
function slugify(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
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
export function hasObstructedViewRestriction(listing: any): boolean {
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
export function isExcludedSection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  excludedSections: string[],
): boolean {
  if (excludedSections.length === 0) return false;
  const listingCategory: string = listing.seat_details?.category ?? "";
  const listingCatSlug = slugify(listingCategory);
  // The excluded id carries the category as the DRAWING names it, the listing
  // as TixStock names it today - they drift apart (the older Bernabéu file says
  // "categoría-1", listings say "CATEGORÍA 1 (CAT1)"), and an exact slug match
  // then let every excluded section sell (QA 23.09). Same rule as the map.
  const sameCategory = (catSlug: string) =>
    catSlug === listingCatSlug || categoryMatchesMapId(listingCategory, catSlug);
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
  // Numbered unlabeled wedges (`lower-tier_~3`, see numberUnlabeledSections
  // in lib/tixstock-map.ts) carry no tickets - like the legacy empty id, they
  // must not count as a concrete section that hides category-only listings.
  const hasConcreteExcludedSectionInCategory = parsedExcludedSections.some(
    ({ catSlug, sectionId }) =>
      sameCategory(catSlug) &&
      sectionId !== "" &&
      !sectionId.startsWith(UNLABELED_SECTION_MARK) &&
      sectionId !== listingCatSlug,
  );

  return parsedExcludedSections.some(({ catSlug, sectionId }) => {
    if (!sameCategory(catSlug)) return false;

    if (isCategoryOnlyListing) {
      return hasConcreteExcludedSectionInCategory;
    }

    return listingSection === sectionId;
  });
}

/**
 * Per-ticket cost (USD) of the cheapest listing the SITE would sell for this
 * category and party - the route's two filters (excluded sections, restricted
 * view) + `listingCanSatisfyQuantity` - or null when no listing qualifies.
 *
 * "Cheapest" is by the SELLING price (`supplierCostToUsd`, what the order page
 * ranks by), so this is the very listing the customer was offered; what is
 * returned is that listing's COST: `proceed_price` at the live rate, before our
 * markup and the card step (`rawCostToUsd`) - the same cost side LiveTickets'
 * `costUsd` is.
 *
 * `together` = the customer took the "all together" twin of a split listing
 * (OrderTicket.seatingChoice), which the site prices from the cheapest listing
 * whose seats sit together.
 *
 * The excluded sections and the ticket's category come from OUR event row, not
 * from the order the browser sent. Throws on a failed read (the caller treats
 * that as "no snapshot").
 */
export async function cheapestListingCostUsd(opts: {
  tixstockEventId: string;
  eventId: number;
  ticketId: string | null;
  category: string | null;
  quantity: number;
  together?: boolean;
}): Promise<number | null> {
  // Imported here, not at the top: building the client needs the service env,
  // and a module that only needs the pure helpers above must load without it.
  const { supabase } = await import("@/lib/supabase");
  const { data: eventRow, error } = await supabase
    .from("events")
    .select("tx_excluded_sections, tickets_and_rates")
    .eq("id", opts.eventId)
    .maybeSingle();
  if (error || !eventRow) {
    throw new Error(
      `event ${opts.eventId} could not be read: ${error ? error.message : "not found"}`,
    );
  }

  const tickets = (eventRow.tickets_and_rates ?? []) as EventTicket[];
  const ownTicket = opts.ticketId
    ? tickets.find((t) => t.id === opts.ticketId)
    : undefined;
  const wanted = normalizeTxCategory(ownTicket?.category ?? opts.category);
  if (!wanted) return null;

  const excluded: string[] = Array.isArray(eventRow.tx_excluded_sections)
    ? (eventRow.tx_excluded_sections as string[])
    : [];

  const [listings] = await Promise.all([
    fetchTixstockListingsRaw(opts.tixstockEventId, {
      timeoutMs: COST_FEED_TIMEOUT_MS,
    }),
    // The rates are read synchronously below.
    exchangeRateService.ensureFresh(),
  ]);

  let best: { selling: number; cost: number } | null = null;
  for (const listing of listings) {
    if (normalizeTxCategory(listing.seat_details?.category) !== wanted) continue;
    if (isExcludedSection(listing, excluded)) continue;
    if (hasObstructedViewRestriction(listing)) continue;
    if (!listingCanSatisfyQuantity(listing, opts.quantity)) continue;
    if (opts.together && !listingSeatsTogether(listing)) continue;

    const amount = parseFloat(listing.proceed_price?.amount ?? "NaN");
    const currency = listing.proceed_price?.currency ?? "USD";
    const selling = supplierCostToUsd(amount, currency);
    const cost = rawCostToUsd(amount, currency);
    if (selling === null || cost === null) continue;

    if (best === null || selling < best.selling) best = { selling, cost };
  }

  return best ? best.cost : null;
}
