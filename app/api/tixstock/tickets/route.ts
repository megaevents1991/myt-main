import { NextRequest, NextResponse } from "next/server";
import { exchangeRateService } from "@/lib/exchangeRateService";
import type { TixStockListing } from "@/lib/tixstock.types";

const TIXSTOCK_API_URL = process.env.NEXT_SECRET_TIXSTOCK_API_URL as string;
const TIXSTOCK_TOKEN = process.env.NEXT_SECRET_TIXSTOCK_TOKEN as string;

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

/** Return true if a restriction text signals any kind of obstructed / degraded view. */
function isObstructedViewText(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    (lower.includes("limited") || lower.includes("partial")) &&
    lower.includes("view")
  )
    return true;
  if (lower.includes("restricted") && lower.includes("view")) return true;
  if (/\brestr?\.?\s*view\b/.test(lower)) return true;
  if (/\br[\.\/]?v\.?\b/.test(lower)) return true;
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
  return excludedSections.some((excl) => {
    const lastUnderscore = excl.lastIndexOf("_");
    if (lastUnderscore === -1) return false;
    const catSlug = excl.substring(0, lastUnderscore);
    const sectionId = excl.substring(lastUnderscore + 1).toLowerCase();
    return listingCatSlug === catSlug && listingSection === sectionId;
  });
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
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
        currency: "USD",
        amount: toUsd(
          l.proceed_price?.amount ?? "0",
          l.proceed_price?.currency ?? "USD",
        ),
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
    const filtered = afterSections.filter(
      (l: TixStockListing) => !hasObstructedViewRestriction(l),
    );
    const obstructedCount = afterSections.length - filtered.length;
    if (obstructedCount > 0) {
      console.log(
        `[TixStock Tickets] Filtered out ${obstructedCount} obstructed/restricted-view listing(s)`,
      );
    }

    // Return in the same shape the client expects: { success, data: { data: [...] } }
    return NextResponse.json({
      success: true,
      data: { ...firstPage, data: filtered },
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
