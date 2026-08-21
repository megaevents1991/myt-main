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

/**
 * Chargeable baggage ancillary pricing for the selected flight (Amadeus
 * Flight Offers Pricing, include=bags - app/api/flights/bag-pricing), used
 * to render the "הוסף מזוודה" / "הוסף טרולי" upsells in the order summary.
 *
 * One call per selected flight id (guarded by fetchedForRef, survives
 * StrictMode's double-invoke): a fresh flight pick resets it, toggling the
 * add-on itself does not (added_bags rides on the SAME flight.id, so it
 * never re-triggers this fetch).
 *
 * `enabled` gates the whole thing off - the hold-recovery/pay-link page
 * (?orderId=) shows included-info only, never a NEW upsell, so it has no
 * reason to spend an Amadeus call here at all.
 */
export function useBagPricing(
  flight: Flight | undefined,
  enabled: boolean,
): { bagOptions: BagPricingOptions; loading: boolean } {
  const [bagOptions, setBagOptions] = useState<BagPricingOptions>(null);
  const [loading, setLoading] = useState(false);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !flight?.id || flight.isOffline) return;
    // No real Amadeus offer to price (offline inventory has none; a
    // virtual/manually-modeled offer has nothing Amadeus can re-price).
    if (!flight.offer || Object.keys(flight.offer).length === 0) return;
    if (fetchedForRef.current === flight.id) return;
    const flightId = flight.id;
    fetchedForRef.current = flightId;

    setLoading(true);
    setBagOptions(null);

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
      .then((res) => (res.ok ? res.json() : { bagOptions: null }))
      .then((data: { bagOptions: BagPricingOptions }) => {
        if (fetchedForRef.current === flightId) setBagOptions(data?.bagOptions ?? null);
      })
      .catch((error) => {
        console.error("useBagPricing: fetch failed:", error);
        if (fetchedForRef.current === flightId) setBagOptions(null);
      })
      .finally(() => {
        if (fetchedForRef.current === flightId) setLoading(false);
      });
    // Depends on the flight's identity, not the object reference - toggling
    // added_bags later replaces `flight` with a new object (same id) and
    // must NOT re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, flight?.id]);

  return { bagOptions, loading };
}
