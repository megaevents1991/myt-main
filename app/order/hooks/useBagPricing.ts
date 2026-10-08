"use client";

import { useEffect, useRef, useState } from "react";
import type { Flight } from "@/lib/app.types";

// Structurally mirrors the (intentionally unexported - see route.ts) response
// shape of POST /api/flights/bag-pricing. Kept local rather than imported: a
// route.ts file may only export the recognized route-handler symbols.
export type BagPricingOption = {
  unitPriceUsd: number;
  totalUsd: number;
  /** Per-pax price for TWO checked bags (carrier-filed qty-2 ancillary);
   *  absent → two bags charge 2 × unitPriceUsd. */
  twoBagsTotalPerPaxUsd?: number;
};
export type BagPricingOptions = {
  checked?: BagPricingOption;
  cabin?: BagPricingOption;
} | null;

/** Fare upgrade offered instead of an ancillary bag (El Al → "שדרוג
 *  לקלאסיק": Amadeus' CLASSIC fare when it costs more than the $120 floor,
 *  else the floor). Mirrors the route's FareUpgradeOffer. */
export type FareUpgradeOption = {
  brand: string;
  deltaTotalUsd: number;
  deltaPerPaxUsd: number;
  /** The CLASSIC offer to swap onto the flight; absent = floor price on the
   *  searched offer. */
  offer?: FlightOffer;
  quotedPerPaxUsd?: number;
} | null;

/**
 * Chargeable baggage ancillary pricing for the selected flight (Amadeus
 * Flight Offers Pricing, include=bags - app/api/flights/bag-pricing), used
 * to render the "הוסף מזוודה" / "הוסף טרולי" upsells in the order summary.
 *
 * One call per selected flight - its id and the party it carries (guarded by
 * fetchedForRef, survives StrictMode's double-invoke): a fresh flight pick
 * resets it, toggling the add-on itself does not (added_bags rides on the
 * SAME flight, so it never re-triggers this fetch).
 *
 * `enabled` gates the whole thing off - the hold-recovery/pay-link page
 * (?orderId=) shows included-info only, never a NEW upsell, so it has no
 * reason to spend an Amadeus call here at all.
 */
export function useBagPricing(
  flight: Flight | undefined,
  enabled: boolean,
): {
  bagOptions: BagPricingOptions;
  fareUpgrade: FareUpgradeOption;
  loading: boolean;
} {
  // The answer, with the flight it is about. Handed out only for THAT flight,
  // so a summary that stays open while its flight is replaced never shows -
  // or charges - the previous flight's bag price for a render.
  const [priced, setPriced] = useState<{
    key: string;
    bagOptions: BagPricingOptions;
    fareUpgrade: FareUpgradeOption;
  } | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  // The offer's id AND the party it carries: a ready package keeps the id
  // ("1") when its traveller picker swaps the flight for another party's, and
  // the summary stays mounted through it - the id alone kept the old answer.
  const key = flight?.id ? `${flight.id}:${flight.numOfTravelers ?? ""}` : null;
  // No real Amadeus offer to price (offline inventory has none; a
  // virtual/manually-modeled offer has nothing Amadeus can re-price).
  const priceable =
    enabled &&
    !!key &&
    !flight?.isOffline &&
    !!flight?.offer &&
    Object.keys(flight.offer).length > 0;

  useEffect(() => {
    if (!priceable || !key || !flight) return;
    if (fetchedForRef.current === key) return;
    const flightId = key;
    fetchedForRef.current = flightId;
    const settle = (bagOptions: BagPricingOptions, fareUpgrade: FareUpgradeOption) => {
      if (fetchedForRef.current === flightId) {
        setPriced({ key: flightId, bagOptions, fareUpgrade });
      }
    };

    // Staleness is judged against the REF's current value (not a
    // closure-captured cancelled flag): React 19 StrictMode's dev-only
    // mount -> cleanup -> remount would otherwise suppress the one real
    // response this ref guard deliberately leaves in flight (the remount's
    // own effect pass sees fetchedForRef already set and skips re-fetching,
    // so THIS response is the only one coming). A genuinely stale response -
    // the customer picked a different flight before this one resolved - is
    // still correctly dropped, because the ref has since moved to that
    // flight's id.
    fetch("/api/flights/bag-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flightOffer: flight.offer,
        virtual: flight.virtualOfferType || false,
      }),
    })
      .then((res) => (res.ok ? res.json() : { bagOptions: null, fareUpgrade: null }))
      .then((data: { bagOptions: BagPricingOptions; fareUpgrade?: FareUpgradeOption }) => {
        settle(data?.bagOptions ?? null, data?.fareUpgrade ?? null);
      })
      .catch((error) => {
        console.error("useBagPricing: fetch failed:", error);
        // Settled with nothing: "no price for this flight" is an answer too.
        settle(null, null);
      });
    // Depends on the flight's identity, not the object reference - toggling
    // added_bags later replaces `flight` with a new object (same id, same
    // party) and must NOT re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceable, key]);

  const mine = priced && priced.key === key ? priced : null;
  return {
    bagOptions: mine?.bagOptions ?? null,
    fareUpgrade: mine?.fareUpgrade ?? null,
    // Derived, so it is already true on the render in which the flight changed.
    loading: priceable && !mine,
  };
}
