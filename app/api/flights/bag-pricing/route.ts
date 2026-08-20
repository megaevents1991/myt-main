import { NextResponse } from "next/server";
import { amadeus } from "../amadeusClient";
import { exchangeRateService } from "@/lib/exchangeRateService";

export const maxDuration = 20;

// A single ancillary line from Amadeus's `included.bags` dictionary
// (Flight Offers Pricing, ?include=bags). `name` is carrier-defined -
// "CHECKED_BAG" is the common one; a cabin/trolley ancillary (when a carrier
// actually sells one this way) shows up under a name containing "CABIN".
type BaggageItem = {
  quantity: number;
  name: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  bookableByItinerary: boolean;
  segmentIds: string[];
  travelerIds: string[];
};

type PricingResponseBody = {
  included?: {
    bags?: Record<string, BaggageItem>;
  };
};

// Not exported: app/**/route.ts may only export the recognized route-handler
// symbols (GET/POST/dynamic/maxDuration/...) - app/order/hooks/useBagPricing.ts
// declares its own structurally-identical copy for the fetch() response shape
// instead of importing from here.
type BagPricingOption = {
  unitPriceUsd: number;
  totalUsd: number;
};

type BagPricingOptions = {
  checked?: BagPricingOption;
  cabin?: BagPricingOption;
} | null;

/** Amadeus ancillary prices come back in whatever currency the fare was
 *  filed in - usually USD (the search itself requests currencyCode=USD, see
 *  app/api/flights/search/route.ts), occasionally EUR. Converts via the
 *  same eurUsd rate the rest of the app uses; any other currency is
 *  rejected rather than mispriced. */
const toUsd = (amount: string, currencyCode: string): number | null => {
  const value = parseFloat(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (currencyCode === "USD") return value;
  if (currencyCode === "EUR") {
    const { rate } = exchangeRateService.getEurUsdRate();
    return Number.isFinite(rate) && rate > 0 ? value * rate : null;
  }
  console.warn(`bag-pricing: unhandled ancillary currency ${currencyCode}`);
  return null;
};

// One bag per traveler, v1 - the "single unit" ancillary line is the one
// with quantity 1 (Amadeus lists incremental quantities as separate items).
const cheapestSingleUnit = (
  items: BaggageItem[],
  matchesName: (name: string) => boolean,
): BaggageItem | null =>
  items
    .filter((item) => item.quantity === 1 && matchesName(item.name || ""))
    .reduce<BaggageItem | null>((best, item) => {
      const price = parseFloat(item.price?.amount ?? "");
      if (!Number.isFinite(price)) return best;
      if (!best) return item;
      const bestPrice = parseFloat(best.price?.amount ?? "");
      return price < bestPrice ? item : best;
    }, null);

export async function POST(request: Request) {
  let flightOffer: FlightOffer | undefined;
  let virtual = false;
  let eventId: number | string | undefined;
  try {
    ({ flightOffer, virtual = false, eventId } = await request.json());
  } catch (error) {
    console.error("bag-pricing: invalid request body:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Nothing chargeable to offer: a virtual (manually-modeled) offer, an
  // offline flight (no Amadeus offer at all - offer is `{}`), or a
  // malformed offer. Fail SOFT (200, bagOptions: null) - this is an
  // optional upsell, never worth turning into a red error state on the
  // summary page.
  if (
    virtual ||
    !flightOffer ||
    typeof flightOffer !== "object" ||
    Object.keys(flightOffer).length === 0 ||
    !Array.isArray(flightOffer.travelerPricings) ||
    flightOffer.travelerPricings.length === 0
  ) {
    return NextResponse.json({ bagOptions: null satisfies BagPricingOptions });
  }

  if (!amadeus) {
    console.error("bag-pricing: Amadeus client is not initialized.");
    return NextResponse.json({ bagOptions: null satisfies BagPricingOptions });
  }

  try {
    const numOfTravelers = flightOffer.travelerPricings.length;
    const clientRef = eventId
      ? `MYT-BAGS-${eventId}-${Math.floor(Date.now() / 1000)}`
      : `MYT-BAGS-${Math.floor(Date.now() / 1000)}`;

    const response = await amadeus.shopping.flightOffers.pricing.post(
      {
        data: {
          type: "flight-offers-pricing",
          flightOffers: [flightOffer],
        },
      },
      { include: ["bags"], clientRef },
    );

    const data = JSON.parse(response.body) as PricingResponseBody;
    const bagItems = Object.values(data.included?.bags ?? {});

    const bagOptions: BagPricingOptions = {};

    const checkedItem = cheapestSingleUnit(
      bagItems,
      (name) => name === "CHECKED_BAG",
    );
    if (checkedItem) {
      const unitPriceUsd = toUsd(
        checkedItem.price.amount,
        checkedItem.price.currencyCode,
      );
      if (unitPriceUsd != null) {
        const unit = Math.ceil(unitPriceUsd);
        bagOptions.checked = { unitPriceUsd: unit, totalUsd: unit * numOfTravelers };
      }
    }

    const cabinItem = cheapestSingleUnit(
      bagItems,
      (name) => name !== "CHECKED_BAG" && name.toUpperCase().includes("CABIN"),
    );
    if (cabinItem) {
      const unitPriceUsd = toUsd(cabinItem.price.amount, cabinItem.price.currencyCode);
      if (unitPriceUsd != null) {
        const unit = Math.ceil(unitPriceUsd);
        bagOptions.cabin = { unitPriceUsd: unit, totalUsd: unit * numOfTravelers };
      }
    }

    return NextResponse.json({
      bagOptions: bagOptions.checked || bagOptions.cabin ? bagOptions : null,
    });
  } catch (error) {
    // Never fail the order summary over an ancillary-pricing hiccup - hide
    // the upsell instead (same fail-soft posture as the guards above).
    console.error("bag-pricing: Amadeus pricing call failed:", error);
    return NextResponse.json({ bagOptions: null satisfies BagPricingOptions });
  }
}
