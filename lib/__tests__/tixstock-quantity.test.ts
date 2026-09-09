import assert from "node:assert/strict";
import { listingCanSatisfyQuantity } from "../tixstock-quantity";
import type { TixStockListing } from "../tixstock.types";

const mk = (available: number, split_type: string, split_quantity = 0) =>
  ({
    ticket: { split_type },
    number_of_tickets_for_sale: { quantity_available: available, split_quantity },
  }) as unknown as TixStockListing;

// Event 1095 real shapes: split_quantity 0 everywhere
assert.equal(listingCanSatisfyQuantity(mk(6, "No Preferences"), 1), true);
assert.equal(listingCanSatisfyQuantity(mk(2, "No Preferences"), 1), true);
assert.equal(listingCanSatisfyQuantity(mk(6, "Avoid Leaving One Ticket"), 1), true);
assert.equal(listingCanSatisfyQuantity(mk(2, "Avoid Leaving One Ticket"), 1), false);
assert.equal(listingCanSatisfyQuantity(mk(3, "Avoid Leaving One Ticket"), 2), false);
assert.equal(listingCanSatisfyQuantity(mk(4, "Avoid Leaving One Ticket"), 2), true);
// availability floor
assert.equal(listingCanSatisfyQuantity(mk(1, "No Preferences"), 2), false);
assert.equal(listingCanSatisfyQuantity(mk(0, "No Preferences"), 1), false);
// all-or-nothing
assert.equal(listingCanSatisfyQuantity(mk(4, "Sell Together"), 4), true);
assert.equal(listingCanSatisfyQuantity(mk(4, "Sell Together"), 2), false);
// multiples
assert.equal(listingCanSatisfyQuantity(mk(8, "Multiples", 2), 1), false);
assert.equal(listingCanSatisfyQuantity(mk(8, "Multiples", 2), 4), true);
// bad qty
assert.equal(listingCanSatisfyQuantity(mk(8, "No Preferences"), 0), false);
console.log("tixstock-quantity: all assertions passed");
