// Server-only: reads NEXT_SECRET_* env. (No `server-only` guard - the package
// isn't a dependency here; never import this from a client component.)
import { unstable_cache } from "next/cache";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { supplierCostToUsd } from "@/lib/supplier-pricing";

/**
 * Live LiveTickets (doctorticket) stock for one of THEIR events.
 *
 * The backoffice cron already calls the same endpoint twice a day to refresh
 * DB prices; this is the order page's live read. It never writes to the DB and
 * the upstream answer is cached ~90s per event, so a busy order page costs the
 * supplier about one call a minute, not one per visitor.
 */
const LIVE_API_URL = process.env.NEXT_SECRET_LIVE_API_URL;
const LIVE_API_KEY = process.env.NEXT_SECRET_LIVE_API_KEY;

const UPSTREAM_TIMEOUT_MS = 4000;
const CACHE_SECONDS = 90;

/** LiveTickets `currency` codes. */
const CURRENCY_BY_CODE: Record<number, string> = {
  1: "USD",
  2: "EUR",
  3: "GBP",
  4: "ILS",
};

/** The slice of a `getOneEvent` ticket category we read. */
interface UpstreamCategory {
  id: number;
  title?: string;
  cost?: number;
  maxTicketAmount?: number;
  seatingGroupMAXSize?: number | null;
  apiImmediatePurchase?: boolean;
}

interface UpstreamEvent {
  currency?: number;
  ticketCategory?: UpstreamCategory[];
}

type RawCategory = {
  id: string;
  title: string;
  cost: number;
  maxPerOrder: number;
  seatingGroupMax: number | null;
};

type RawStock = { currency: string; categories: RawCategory[] };

export type LiveTicketsOffer = {
  /** LiveTickets category id - equals `EventTicket.id` of the matching ticket. */
  id: string;
  title: string;
  /** Selling price in USD, rounded up. */
  priceUsd: number;
  maxPerOrder: number;
  seatingGroupMax: number | null;
};

export const isLiveTicketsConfigured = (): boolean =>
  Boolean(LIVE_API_URL && LIVE_API_KEY);

async function fetchStock(eid: string): Promise<RawStock> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${LIVE_API_URL}/Events/getOneEvent?eid=${encodeURIComponent(eid)}`,
      {
        headers: { Authorization: LIVE_API_KEY ?? "" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) throw new Error(`Upstream ${res.status}`);

    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error("Unexpected response shape");
    // An empty array is how LiveTickets says "sold out".
    const event = body[0] as UpstreamEvent | undefined;
    if (!event) return { currency: "USD", categories: [] };

    const currency = CURRENCY_BY_CODE[event.currency ?? 0];
    if (!currency) throw new Error(`Unknown currency code ${event.currency}`);

    const categories = (event.ticketCategory ?? [])
      // Hard rule: only categories LiveTickets confirms instantly are sold.
      .filter((c) => c.apiImmediatePurchase === true)
      .filter((c) => Number.isFinite(c.cost) && (c.maxTicketAmount ?? 0) >= 1)
      .map((c) => ({
        id: String(c.id),
        title: c.title ?? "",
        cost: c.cost as number,
        maxPerOrder: c.maxTicketAmount as number,
        seatingGroupMax: c.seatingGroupMAXSize ?? null,
      }));

    return { currency, categories };
  } finally {
    clearTimeout(timer);
  }
}

// A thrown error is never cached, so an outage is retried on the next request
// while a good answer is reused for CACHE_SECONDS.
const cachedStock = unstable_cache(fetchStock, ["livetickets-stock"], {
  revalidate: CACHE_SECONDS,
});

/**
 * Sellable offers for a LiveTickets event, priced in USD.
 * `null` = LiveTickets unreachable / misconfigured (caller falls back to the
 * DB price). `[]` = reachable and nothing sellable.
 */
export async function getLiveTicketsOffers(
  eid: string,
): Promise<LiveTicketsOffer[] | null> {
  if (!isLiveTicketsConfigured()) {
    console.warn("[LiveTickets] Missing NEXT_SECRET_LIVE_API_URL/KEY");
    return null;
  }

  try {
    const [stock] = await Promise.all([
      cachedStock(eid),
      exchangeRateService.ensureFresh(),
    ]);

    return stock.categories.reduce<LiveTicketsOffer[]>((offers, category) => {
      const usd = supplierCostToUsd(category.cost, stock.currency);
      if (usd === null) return offers;
      offers.push({
        id: category.id,
        title: category.title,
        priceUsd: Math.ceil(usd),
        maxPerOrder: category.maxPerOrder,
        seatingGroupMax: category.seatingGroupMax,
      });
      return offers;
    }, []);
  } catch (error) {
    console.error(
      `[LiveTickets] Live stock failed for event ${eid}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
