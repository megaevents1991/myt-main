"use client";

import { useContext, useEffect } from "react";
import { OrderContext } from "../app.context";
import { TX_FALLBACK_MULTIPLIER, toOrderTicket } from "../order/TicketSelection";
import type { Event, EventTicket } from "@/lib/app.types";
import { neighbourPax } from "@/lib/events/readyPackage";
import type { LiveTicketsOffer } from "@/lib/livetickets";
import { hasOwnStock } from "@/lib/own-stock";
import { priceTicketsForQuantity, type SupplierLiveData } from "@/lib/supplier-offers";
import { supplierEventId, ticketSupplier } from "@/lib/suppliers";
import type { TixStockListing } from "@/lib/tixstock-map";
import { getAvailableTickets } from "@/lib/utils";
import { useReadyPackagePax } from "./useHandlePreparedPackage";

/** Same patience as the ticket step: past this a supplier reads "down" and sells on the buffered price. */
const SUPPLIER_TIMEOUT_MS = 20_000;
const supplierTimeout = () =>
  typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(SUPPLIER_TIMEOUT_MS)
    : undefined;

const NOTHING_LIVE: SupplierLiveData = {
  tixstock: { status: "none", listings: [] },
  livetickets: { status: "none", offers: [] },
  ownStock: null,
};

/**
 * The live answer of the ONE supplier that sells this ticket, for this party -
 * the same three calls the ticket step makes (app/order/TicketSelection.tsx).
 * A call that fails reads as that supplier being down, exactly as there.
 */
async function loadLive(
  event: Event,
  ticket: EventTicket,
  onSale: EventTicket[],
  qty: number,
): Promise<SupplierLiveData> {
  const supplier = ticketSupplier(ticket, event.type);

  if (supplier === "tixstock") {
    const down: SupplierLiveData = { ...NOTHING_LIVE, tixstock: { status: "down", listings: [] } };
    const eid = supplierEventId(onSale, "tixstock", event.type);
    if (!eid) return down;
    try {
      const params = new URLSearchParams({
        event_id: eid,
        ticket_quantity: String(qty),
        db_event_id: String(event.id),
        _: String(Date.now()),
      });
      if (event.tx_excluded_sections?.length) {
        params.set("excluded_sections", event.tx_excluded_sections.join(","));
      }
      const res = await fetch(`/api/tixstock/tickets?${params.toString()}`, {
        cache: "no-store",
        signal: supplierTimeout(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const listings: TixStockListing[] = json?.data?.data ?? [];
      return { ...NOTHING_LIVE, tixstock: { status: listings.length > 0 ? "live" : "down", listings } };
    } catch (error) {
      console.error("[ReadyPackage] TixStock live check failed:", error);
      return down;
    }
  }

  if (supplier === "livetickets") {
    const down: SupplierLiveData = { ...NOTHING_LIVE, livetickets: { status: "down", offers: [] } };
    const eid = supplierEventId(onSale, "livetickets", event.type);
    if (!eid) return down;
    try {
      const res = await fetch(`/api/livetickets/tickets?eid=${encodeURIComponent(eid)}`, {
        cache: "no-store",
        signal: supplierTimeout(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { offers?: LiveTicketsOffer[] } = await res.json();
      return { ...NOTHING_LIVE, livetickets: { status: "live", offers: json.offers ?? [] } };
    } catch (error) {
      console.error("[ReadyPackage] LiveTickets live check failed:", error);
      return down;
    }
  }

  if (hasOwnStock(ticket)) {
    try {
      const res = await fetch(`/api/own-stock?event_id=${event.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { left?: Record<string, number> } = await res.json();
      return { ...NOTHING_LIVE, ownStock: json.left ?? null };
    } catch (error) {
      console.error("[ReadyPackage] Own-stock count failed:", error);
    }
  }
  return NOTHING_LIVE;
}

/**
 * A ready package ("חבילה מוכנה") lands the customer past the ticket step, so
 * nobody has run that step's rules on its ticket: the supplier's LIVE price for
 * this quantity, whether the supplier can sell this quantity at all (a listing
 * sold in pairs, a category's max per order, our own stock running out), and
 * who the ticket is bought from. This hook runs exactly those rules
 * (lib/supplier-offers.ts `priceTicketsForQuantity`) on the package's one
 * ticket, every time the package hands a fresh ticket to the order - on landing
 * and after each traveller change:
 *
 *  - sellable: the order's ticket becomes what the ticket step would have put
 *    there (`toOrderTicket`) - live price, supplier, seating;
 *  - not sellable at this size: the size leaves the picker for the visit and the
 *    package moves to the nearest size left, saying so;
 *  - not sellable at any size: the regular flow takes over, on the ticket step.
 *
 * It never touches a ticket the customer picked themselves (a swap goes through
 * the ticket step, which already did all of this).
 */
export const useReadyTicketLive = () => {
  const {
    event,
    eventTicket,
    setEventTicket,
    numberOfEventTickets,
    readyPackage,
    setReadyPackage,
    setPackageLocked,
    setStep,
  } = useContext(OrderContext);
  const { changePax } = useReadyPackagePax();

  const token = readyPackage?.token;
  const busy = readyPackage?.loading;
  // The package's ticket as the route hands it: a name, an id, a stored price -
  // and no supplier yet. Once checked (or picked in the ticket step) it has one.
  const unchecked =
    !!token && !busy && !!eventTicket?.id && eventTicket.supplier === undefined;
  const ticketId = eventTicket?.id;
  const ticketCategory = eventTicket?.category;

  useEffect(() => {
    if (!unchecked || !event) return;
    const onSale = getAvailableTickets(event);
    const ticket =
      onSale.find((t) => !!ticketId && t.id === ticketId) ??
      onSale.find((t) => t.category === ticketCategory);
    // Off sale: the route already refuses such a package on its next answer.
    if (!ticket) return;
    const qty = numberOfEventTickets;
    let cancelled = false;

    (async () => {
      const live = await loadLive(event, ticket, onSale, qty);
      if (cancelled) return;
      const offer = priceTicketsForQuantity(
        [ticket],
        event.type,
        qty,
        live,
        TX_FALLBACK_MULTIPLIER,
      )[0];
      if (offer) {
        setEventTicket(toOrderTicket(offer, event.type, qty));
        return;
      }

      // The supplier cannot sell this many of the package's ticket right now.
      const left = (readyPackage?.paxOptions ?? []).filter((n) => n !== qty);
      const next = neighbourPax(left, qty, -1) ?? neighbourPax(left, qty, 1);
      if (next == null) {
        // No size can be ticketed: hand over to the regular flow, which offers
        // every ticket the event has - fully editable, as any regular order is.
        setReadyPackage(null);
        setPackageLocked(false);
        setStep(1);
        return;
      }
      // Order matters: changePax clears the notice first, then ours is set.
      void changePax(next);
      setReadyPackage((prev) =>
        prev
          ? {
              ...prev,
              paxOptions: prev.paxOptions.filter((n) => n !== qty),
              blockedPax: prev.blockedPax.includes(qty)
                ? prev.blockedPax
                : [...prev.blockedPax, qty],
              notice: `אין כרגע ${qty} כרטיסים זמינים יחד בקטגוריה של החבילה - עברנו ל-${next} נוסעים. להרכב אחר דברו איתנו.`,
            }
          : prev,
      );
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per fresh package ticket (landing / a traveller change); the
    // event object and the setters do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unchecked, event?.id, ticketId, ticketCategory, numberOfEventTickets, token]);
};
