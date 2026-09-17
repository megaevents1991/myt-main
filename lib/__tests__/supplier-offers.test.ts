import assert from "node:assert/strict";
import {
  bestPriceTicketIds,
  priceTicketsForQuantity,
  type SupplierLiveData,
} from "../supplier-offers";
import { ticketSupplier } from "../suppliers";
import {
  categoryCanSatisfyQuantity,
  seatingForQuantity,
} from "../livetickets-quantity";
import type { EventTicket } from "../app.types";
import type { TixStockListing } from "../tixstock.types";

const ticket = (over: Partial<EventTicket>): EventTicket => ({
  id: "t",
  category: "Category 1",
  price: 100,
  description: "",
  colorOnTheMap: "",
  ...over,
});

const listing = (category: string, amount: string, available = 4) =>
  ({
    seat_details: { category },
    proceed_price: { amount, currency: "USD" },
    ticket: { split_type: "No Preferences" },
    number_of_tickets_for_sale: { quantity_available: available, split_quantity: 0 },
  }) as unknown as TixStockListing;

// Both suppliers call a category "Category 1" - the classic cross-pricing trap.
const tx = ticket({ id: "tx1", zoneId: "long-3", price: 400 });
const lt = ticket({
  id: "171442",
  supplier: "livetickets",
  eid: "2326006",
  zoneId: "long-3",
  price: 450,
});
const tickets = [tx, lt];

const live = (over: Partial<SupplierLiveData> = {}): SupplierLiveData => ({
  tixstock: { status: "live", listings: [listing("CATEGORY 1", "402.2")] },
  livetickets: {
    status: "live",
    offers: [
      { id: "171442", title: "Category 2", priceUsd: 431, maxPerOrder: 6, seatingGroupMax: 4 },
    ],
  },
  ...over,
});

// supplier inference: explicit wins, tx_event implies tixstock, the rest static
assert.equal(ticketSupplier(tx, "tx_event"), "tixstock");
assert.equal(ticketSupplier(lt, "tx_event"), "livetickets");
assert.equal(ticketSupplier(tx, "sports_live_event_dynamic"), "static");
assert.equal(ticketSupplier(ticket({ supplier: "bogus" }), "tx_event"), "tixstock");

// each supplier prices only its own ticket, even with an identical category name
let priced = priceTicketsForQuantity(tickets, "tx_event", 2, live(), 1.15);
assert.deepEqual(
  priced.map((t) => [t.id, t.price]),
  [["tx1", 403], ["171442", 431]],
);

// TixStock can't seat 6 together here, LiveTickets can (in groups of 4)
priced = priceTicketsForQuantity(tickets, "tx_event", 6, live(), 1.15);
assert.deepEqual(priced.map((t) => t.id), ["171442"]);
assert.equal(priced[0].seating, "groups");
assert.equal(priced[0].seatingGroupMax, 4);

// over LiveTickets' max per order → nothing left
assert.equal(priceTicketsForQuantity(tickets, "tx_event", 7, live(), 1.15).length, 0);

// one supplier down: ITS tickets fall back to the buffered DB price, the other stays live
priced = priceTicketsForQuantity(
  tickets,
  "tx_event",
  2,
  live({ livetickets: { status: "down", offers: [] } }),
  1.15,
);
assert.deepEqual(
  priced.map((t) => [t.id, t.price]),
  [["tx1", 403], ["171442", 518]],
);
priced = priceTicketsForQuantity(
  tickets,
  "tx_event",
  2,
  live({ tixstock: { status: "down", listings: [] } }),
  1.15,
);
assert.deepEqual(
  priced.map((t) => [t.id, t.price]),
  [["tx1", 460], ["171442", 431]],
);

// still loading → that supplier's tickets are held back, never shown unbuffered
priced = priceTicketsForQuantity(
  tickets,
  "tx_event",
  2,
  live({ livetickets: { status: "loading", offers: [] } }),
  1.15,
);
assert.deepEqual(priced.map((t) => t.id), ["tx1"]);

// category gone from the live answer (sold out / not instant any more) → hidden
priced = priceTicketsForQuantity(
  tickets,
  "tx_event",
  2,
  live({ livetickets: { status: "live", offers: [] } }),
  1.15,
);
assert.deepEqual(priced.map((t) => t.id), ["tx1"]);

// best price: only in a zone two suppliers share, cheapest wins
const pricedBoth = priceTicketsForQuantity(tickets, "tx_event", 2, live(), 1.15);
assert.deepEqual([...bestPriceTicketIds(pricedBoth, "tx_event")], ["tx1"]);
assert.equal(bestPriceTicketIds([tx, ticket({ id: "tx2", zoneId: "long-3" })], "tx_event").size, 0);
assert.equal(bestPriceTicketIds([tx, { ...lt, zoneId: "short-1" }], "tx_event").size, 0);
assert.equal(bestPriceTicketIds([{ ...tx, zoneId: undefined }, lt], "tx_event").size, 0);

// LiveTickets quantity rules
const rules = { maxPerOrder: 6, seatingGroupMax: 4 };
assert.equal(categoryCanSatisfyQuantity(rules, 6), true);
assert.equal(categoryCanSatisfyQuantity(rules, 7), false);
assert.equal(categoryCanSatisfyQuantity(rules, 0), false);
assert.equal(seatingForQuantity(rules, 4), "together");
assert.equal(seatingForQuantity(rules, 5), "groups");
assert.equal(seatingForQuantity({ maxPerOrder: 1, seatingGroupMax: null }, 1), "none");

console.log("supplier-offers: all assertions passed");
