/**
 * Round-trip price of ONE checked bag on an Amadeus offer.
 *
 * Two readings, in this order:
 *
 * 1. What Amadeus itself charges. `withCheckedBag` adds one chargeable bag per
 *    traveler on every segment that has none, the offer is re-priced, and
 *    `chargedCheckedBagsAmount` reads the charge off the answer
 *    (`price.additionalServices`, type CHECKED_BAGS - all travelers, whole
 *    trip). No guessing what a line covers.
 *
 * 2. The ancillary lines of `included.bags` (?include=bags), summed by
 *    `roundTripBagUsd` - the fallback when the re-price carries no charge.
 *
 * What a line's price covers (checked against reading 1 on six carriers,
 * 30.09): a line marked `bookableByItinerary` is priced PER ITINERARY it
 * touches. El Al, LOT, Air France / KLM, Aegean and Air Europa file ONE line
 * listing the segments of both directions - $75 there is $75 a direction,
 * $150 for the trip; British Airways files one line per direction ($140 +
 * $125.90). Until 30.09 a both-directions line was read as the whole trip and
 * every such carrier sold the round-trip bag at the price of one direction.
 *
 * The rule: group lines by the exact set of segments they cover (a line with no
 * segmentIds covers the whole offer), keep the cheapest line per group, and
 * pick the cheapest combination of groups that covers EVERY segment of the
 * offer exactly once. No such combination -> null: never sell a one-way bag.
 */

export type BagLine = {
  quantity: number;
  name: string;
  price?: { amount?: string; currencyCode?: string };
  /** true = the price is for ONE itinerary (direction), and is owed again for
   *  every itinerary the line's segments touch. */
  bookableByItinerary?: boolean;
  segmentIds?: string[];
};

/** Keep brute force bounded - an offer has a handful of groups at most. */
const MAX_GROUPS = 12;

type OfferItineraries = {
  itineraries?: Array<{ segments?: Array<{ id?: string }> }>;
};

/** The segment ids of each itinerary of an Amadeus offer, in order. */
export const offerItineraries = (offer: OfferItineraries): string[][] =>
  (offer.itineraries ?? []).map((it) =>
    (it.segments ?? [])
      .map((s) => (s.id == null ? "" : String(s.id)))
      .filter((id) => id !== ""),
  );

/** Every segment id of an Amadeus offer, in itinerary order. */
export const offerSegmentIds = (offer: OfferItineraries): string[] =>
  offerItineraries(offer).flat();

/**
 * USD price of one bag (quantity `quantity`) for the WHOLE offer, or null.
 * `itineraries` = the offer's segment ids per itinerary (`offerItineraries`).
 * `toUsd` converts a line's own price (null = unusable line, skipped).
 * Not rounded - callers round the sum once.
 */
export const roundTripBagUsd = (
  lines: BagLine[],
  itineraries: string[][],
  quantity: number,
  matchesName: (name: string) => boolean,
  toUsd: (amount: string, currencyCode: string) => number | null,
): number | null => {
  const allSegs = new Set(itineraries.flat());

  // Cheapest line per exact segment set. "*" = the whole offer (no segmentIds).
  const cheapest = new Map<string, { segs: string[]; usd: number }>();
  for (const line of lines) {
    if (line.quantity !== quantity || !matchesName(line.name || "")) continue;
    const price = toUsd(line.price?.amount ?? "", line.price?.currencyCode ?? "");
    if (price == null || !Number.isFinite(price) || price <= 0) continue;

    const ids = (line.segmentIds ?? []).map(String);
    let segs: string[];
    if (ids.length === 0) {
      segs = [...allSegs];
    } else {
      // A line naming a segment this offer does not have is not about this
      // offer - never guess what it covers.
      if (ids.some((id) => !allSegs.has(id))) continue;
      segs = [...new Set(ids)].sort();
    }
    if (segs.length === 0) continue;

    // Priced per itinerary: owed once for each direction the line reaches.
    const touched = line.bookableByItinerary
      ? itineraries.filter((it) => it.some((id) => segs.includes(id))).length
      : 1;
    const usd = price * Math.max(1, touched);

    const key = segs.join("|");
    const prev = cheapest.get(key);
    if (!prev || usd < prev.usd) cheapest.set(key, { segs, usd });
  }

  if (allSegs.size === 0) {
    // No segment ids on the offer: only a line that says nothing about
    // segments can be read as covering the whole trip.
    return null;
  }

  const groups = [...cheapest.values()].slice(0, MAX_GROUPS);
  let best: number | null = null;
  const total = 1 << groups.length;
  for (let mask = 1; mask < total; mask++) {
    const covered = new Set<string>();
    let sum = 0;
    let ok = true;
    for (let i = 0; i < groups.length && ok; i++) {
      if (!(mask & (1 << i))) continue;
      for (const s of groups[i].segs) {
        if (covered.has(s)) {
          ok = false; // overlapping groups would charge a segment twice
          break;
        }
        covered.add(s);
      }
      sum += groups[i].usd;
    }
    if (!ok || covered.size !== allSegs.size) continue;
    if (best == null || sum < best) best = sum;
  }
  return best;
};

type FareSegment = {
  includedCheckedBags?: { quantity?: number; weight?: number };
};
type PricedOffer = {
  travelerPricings?: Array<{ fareDetailsBySegment?: FareSegment[] }>;
};

const includesCheckedBag = (fare: FareSegment): boolean =>
  (fare.includedCheckedBags?.quantity ?? 0) > 0 ||
  (fare.includedCheckedBags?.weight ?? 0) > 0;

/**
 * The offer with ONE chargeable checked bag per traveler on every segment whose
 * fare includes none - the body to re-price so Amadeus states the charge. null
 * when no segment lacks a bag (nothing to sell).
 */
export const withCheckedBag = <T extends PricedOffer>(offer: T): T | null => {
  let added = false;
  const travelerPricings = (offer.travelerPricings ?? []).map((tp) => ({
    ...tp,
    fareDetailsBySegment: (tp.fareDetailsBySegment ?? []).map((fare) => {
      if (includesCheckedBag(fare)) return fare;
      added = true;
      return {
        ...fare,
        additionalServices: { chargeableCheckedBags: { quantity: 1 } },
      };
    }),
  }));
  return added ? { ...offer, travelerPricings } : null;
};

/**
 * What Amadeus charged for the bags on a re-priced offer: the CHECKED_BAGS
 * entry of `price.additionalServices` - every traveler, the whole trip, in
 * the offer's own currency. null when the answer carries no such charge (the
 * carrier sells no bag this way: "AdditionalServicesUnpriceableWarning").
 */
export const chargedCheckedBagsAmount = (
  pricedOffer:
    | {
        price?: {
          currency?: string;
          additionalServices?: Array<{ amount?: string; type?: string }>;
        };
      }
    | null
    | undefined,
): { amount: string; currencyCode: string } | null => {
  const service = (pricedOffer?.price?.additionalServices ?? []).find(
    (s) => s.type === "CHECKED_BAGS",
  );
  const value = parseFloat(service?.amount ?? "");
  if (!service?.amount || !Number.isFinite(value) || value <= 0) return null;
  return {
    amount: service.amount,
    currencyCode: pricedOffer?.price?.currency ?? "",
  };
};
