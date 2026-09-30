import { NextResponse } from "next/server";
import { amadeus } from "../amadeusClient";
import { exchangeRateService } from "@/lib/exchangeRateService";
import {
  chargedCheckedBagsAmount,
  offerItineraries,
  roundTripBagUsd,
  withCheckedBag,
} from "@/lib/flights/bagGroups";
import {
  ELAL_CLASSIC_BRAND,
  ELAL_CLASSIC_UPGRADE_USD,
  FARE_UPGRADE_CARRIERS,
  validatingCarrier,
} from "@/lib/flights/elal";

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
  data?: {
    flightOffers?: Array<{
      price?: {
        currency?: string;
        additionalServices?: Array<{ amount?: string; type?: string }>;
      };
    }>;
  };
  included?: {
    bags?: Record<string, BaggageItem>;
  };
};

// Not exported: app/**/route.ts may only export the recognized route-handler
// symbols (GET/POST/dynamic/maxDuration/...) - app/order/hooks/useBagPricing.ts
// declares its own structurally-identical copy for the fetch() response shape
// instead of importing from here.
type BagPricingOption = {
  /** Per pax, per bag, for the WHOLE trip (every segment, both directions). */
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

// El Al (FARE_UPGRADE_CARRIERS): no ancillary bag at all - the one upsell is
// the fare upgrade to CLASSIC at a fixed price per traveler. Rules + why it
// is not quoted live: lib/flights/elal.ts.
type FareUpgradeOffer = {
  /** Branded-fare label, e.g. "CLASSIC". */
  brand: string;
  /** Whole-booking price added to the current offer, USD. */
  deltaTotalUsd: number;
  deltaPerPaxUsd: number;
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

// Amadeus lists incremental quantities as separate ancillary items - the
// qty-1 line prices a single bag, the qty-2 line (when the carrier files
// one) prices the pair. What a line's price covers, and why the checked bag
// is first read off a re-price WITH the bag on it: lib/flights/bagGroups.ts.
const CHECKED = (name: string) => name === "CHECKED_BAG";
const CABIN = (name: string) =>
  name !== "CHECKED_BAG" && name.toUpperCase().includes("CABIN");

export async function POST(request: Request) {
  // toUsd() reads the EUR rate synchronously - make sure it is live first.
  await exchangeRateService.ensureFresh();
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

  const numOfTravelers = flightOffer.travelerPricings.length;
  // null = every segment's fare already includes a checked bag.
  const offerWithBag = withCheckedBag(flightOffer);

  // El Al: only the upgrade to CLASSIC, never an ancillary bag - and nothing
  // to offer when the fare already is one with a bag. No Amadeus call.
  if (FARE_UPGRADE_CARRIERS.has(validatingCarrier(flightOffer))) {
    const fareUpgrade: FareUpgradeOffer = offerWithBag
      ? {
          brand: ELAL_CLASSIC_BRAND,
          deltaPerPaxUsd: ELAL_CLASSIC_UPGRADE_USD,
          deltaTotalUsd: ELAL_CLASSIC_UPGRADE_USD * numOfTravelers,
        }
      : null;
    return NextResponse.json({ bagOptions: null, fareUpgrade });
  }

  if (!amadeus) {
    console.error("bag-pricing: Amadeus client is not initialized.");
    return NextResponse.json({ bagOptions: null satisfies BagPricingOptions });
  }

  try {
    const clientRef = eventId
      ? `MYT-BAGS-${eventId}-${Math.floor(Date.now() / 1000)}`
      : `MYT-BAGS-${Math.floor(Date.now() / 1000)}`;

    const price = async (offer: FlightOffer): Promise<PricingResponseBody> => {
      const response = await amadeus.shopping.flightOffers.pricing.post(
        {
          data: {
            type: "flight-offers-pricing",
            flightOffers: [offer],
          },
        },
        { include: ["bags"], clientRef },
      );
      return JSON.parse(response.body) as PricingResponseBody;
    };

    // One call: the offer WITH a bag on it, so Amadeus states the charge for
    // the whole trip itself; the same answer carries the ancillary lines.
    let data: PricingResponseBody;
    try {
      data = await price(offerWithBag ?? flightOffer);
    } catch (error) {
      if (!offerWithBag) throw error;
      // The carrier refused the offer with a bag on it - read its lines off
      // the plain offer instead.
      console.warn("bag-pricing: re-price with a bag failed, reading lines:", error);
      data = await price(flightOffer);
    }

    const bagItems = Object.values(data.included?.bags ?? {});
    const itineraries = offerItineraries(flightOffer);
    const bagOptions: BagPricingOptions = {};

    const charged = offerWithBag
      ? chargedCheckedBagsAmount(data.data?.flightOffers?.[0])
      : null;
    const chargedTotalUsd = charged
      ? toUsd(charged.amount, charged.currencyCode)
      : null;
    const chargedUsd =
      chargedTotalUsd != null ? chargedTotalUsd / numOfTravelers : null;
    const linesUsd = roundTripBagUsd(bagItems, itineraries, 1, CHECKED, toUsd);
    if (
      chargedUsd != null &&
      linesUsd != null &&
      Math.abs(chargedUsd - linesUsd) > 1
    ) {
      // Two readings of the same bag disagree - the charge wins, and the log
      // says which carrier files its lines differently.
      console.warn(
        `bag-pricing: ${validatingCarrier(flightOffer)} charged $${chargedUsd.toFixed(2)} a traveler, its lines read $${linesUsd.toFixed(2)}`,
      );
    }

    const checkedUsd = chargedUsd ?? linesUsd;
    if (checkedUsd != null) {
      const unit = Math.ceil(checkedUsd);
      bagOptions.checked = { unitPriceUsd: unit, totalUsd: unit * numOfTravelers };
      // Second-bag pricing: prefer the carrier's own qty-2 ancillary (its
      // amount covers BOTH bags); UI falls back to 2×unit when absent.
      const twoUsd = roundTripBagUsd(bagItems, itineraries, 2, CHECKED, toUsd);
      if (twoUsd != null && twoUsd >= checkedUsd) {
        bagOptions.checked.twoBagsTotalPerPaxUsd = Math.ceil(twoUsd);
      }
    }

    const cabinUsd = roundTripBagUsd(bagItems, itineraries, 1, CABIN, toUsd);
    if (cabinUsd != null) {
      const unit = Math.ceil(cabinUsd);
      bagOptions.cabin = { unitPriceUsd: unit, totalUsd: unit * numOfTravelers };
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
