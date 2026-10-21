/**
 * "Build Your Euro Trip" - the price floor of a trip's hold (spec §6.4). Pure: no I/O.
 *
 * The live `validatePurchasePriceFloor` (app/api/confirm-order/utils.ts) guards ONE order: the
 * charge must not fall grossly below the trusted cheapest ticket + the smallest legit markup.
 * It is not reused: its slack assumes one row carrying a flight and a hotel, and its markup is
 * the single order's. A trip checks each of its rows instead - the trusted cheapest ticket of the
 * row's event (the same read as utils.ts:214-219, on the event the server re-read) plus that
 * event's TIERED markup (`tierMarkups`), × the party, with the same 40% slack. A row also carries
 * the flight (seq 1) or its stay's hotel; like the live floor, those are not in the floor.
 */
import type { Event } from "@/lib/app.types";
import { tierMarkups } from "./price";
import type { ItinerarySettings } from "./settings";

/** The live floor's slack: legitimate totals are always well above 60% of the floor. */
export const FLOOR_SLACK = 0.6;

/**
 * The cheapest AVAILABLE ticket on the event's own row - `validatePurchasePriceFloor`'s trusted
 * minimum (utils.ts:214-219, repeated: that file loads the database client). 0 for an event whose
 * tickets live at a supplier only (the markup alone still anchors the floor).
 */
export function trustedMinTicket(e: Event): number {
  const available = (e.tickets_and_rates || []).filter((t) => t?.available !== false);
  return available.length ? Math.min(...available.map((t) => t.price)) : 0;
}

/**
 * A reason to refuse, or null. `sharesIls[i]` is the ILS share of `route[i]`'s row (date order,
 * `buildGroupRows`). Fails OPEN without a usable rate, like the live floor.
 */
export function validateItineraryPriceFloor(
  route: Event[],
  sharesIls: number[],
  pax: number,
  s: ItinerarySettings,
  rateIls: number,
): string | null {
  if (!Number.isFinite(rateIls) || rateIls <= 0) return null;
  if (sharesIls.length !== route.length) return `${sharesIls.length} shares for ${route.length} events`;
  const tiers = tierMarkups(route, s);
  for (const [i, e] of route.entries()) {
    const charged = sharesIls[i];
    if (!Number.isFinite(charged) || charged <= 0) return `Event ${e.id}: non-positive share ${charged} ILS`;
    const floorUsd = (trustedMinTicket(e) + (tiers.get(e.id) ?? 0)) * pax;
    if (!(floorUsd > 0)) continue;
    const minIls = Math.floor(floorUsd * rateIls * FLOOR_SLACK);
    if (charged < minIls) return `Event ${e.id}: share ${charged} ILS below the trusted floor ${minIls} ILS`;
  }
  return null;
}
