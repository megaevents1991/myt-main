// The cards of the hidden sandbox checkout (lib/tixstock-booking/sandbox-cards.ts): one card per category, the
// cheapest listing that can sell the party, with that listing's own details. Real events never reach this code.
import { describe, expect, it } from "vitest";
import { sandboxCards } from "@/lib/tixstock-booking/sandbox-cards";
import type { TixStockListing } from "@/lib/tixstock.types";

type Over = {
  id?: string;
  category?: string;
  amount?: string;
  available?: number;
  display?: number;
  splitQty?: number;
  type?: string;
  split?: string;
  instant?: string;
  lead?: unknown;
  options?: unknown[];
  other?: unknown;
  delivery?: string;
  row?: string;
};

/** A listing as the sandbox feed sends it (10.11.2026): amounts and booleans are strings. */
const listing = (over: Over = {}): TixStockListing =>
  ({
    id: over.id ?? "L1",
    seller_id: 1,
    seller_name: "Seller",
    requires_lead_booker: over.lead ?? "false",
    ticket: {
      general_admission: "false",
      type: over.type ?? "eTicket",
      allow_last_minute_sales: "false",
      split_type: over.split ?? "No Preferences",
      etickets: [],
      upload_later: "true",
      instant_download: over.instant ?? "false",
    },
    number_of_tickets_for_sale: {
      quantity_available: over.available ?? 4,
      quantity_sold: 0,
      display_quantity: over.display ?? 0,
      split_quantity: over.splitQty ?? 0,
      quantity_on_hold: 0,
    },
    seat_details: { category: over.category ?? "Longside", section: "101", row: over.row ?? "5", first_seat: "1" },
    face_value: { currency: "USD", amount: "50.00" },
    proceed_price: { currency: "USD", amount: over.amount ?? "60.00" },
    restrictions_benefits: { options: over.options ?? [], other: over.other ?? "" },
    delivery: { type: "SHIPPING", hand_delivered: "false", shipped_date_or_date_in_hand: over.delivery ?? "2027-06-09", options: [] },
  }) as unknown as TixStockListing;

describe("sandboxCards", () => {
  it("cheapest per category", () => {
    const cards = sandboxCards([listing({ id: "dear", amount: "80.00" }), listing({ id: "cheap", amount: "60.00" })], 2);
    expect(cards).toHaveLength(1);
    expect(cards[0].listingId).toBe("cheap");
    expect(cards[0].pricePerTicketUsd).toBe(60);
    expect(cards[0].category).toBe("Longside");
  });

  it("one card per category whatever the spelling, cheapest category first", () => {
    const cards = sandboxCards(
      [
        listing({ id: "a", category: "Categoría 2 (CAT2) - Fondo", amount: "90" }),
        listing({ id: "b", category: "categoria 2 fondo", amount: "70" }),
        listing({ id: "c", category: "Shortside", amount: "20" }),
      ],
      2,
    );
    expect(cards.map((c) => c.listingId)).toEqual(["c", "b"]);
  });

  it("price rounds up", () => {
    const [card] = sandboxCards([listing({ amount: "59.20" })], 2);
    expect(card.pricePerTicketUsd).toBe(60); // what the customer sees
    expect(card.listingAmountUsd).toBe(59.2); // what TixStock is told
  });

  it("display quantity caps", () => {
    const capped = listing({ available: 10, display: 2 });
    expect(sandboxCards([capped], 3)).toEqual([]);
    expect(sandboxCards([capped], 2)[0].available).toBe(2);
  });

  it("zero display uses available", () => {
    expect(sandboxCards([listing({ available: 5, display: 0 })], 2)[0].available).toBe(5);
  });

  it("single seats flagged", () => {
    expect(sandboxCards([listing({ split: "Single Seats" })], 2)[0].singleSeats).toBe(true);
    expect(sandboxCards([listing({ split: "SINGLE seats" })], 2)[0].singleSeats).toBe(true);
    expect(sandboxCards([listing({ split: "No Preferences" })], 2)[0].singleSeats).toBe(false);
  });

  it("split rule applies", () => {
    // all-or-nothing, in both spellings: 4 seats are not sold to a party of 2
    expect(sandboxCards([listing({ split: "Sell Together", available: 4 })], 2)).toEqual([]);
    expect(sandboxCards([listing({ split: "All Together", available: 4 })], 2)).toEqual([]);
    expect(sandboxCards([listing({ split: "All Together", available: 2 })], 2)).toHaveLength(1);
    // never leave one seat behind, and multiples of two only
    expect(sandboxCards([listing({ split: "Avoid Leaving One Ticket", available: 4 })], 3)).toEqual([]);
    expect(sandboxCards([listing({ split: "Multiples", available: 6, splitQty: 2 })], 3)).toEqual([]);
    expect(sandboxCards([listing({ split: "Multiples", available: 6, splitQty: 2 })], 4)).toHaveLength(1);
  });

  it("the next listing of the category sells when the cheapest cannot", () => {
    const cards = sandboxCards([listing({ id: "block", amount: "10", split: "All Together", available: 4 }), listing({ id: "free", amount: "30" })], 2);
    expect(cards.map((c) => [c.listingId, c.pricePerTicketUsd])).toEqual([["free", 30]]);
  });

  it("lead booker listings are left out", () => {
    expect(sandboxCards([listing({ lead: true })], 2)).toEqual([]);
    expect(sandboxCards([listing({ lead: "true" })], 2)).toEqual([]);
    // the feed says "false" as a string - that is a listing anyone can buy
    expect(sandboxCards([listing({ lead: "false" })], 2)).toHaveLength(1);
    expect(sandboxCards([listing({ lead: undefined })], 2)).toHaveLength(1);
  });

  it("instant download", () => {
    const instant = (value: string) => sandboxCards([listing({ instant: value })], 2)[0].instantDownload;
    expect(instant("1")).toBe(true);
    expect(instant("true")).toBe(true);
    expect(instant("Yes")).toBe(true);
    expect(instant("0")).toBe(false);
    expect(instant("")).toBe(false);
    expect(instant("false")).toBe(false);
  });

  it("restrictions text", () => {
    const [card] = sandboxCards([listing({ options: ["Aisle", { name: "Age", value: "16+" }], other: "Bring ID" })], 2);
    expect(card.restrictions).toEqual(["Aisle", "Age: 16+", "Bring ID"]);
    // the sandbox sends `other` as an empty list
    expect(sandboxCards([listing({ options: [], other: [] })], 2)[0].restrictions).toEqual([]);
    expect(sandboxCards([listing({ options: [], other: ["Bring ID", ""] })], 2)[0].restrictions).toEqual(["Bring ID"]);
  });

  it("restricted view dropped", () => {
    expect(sandboxCards([listing({ options: ["Restricted View"] })], 2)).toEqual([]);
    expect(sandboxCards([listing({ other: "limited view of the pitch" })], 2)).toEqual([]);
  });

  it("the listing's own details", () => {
    const [card] = sandboxCards([listing({ id: "L7", type: "mobile", split: "No Preferences", delivery: "2027-06-09", instant: "true", amount: "6.73" })], 2);
    expect(card).toEqual({
      category: "Longside",
      listingId: "L7",
      pricePerTicketUsd: 7,
      listingAmountUsd: 6.73,
      ticketType: "mobile",
      splitType: "No Preferences",
      singleSeats: false,
      restrictions: [],
      deliveryDate: "2027-06-09",
      instantDownload: true,
      available: 4,
    });
    expect(sandboxCards([listing({ delivery: "" })], 2)[0].deliveryDate).toBeNull();
  });

  it("a listing with no usable price or a bad party size gives nothing", () => {
    expect(sandboxCards([listing({ amount: "" }), listing({ amount: "0.00" }), listing({ amount: "abc" })], 2)).toEqual([]);
    expect(sandboxCards([listing()], 0)).toEqual([]);
  });
});
