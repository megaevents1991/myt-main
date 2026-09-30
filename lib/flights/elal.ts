/**
 * El Al on the order summary: a bag is never sold as an add-on - the only
 * upsell is the fare upgrade LITE -> CLASSIC (Alon + Dor, 30.09). Every number
 * the customer reads about it lives here, so the chip, its info bubble and the
 * Penalties dialog cannot disagree.
 *
 * The price (Dor, 30.09): Amadeus' own CLASSIC fare for the SAME flights when
 * it costs more than $120 a traveler (rounded up), else $120. Amadeus' Branded
 * Fares Upsell endpoint is not on our Enterprise contract (401 on every call,
 * prod included), so the CLASSIC offer comes from a second search with
 * `includedCheckedBagsOnly` - measured 30.09: $100-120 a traveler over LITE
 * (LON / MAD 100, PAR 110, BCN / MIL 120). When that search finds nothing the
 * price is the fixed $120 and the stored offer stays LITE.
 */

/** Carriers sold as a fare upgrade instead of an ancillary bag. */
export const FARE_UPGRADE_CARRIERS: ReadonlySet<string> = new Set(["LY"]);

export const ELAL_CLASSIC_BRAND = "CLASSIC";

/** The floor, per traveler, for the whole round trip. */
export const ELAL_CLASSIC_UPGRADE_USD = 120;

/** CLASSIC's cancellation fee per traveler, and until when it applies. The
 *  fee is what Amadeus' own fare rule reads (USD 190 on 30.09, LON / BCN /
 *  MIL; LITE: non-refundable) - Dor, 30.09. */
export const ELAL_CLASSIC_CANCEL_FEE_USD = 190;
export const ELAL_CLASSIC_CANCEL_HOURS = 48;

/** The info bubble next to "שדרוג לקלאסיק". */
export const ELAL_CLASSIC_INFO_HE = `שדרוג זה מקנה מזוודה לבטן המטוס, הושבה ללא עלות באתר אל על ודמי ביטול נוחים על הטיסה של ${ELAL_CLASSIC_CANCEL_FEE_USD} דולר עד ${ELAL_CLASSIC_CANCEL_HOURS} שעות לפני ההמראה.`;

/** What the customer pays per traveler: Amadeus' CLASSIC delta when it is
 *  above the floor (rounded up), else the floor. null = no quote. */
export const elalClassicUpgradeUsd = (amadeusDeltaPerPax: number | null): number => {
  if (amadeusDeltaPerPax == null || !Number.isFinite(amadeusDeltaPerPax)) {
    return ELAL_CLASSIC_UPGRADE_USD;
  }
  return Math.max(ELAL_CLASSIC_UPGRADE_USD, Math.ceil(amadeusDeltaPerPax));
};

type Segment = {
  carrierCode?: string;
  number?: string;
  departure?: { iataCode?: string; at?: string };
  arrival?: { iataCode?: string; at?: string };
};
type FareSegment = {
  includedCheckedBags?: { quantity?: number; weight?: number };
};
export type OfferLike = {
  validatingAirlineCodes?: string[];
  itineraries?: Array<{ segments?: Segment[] }>;
  travelerPricings?: Array<{
    travelerType?: string;
    fareDetailsBySegment?: FareSegment[];
  }>;
  price?: { currency?: string; grandTotal?: string };
};

/** The validating carrier of an Amadeus offer, upper-cased ("" when unknown). */
export const validatingCarrier = (offer: OfferLike): string =>
  String(
    offer.validatingAirlineCodes?.[0] ??
      offer.itineraries?.[0]?.segments?.[0]?.carrierCode ??
      "",
  ).toUpperCase();

/** Every segment's fare carries a checked bag (by count or by weight) - what
 *  tells a CLASSIC offer from a LITE one. */
export const offerIncludesCheckedBag = (offer: OfferLike): boolean => {
  const fares = offer.travelerPricings?.[0]?.fareDetailsBySegment ?? [];
  return (
    fares.length > 0 &&
    fares.every(
      (f) =>
        (f.includedCheckedBags?.quantity ?? 0) > 0 ||
        (f.includedCheckedBags?.weight ?? 0) > 0,
    )
  );
};

/** The flights of an offer as one string - carrier, number and departure time
 *  of every segment, itinerary by itinerary. Ids differ between searches, the
 *  flights do not. */
const flightKey = (offer: OfferLike): string =>
  (offer.itineraries ?? [])
    .map((it) =>
      (it.segments ?? [])
        .map((s) => `${s.carrierCode ?? ""}${s.number ?? ""}@${s.departure?.at ?? ""}`)
        .join("+"),
    )
    .join("|");

/** Same flights, same times, in the same order. */
export const sameFlights = (a: OfferLike, b: OfferLike): boolean => {
  const key = flightKey(a);
  return key !== "" && key === flightKey(b);
};

/**
 * The POST search that returns the bag-included fares for exactly the offer's
 * route, dates and party (`includedCheckedBagsOnly`, this carrier only). null
 * when the offer lacks what the search needs.
 */
export const classicSearchBody = (offer: OfferLike): Record<string, unknown> | null => {
  const carrier = validatingCarrier(offer);
  const itineraries = offer.itineraries ?? [];
  const originDestinations: Array<Record<string, unknown>> = [];
  for (const [i, it] of itineraries.entries()) {
    const first = it.segments?.[0];
    const last = it.segments?.[it.segments.length - 1];
    const origin = first?.departure?.iataCode;
    const destination = last?.arrival?.iataCode;
    const date = first?.departure?.at?.slice(0, 10);
    if (!origin || !destination || !date) return null;
    originDestinations.push({
      id: String(i + 1),
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDateTimeRange: { date },
    });
  }
  const travelers = (offer.travelerPricings ?? []).map((tp, i) => ({
    id: String(i + 1),
    travelerType: tp.travelerType || "ADULT",
  }));
  if (!carrier || originDestinations.length === 0 || travelers.length === 0) return null;
  return {
    currencyCode: offer.price?.currency || "USD",
    originDestinations,
    travelers,
    sources: ["GDS"],
    searchCriteria: {
      maxFlightOffers: 250,
      flightFilters: { carrierRestrictions: { includedCarrierCodes: [carrier] } },
      pricingOptions: { includedCheckedBagsOnly: true },
    },
  };
};

/**
 * Among the bag-included search results, the cheapest offer on the SAME
 * flights as the LITE one, with what it costs more per traveler (never below
 * 0). null when no result is those flights, priced in the same currency, with
 * a bag on every segment.
 */
export const pickClassicOffer = <T extends OfferLike>(
  lite: OfferLike,
  candidates: T[],
): { offer: T; deltaPerPaxUsd: number } | null => {
  const liteTotal = parseFloat(lite.price?.grandTotal ?? "");
  const pax = lite.travelerPricings?.length ?? 0;
  if (!Number.isFinite(liteTotal) || pax === 0) return null;
  const currency = lite.price?.currency || "USD";

  let best: { offer: T; total: number } | null = null;
  for (const offer of candidates) {
    if ((offer.price?.currency || "USD") !== currency) continue;
    if (!offerIncludesCheckedBag(offer) || !sameFlights(lite, offer)) continue;
    const total = parseFloat(offer.price?.grandTotal ?? "");
    if (!Number.isFinite(total)) continue;
    if (!best || total < best.total) best = { offer, total };
  }
  if (!best) return null;
  return { offer: best.offer, deltaPerPaxUsd: Math.max(0, (best.total - liteTotal) / pax) };
};
