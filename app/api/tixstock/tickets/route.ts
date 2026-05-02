import { NextRequest, NextResponse } from "next/server";
import { exchangeRateService } from "@/lib/exchangeRateService";

const TIXSTOCK_API_URL = process.env.NEXT_SECRET_TIXSTOCK_API_URL as string;
const TIXSTOCK_TOKEN = process.env.NEXT_SECRET_TIXSTOCK_TOKEN as string;

/** Convert an amount string in any supported currency to USD */
function toUsd(amount: string, currency: string): string {
  const value = parseFloat(amount);
  if (isNaN(value)) return amount;
  const cur = currency.toUpperCase();
  if (cur === "USD") return amount;
  if (cur === "GBP") {
    const rate = exchangeRateService.getGbpUsdRate().rate;
    return (value * rate).toFixed(2);
  }
  if (cur === "EUR") {
    const rate = exchangeRateService.getEurUsdRate().rate;
    return (value * rate).toFixed(2);
  }
  // Unknown currency — return as-is and log
  console.warn(
    `[TixStock Tickets] Unknown currency "${currency}", not converting`,
  );
  return amount;
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");

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

    // Return in the same shape the client expects: { success, data: { data: [...] } }
    return NextResponse.json({
      success: true,
      data: { ...firstPage, data: normalised },
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
