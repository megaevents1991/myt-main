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
  /** Price (per pax) for TWO checked bags, when the carrier files a
   *  quantity-2 ancillary. Absent → the UI charges 2 × unitPriceUsd. */
  twoBagsTotalPerPaxUsd?: number;
};

type BagPricingOptions = {
  checked?: BagPricingOption;
  cabin?: BagPricingOption;
} | null;

// Carriers whose "add a bag" is sold as a BRANDED-FARE upgrade instead of an
// ancillary (Dor 21.8: El Al → "שדרוג כרטיס" ל-Classic; everyone else keeps
// the per-bag add-on). Checked against the offer's validating carrier.
const FARE_UPGRADE_CARRIERS = new Set(["LY"]);

type FareUpgradeOffer = {
  /** Branded-fare label, e.g. "CLASSIC". */
  brand: string;
  /** Whole-booking price delta vs the current offer, USD. */
  deltaTotalUsd: number;
  deltaPerPaxUsd: number;
  /** The full upsell offer - the client swaps it onto the flight on accept. */
  offer: FlightOffer;
} | null;

/** Branded-fare alternatives for the offer (Amadeus Branded Fares Upsell);
 *  returns the cheapest one that includes a checked bag on EVERY segment,
 *  or null (API unavailable / nothing qualifying / not actually pricier). */
async function findFareUpgrade(
  flightOffer: FlightOffer,
  numOfTravelers: number,
): Promise<FareUpgradeOffer> {
  try {
    const response = await amadeus!.shopping.flightOffers.upselling.post({
      data: {
        type: "flight-offers-upselling",
        flightOffers: [flightOffer],
      },
    });
    const upsells = (JSON.parse(response.body)?.data ?? []) as Array<{
      price?: { grandTotal?: string; currency?: string };
      travelerPricings?: Array<{
        fareDetailsBySegment?: Array<{
          brandedFare?: string;
          brandedFareLabel?: string;
          includedCheckedBags?: { quantity?: number; weight?: number };
        }>;
      }>;
    }>;

    const baseTotal = toUsd(
      String(flightOffer.price?.grandTotal ?? ""),
      String(flightOffer.price?.currency ?? "USD"),
    );
    if (baseTotal == null) return null;

    let best: FareUpgradeOffer = null;
    for (const offer of upsells) {
      const segs = offer.travelerPricings?.[0]?.fareDetailsBySegment ?? [];
      if (!segs.length) continue;
      const allHaveBag = segs.every(
        (s) =>
          (s.includedCheckedBags?.quantity ?? 0) >= 1 ||
          (s.includedCheckedBags?.weight ?? 0) > 0,
      );
      if (!allHaveBag) continue;
      const totalUsd = toUsd(
        String(offer.price?.grandTotal ?? ""),
        String(offer.price?.currency ?? "USD"),
      );
      if (totalUsd == null || totalUsd <= baseTotal) continue;
      const deltaTotalUsd = Math.ceil(totalUsd - baseTotal);
      if (!best || deltaTotalUsd < best.deltaTotalUsd) {
        best = {
          brand:
            segs[0].brandedFareLabel || segs[0].brandedFare || "CLASSIC",
          deltaTotalUsd,
          deltaPerPaxUsd: Math.ceil(deltaTotalUsd / Math.max(1, numOfTravelers)),
          offer: offer as unknown as FlightOffer,
        };
      }
    }
    return best;
  } catch (error) {
    // Fail soft - the upsell API may not be enabled on the contract; the
    // caller falls back to the plain ancillary-bag path.
    console.error("bag-pricing: branded-fares upsell failed:", error);
    return null;
  }
}

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

// Amadeus lists incremental quantities as separate ancillary items - the
// qty-1 line prices a single bag, the qty-2 line (when the carrier files
// one) prices the pair.
const cheapestOfQty = (
  items: BaggageItem[],
  quantity: number,
  matchesName: (name: string) => boolean,
): BaggageItem | null =>
  items
    .filter((item) => item.quantity === quantity && matchesName(item.name || ""))
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

    // El Al (and any future FARE_UPGRADE_CARRIERS member): offer a branded
    // fare upgrade ("שדרוג כרטיס" ל-Classic) instead of an ancillary bag.
    // Falls through to the plain bag path when no qualifying upsell exists.
    const validating =
      flightOffer.validatingAirlineCodes?.[0] ??
      flightOffer.itineraries?.[0]?.segments?.[0]?.carrierCode ??
      "";
    if (FARE_UPGRADE_CARRIERS.has(String(validating).toUpperCase())) {
      const fareUpgrade = await findFareUpgrade(flightOffer, numOfTravelers);
      if (fareUpgrade) {
        return NextResponse.json({ bagOptions: null, fareUpgrade });
      }
    }

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

    const checkedItem = cheapestOfQty(
      bagItems,
      1,
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
        // Second-bag pricing: prefer the carrier's own qty-2 ancillary (its
        // amount covers BOTH bags); UI falls back to 2×unit when absent.
        const twoBagItem = cheapestOfQty(bagItems, 2, (name) => name === "CHECKED_BAG");
        if (twoBagItem) {
          const twoUsd = toUsd(twoBagItem.price.amount, twoBagItem.price.currencyCode);
          if (twoUsd != null && twoUsd >= unitPriceUsd) {
            bagOptions.checked.twoBagsTotalPerPaxUsd = Math.ceil(twoUsd);
          }
        }
      }
    }

    const cabinItem = cheapestOfQty(
      bagItems,
      1,
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
