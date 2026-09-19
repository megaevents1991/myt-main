import assert from "node:assert/strict";
import {
  bestPriceTicketIds,
  cheapestSupplierPerZone,
  priceTicketsForQuantity,
  type SupplierLiveData,
} from "../supplier-offers";
import { ticketSupplier } from "../suppliers";
import {
  categoryCanSatisfyQuantity,
  liveTicketsPriceForQuantity,
  seatingForQuantity,
  seatingSplit,
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
      { id: "171442", title: "Category 2", priceUsd: 431, maxPerOrder: 6, seatingGroupMax: 4, tripleFeeUsd: 80 },
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

// a TixStock listing the seller splits promises pairs/triples; one sold whole
// ("All Together") seats the party together
assert.equal(priced[0].seating, "pairs");
const whole = {
  ...listing("CATEGORY 1", "402.2", 2),
  ticket: { split_type: "All Together" },
} as unknown as TixStockListing;
const soldWhole = live({ tixstock: { status: "live", listings: [whole] } });
assert.equal(priceTicketsForQuantity([tx], "tx_event", 2, soldWhole, 1.15)[0].seating, "together");
assert.equal(priceTicketsForQuantity([tx], "tx_event", 3, soldWhole, 1.15).length, 0);

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

// one supplier per zone: the same zone from two suppliers shows only the cheaper supplier
const sameZone = [ticket({ id: "a", zoneId: "z", price: 300 }), { ...lt, id: "b", zoneId: "z", price: 250 }];
assert.deepEqual(cheapestSupplierPerZone(sameZone, "tx_event").map((t) => t.id), ["b"]);
// ...and BOTH of the winning supplier's tickets there stay
assert.deepEqual(
  cheapestSupplierPerZone([...sameZone, { ...lt, id: "c", zoneId: "z", price: 400 }], "tx_event").map((t) => t.id),
  ["b", "c"],
);
// different zones, a zone one supplier sells, and tickets with no zone pass untouched
const apart = [ticket({ id: "a", zoneId: "z1", price: 300 }), { ...lt, id: "b", zoneId: "z2", price: 250 }, ticket({ id: "n", zoneId: undefined })];
assert.deepEqual(cheapestSupplierPerZone(apart, "tx_event").map((t) => t.id), ["a", "b", "n"]);
// a tie keeps the first in the list
assert.deepEqual(
  cheapestSupplierPerZone([ticket({ id: "a", zoneId: "z", price: 250 }), { ...lt, id: "b", zoneId: "z", price: 250 }], "tx_event").map((t) => t.id),
  ["a"],
);

// LiveTickets quantity rules
const rules = { maxPerOrder: 6, seatingGroupMax: 4 };
assert.equal(categoryCanSatisfyQuantity(rules, 6), true);
assert.equal(categoryCanSatisfyQuantity(rules, 7), false);
assert.equal(categoryCanSatisfyQuantity(rules, 0), false);
// the promise is pairs, plus ONE triple for an odd party - never "4 together", never a lone seat
assert.equal(seatingForQuantity(rules, 2), "together");
assert.equal(seatingForQuantity(rules, 3), "together");
assert.equal(seatingForQuantity(rules, 4), "groups");
assert.equal(seatingForQuantity(rules, 5), "groups");
assert.deepEqual(seatingSplit(rules, 2), [2]);
assert.deepEqual(seatingSplit(rules, 3), [3]);
assert.deepEqual(seatingSplit(rules, 4), [2, 2]);
assert.deepEqual(seatingSplit(rules, 5), [2, 3]);
assert.deepEqual(seatingSplit(rules, 6), [2, 2, 2]);
assert.equal(seatingSplit(rules, 1), null);
// a category that seats pairs only cannot promise a triple
assert.equal(seatingSplit({ maxPerOrder: 6, seatingGroupMax: 2 }, 3), null);
assert.deepEqual(seatingSplit({ maxPerOrder: 6, seatingGroupMax: 2 }, 4), [2, 2]);
assert.equal(seatingForQuantity({ maxPerOrder: 1, seatingGroupMax: null }, 1), "none");

// LiveTickets' group fee is folded into the price: only the triple pays it,
// spread over the whole party - pairs stay on the listed price
const feeOffer = { ...rules, priceUsd: 431, tripleFeeUsd: 80 };
assert.equal(liveTicketsPriceForQuantity(feeOffer, 2), 431);
assert.equal(liveTicketsPriceForQuantity(feeOffer, 3), 511); // 3 of 3 carry the fee
assert.equal(liveTicketsPriceForQuantity(feeOffer, 4), 431);
assert.equal(liveTicketsPriceForQuantity(feeOffer, 5), 479); // 3 of 5: 80 * 3 / 5 = 48
assert.equal(liveTicketsPriceForQuantity(feeOffer, 6), 431);
// no fee on the category, or no triple it can promise -> the listed price
assert.equal(liveTicketsPriceForQuantity({ ...feeOffer, tripleFeeUsd: 0 }, 3), 431);
assert.equal(liveTicketsPriceForQuantity({ ...feeOffer, seatingGroupMax: 2 }, 3), 431);
assert.equal(liveTicketsPriceForQuantity({ ...feeOffer, seatingGroupMax: null }, 5), 431);
// ...and the order page sells a party of three at that price
assert.equal(priceTicketsForQuantity([lt], "tx_event", 3, live(), 1.15)[0].price, 511);

console.log("supplier-offers: all assertions passed");
