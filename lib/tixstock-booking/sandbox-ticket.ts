// The rules of the hidden SANDBOX ticket step (app/order/sandbox/SandboxTicketStep.tsx - TixStock's health check,
// an `is_test` event with `tixstock_booking` set). Pure, and safe for a client component: it imports the card's
// TYPE only - `sandbox-cards.ts` itself loads the feed helpers and the exchange-rate service, which stay on the
// server. A real event's ticket step never comes here.
// Test: lib/__tests__/tixstockSandboxTicket.test.ts.
import type { EventTicket, OrderTicket } from "@/lib/app.types";
import { ticketSupplier } from "@/lib/suppliers";
import { normalizeTxCategory } from "@/lib/tixstock-category";
import type { SandboxCard } from "./sandbox-cards";

/** A card the step shows: the listing's card and the event's own ticket row of that category. */
export type ShownSandboxCard = { card: SandboxCard; row: EventTicket };

/**
 * The cards the step may show, in the order they came in (cheapest first). A card needs the event's ticket row of
 * its category: the order form, the continue bar and the order draft all know a ticket by that row's id, so a card
 * without one could be picked and never paid for. Such a card is left out and named in `orphans` (the step logs it).
 * A row that is off sale, or another supplier's, is nobody's row.
 */
export function shownSandboxCards(
  cards: SandboxCard[],
  rows: EventTicket[],
): { shown: ShownSandboxCard[]; orphans: string[] } {
  const byCategory = new Map<string, EventTicket>();
  for (const row of rows) {
    if (row.available === false || !row.id) continue;
    // The test events are `tx_event`: a row that names no supplier is TixStock's, exactly as on a real one.
    if (ticketSupplier(row, "tx_event") !== "tixstock") continue;
    const key = normalizeTxCategory(row.category);
    if (key && !byCategory.has(key)) byCategory.set(key, row);
  }

  const shown: ShownSandboxCard[] = [];
  const orphans: string[] = [];
  for (const card of cards) {
    const row = byCategory.get(normalizeTxCategory(card.category));
    if (row) shown.push({ card, row });
    else orphans.push(card.category);
  }
  return { shown, orphans };
}

/**
 * The card that stays selected when the cards are read again (a new quantity, a return from the summary): the
 * category the customer had - whichever listing prices it now - else the cheapest. Null when there is no card.
 */
export function cardToKeep(shown: ShownSandboxCard[], heldRowId: string | undefined): ShownSandboxCard | null {
  return shown.find((s) => s.row.id === heldRowId) ?? shown[0] ?? null;
}

/**
 * The ticket as the order carries it for the card the customer picked. Besides what every order ticket has, it
 * keeps `tixstock`: the exact listing the card showed (held at the pay click), whether the TixStock event's venue
 * is in Italy (the summary then asks for the attendees' identity details) and whether the seller sells single seats.
 */
export function sandboxOrderTicket(
  picked: ShownSandboxCard,
  o: { quantity: number; tixEventId: string; venueCountryCode: string | null },
): OrderTicket {
  const { card, row } = picked;
  return {
    id: row.id,
    vendor: row.vendor || "",
    category: card.category,
    price: card.pricePerTicketUsd,
    description: row.description || "",
    quantity: o.quantity,
    eid: o.tixEventId,
    supplier: "tixstock",
    supplierCategory: card.category,
    zoneLabel: row.zoneLabel,
    tixstock: {
      listingId: card.listingId,
      italian: (o.venueCountryCode ?? "").trim().toUpperCase() === "IT",
      singleSeats: card.singleSeats,
    },
  };
}

/**
 * The listing's delivery date as the customer reads it: day/month/year. The feed sends `2026-05-20`, sometimes
 * with a time; a value in another shape is printed as it came, and no date is null.
 */
export function deliveryDay(date: string | null | undefined): string | null {
  const text = (date ?? "").trim();
  if (text === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : text;
}
