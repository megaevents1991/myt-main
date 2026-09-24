/**
 * Round-trip price of ONE bag from Amadeus's `included.bags` dictionary
 * (Flight Offers Pricing, ?include=bags).
 *
 * Amadeus does not return "a bag for the trip": it returns one ancillary line
 * per group of segments (usually one per itinerary - outbound, inbound), each
 * priced per traveller for THOSE segments only (`segmentIds`). Taking the single
 * cheapest line sold a bag for one direction at the price of one direction
 * (prod 24.09: El Al, $75 a direction, the customer saw $75 instead of $150).
 *
 * The rule here: group lines by the exact set of segments they cover (a line
 * with no segmentIds covers the whole offer), keep the cheapest line per group,
 * and pick the cheapest combination of groups that covers EVERY segment of the
 * offer exactly once. No such combination -> null: never sell a one-way bag.
 */

export type BagLine = {
  quantity: number;
  name: string;
  price?: { amount?: string; currencyCode?: string };
  segmentIds?: string[];
};

/** Keep brute force bounded - an offer has a handful of groups at most. */
const MAX_GROUPS = 12;

/** Every segment id of an Amadeus offer, in itinerary order. */
export const offerSegmentIds = (offer: {
  itineraries?: Array<{ segments?: Array<{ id?: string }> }>;
}): string[] =>
  (offer.itineraries ?? [])
    .flatMap((it) => it.segments ?? [])
    .map((s) => (s.id == null ? "" : String(s.id)))
    .filter((id) => id !== "");

/**
 * USD price of one bag (quantity `quantity`) for the WHOLE offer, or null.
 * `toUsd` converts a line's own price (null = unusable line, skipped).
 * Not rounded - callers round the sum once.
 */
export const roundTripBagUsd = (
  lines: BagLine[],
  segmentIds: string[],
  quantity: number,
  matchesName: (name: string) => boolean,
  toUsd: (amount: string, currencyCode: string) => number | null,
): number | null => {
  const allSegs = new Set(segmentIds);

  // Cheapest line per exact segment set. "*" = the whole offer (no segmentIds).
  const cheapest = new Map<string, { segs: string[]; usd: number }>();
  for (const line of lines) {
    if (line.quantity !== quantity || !matchesName(line.name || "")) continue;
    const usd = toUsd(line.price?.amount ?? "", line.price?.currencyCode ?? "");
    if (usd == null || !Number.isFinite(usd) || usd <= 0) continue;

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
