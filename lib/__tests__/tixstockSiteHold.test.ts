// The pay click of a TixStock SANDBOX test event (lib/tixstock-booking/site-booking.ts, hold half): hold exactly
// the listing the customer's card showed, and keep the booking row. A real order never gets past the first `if`.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TixstockCall } from "@/lib/tixstock-booking/client";
import {
  buyerFromOrder,
  prepareSiteHold,
  recordSiteHold,
  releaseHeld,
  type HeldListing,
  type SiteHoldDeps,
} from "@/lib/tixstock-booking/site-booking";
import type { TixStockListing } from "@/lib/tixstock.types";

type Over = { id?: string; amount?: string; available?: number; split?: string; ga?: string; options?: unknown[] };

/** A listing as the sandbox feed sends it: amounts and booleans are strings. */
const listing = (over: Over = {}): TixStockListing =>
  ({
    id: over.id ?? "L1",
    seller_id: 1,
    seller_name: "Seller",
    requires_lead_booker: "false",
    ticket: {
      general_admission: over.ga ?? "false",
      type: "eTicket",
      allow_last_minute_sales: "false",
      split_type: over.split ?? "No Preferences",
      etickets: [],
      upload_later: "true",
      instant_download: "true",
    },
    number_of_tickets_for_sale: {
      quantity_available: over.available ?? 4,
      quantity_sold: 0,
      display_quantity: 0,
      split_quantity: 0,
      quantity_on_hold: 0,
    },
    seat_details: { category: "Curva Sud", section: "101", row: "5", first_seat: "1" },
    face_value: { currency: "USD", amount: "50.00" },
    proceed_price: { currency: "USD", amount: over.amount ?? "59.20" },
    restrictions_benefits: { options: over.options ?? ["Away fans section"], other: "" },
    delivery: { type: "EMAIL", hand_delivered: "false", shipped_date_or_date_in_hand: "2027-06-09", options: [] },
  }) as unknown as TixStockListing;

const ok = <T>(data: T): TixstockCall<T> => ({ ok: true, data });
const SANDBOX_SITE = { is_test: true, tixstock_booking: "sandbox_site", tixEventId: "TX1", excludedSections: [] };

type World = {
  event: Awaited<ReturnType<SiteHoldDeps["loadEventFlags"]>>;
  listings: TixStockListing[] | null;
  country: string | null;
  holdAnswer: TixstockCall<{ holdId: string }>;
  insertError: string | null;
};

const world = (over: Partial<World> = {}) => {
  const w: World = { event: SANDBOX_SITE, listings: [listing()], country: "GB", holdAnswer: ok({ holdId: "H1" }), insertError: null, ...over };
  const calls: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const deps: SiteHoldDeps = {
    loadEventFlags: async (id) => {
      calls.push(`flags:${id}`);
      return w.event;
    },
    listings: async (tx) => {
      calls.push(`listings:${tx}`);
      return w.listings;
    },
    venueCountry: async (tx) => {
      calls.push(`country:${tx}`);
      return ok(w.country);
    },
    hold: async (id, qty) => {
      calls.push(`hold:${id}:${qty}`);
      return w.holdAnswer;
    },
    release: async (holdId, qty) => {
      calls.push(`release:${holdId}:${qty}`);
      return ok(true as const);
    },
    insertBooking: async (row) => {
      calls.push("insert");
      rows.push(row);
      return { error: w.insertError };
    },
    newToken: () => "t".repeat(43),
  };
  return { deps, calls, rows };
};

const two = [
  { first_name: "Dana", last_name: "Levi" },
  { first_name: "Omer", last_name: "Levi" },
];
const req = (over: Partial<Parameters<typeof prepareSiteHold>[0]> = {}) => ({
  listingId: "L1" as unknown,
  attendees: two as unknown,
  eventId: 9001,
  quantity: 2,
  payNow: true,
  chargedPerTicketUsd: 60,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("the hold at the pay click", () => {
  it("none without listing id: a real order never reads an event for this", async () => {
    const { deps, calls } = world();
    expect(await prepareSiteHold(req({ listingId: undefined }), deps)).toEqual({ kind: "none" });
    expect(await prepareSiteHold(req({ listingId: "  " }), deps)).toEqual({ kind: "none" });
    expect(await prepareSiteHold(req({ listingId: 17 }), deps)).toEqual({ kind: "none" });
    expect(calls).toEqual([]);
  });

  it("none when not paying now", async () => {
    const { deps, calls } = world();
    expect(await prepareSiteHold(req({ payNow: false }), deps)).toEqual({ kind: "none" });
    expect(calls).toEqual([]);
  });

  it("ignores a listing id on a real event", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps, calls } = world({ event: { is_test: false, tixstock_booking: null, tixEventId: "TX1", excludedSections: [] } });
    expect(await prepareSiteHold(req(), deps)).toEqual({ kind: "none" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["flags:9001"]);
  });

  it("holds nothing on a test event the office books (sandbox_office), and says nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps, calls } = world({ event: { ...SANDBOX_SITE, tixstock_booking: "sandbox_office" } });
    expect(await prepareSiteHold(req(), deps)).toEqual({ kind: "none" });
    expect(warn).not.toHaveBeenCalled();
    expect(calls).toEqual(["flags:9001"]);
  });

  it("unavailable when gone", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const gone = world({ listings: [listing({ id: "other" })] });
    expect(await prepareSiteHold(req(), gone.deps)).toEqual({ kind: "unavailable" });
    expect(gone.calls.some((c) => c.startsWith("hold"))).toBe(false);

    const noFeed = world({ listings: null });
    expect(await prepareSiteHold(req(), noFeed.deps)).toEqual({ kind: "unavailable" });
    expect(noFeed.calls.some((c) => c.startsWith("hold"))).toBe(false);
  });

  it("unavailable when dearer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps, calls } = world({ listings: [listing({ amount: "61.00" })] });
    expect(await prepareSiteHold(req({ chargedPerTicketUsd: 60 }), deps)).toEqual({ kind: "unavailable" });
    expect(calls.some((c) => c.startsWith("hold"))).toBe(false);
  });

  it("unavailable when quantity no longer fits", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps, calls } = world({ listings: [listing({ available: 1 })] });
    expect(await prepareSiteHold(req(), deps)).toEqual({ kind: "unavailable" });
    expect(calls.some((c) => c.startsWith("hold"))).toBe(false);
  });

  it("unavailable when the hold itself is refused", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps } = world({ holdAnswer: { ok: false, kind: "refused", status: 422, message: "not enough tickets" } });
    expect(await prepareSiteHold(req(), deps)).toEqual({ kind: "unavailable" });
  });

  it("bad attendees: a count mismatch, a missing name, or a missing Italian detail - and nothing is held", async () => {
    const count = world();
    expect(await prepareSiteHold(req({ attendees: [two[0]] }), count.deps)).toEqual({ kind: "bad_attendees" });
    expect(await prepareSiteHold(req({ attendees: "x" }), count.deps)).toEqual({ kind: "bad_attendees" });
    expect(await prepareSiteHold(req({ attendees: [two[0], { first_name: " ", last_name: "Levi" }] }), count.deps)).toEqual({ kind: "bad_attendees" });
    expect(count.calls.some((c) => c.startsWith("hold"))).toBe(false);

    const full = { passport: "12345678", nationality: "IL", dob: "1990-04-02", gender: "F", birth_place: "Haifa" };
    const italy = world({ country: "IT" });
    for (const missing of ["passport", "gender", "birth_place"] as const) {
      const partial: Record<string, string> = { ...two[1], ...full };
      delete partial[missing];
      expect(await prepareSiteHold(req({ attendees: [{ ...two[0], ...full }, partial] }), italy.deps)).toEqual({ kind: "bad_attendees" });
    }
    expect(italy.calls.some((c) => c.startsWith("hold"))).toBe(false);
  });

  it("held: the exact listing and quantity, with what the booking row needs", async () => {
    const { deps, calls } = world({ country: "IT" });
    const full = { passport: " 12345678 ", nationality: "il", dob: "1990-04-02", gender: "F", birth_place: "Haifa" };
    const result = await prepareSiteHold(req({ attendees: [{ ...two[0], ...full }, { ...two[1], ...full, gender: "M" }] }), deps);
    expect(calls).toContain("hold:L1:2");
    expect(result.kind).toBe("held");
    if (result.kind !== "held") return;
    expect(result.held).toMatchObject({
      holdId: "H1",
      tixEventId: "TX1",
      listingId: "L1",
      quantity: 2,
      pricePerTicketUsd: 60,
      listingAmountUsd: 59.2,
      italian: true,
    });
    expect(result.held.attendees[0]).toEqual({ first_name: "Dana", last_name: "Levi", passport: "12345678", nationality: "IL", dob: "1990-04-02", gender: "F", birth_place: "Haifa" });
    expect(result.held.snapshot).toMatchObject({ category: "Curva Sud", section: "101", row: "5", generalAdmission: false, ticketType: "eTicket", restrictions: ["Away fans section"], deliveryDate: "2027-06-09", deliveryType: "EMAIL", instantDownload: true, italian: true });
  });

  it("held outside Italy keeps names only, whatever else the request carried", async () => {
    const { deps } = world({ country: "GB" });
    const result = await prepareSiteHold(req({ attendees: [{ ...two[0], passport: "12345678" }, two[1]] }), deps);
    expect(result.kind).toBe("held");
    if (result.kind !== "held") return;
    expect(result.held.italian).toBe(false);
    expect(result.held.attendees).toEqual(two);
  });
});

describe("the booking row of a held listing", () => {
  const held: HeldListing = {
    holdId: "H1",
    tixEventId: "TX1",
    listingId: "L1",
    quantity: 2,
    pricePerTicketUsd: 60,
    listingAmountUsd: 59.2,
    snapshot: { category: "Curva Sud", section: "101", row: "5", generalAdmission: false, ticketType: "eTicket", splitType: "No Preferences", restrictions: [], deliveryDate: null, deliveryType: null, instantDownload: false, italian: false },
    attendees: two,
    italian: false,
  };
  const buyer = buyerFromOrder({ main_contact_first_name: " Dana ", main_contact_last_name: "Levi", main_contact_email: " dana@example.com ", main_contact_phone_number: "0501234567" });

  it("the buyer is the order's main contact", () => {
    expect(buyer).toEqual({ first_name: "Dana", last_name: "Levi", email: "dana@example.com", phone: "0501234567" });
  });

  it("record writes token", async () => {
    const { deps, rows } = world();
    await recordSiteHold(2233, held, buyer, deps);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reservation_id: 2233,
      env: "sandbox",
      source: "site",
      status: "on_hold",
      tixstock_event_id: "TX1",
      listing_id: "L1",
      hold_id: "H1",
      quantity: 2,
      currency: "USD",
      buyer,
      attendees: two,
    });
    expect(String(rows[0].customer_token)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rows[0].listing).toEqual(held.snapshot);
  });

  it("record keeps the feed's amount", async () => {
    const { deps, rows } = world();
    await recordSiteHold(2233, held, buyer, deps);
    expect(rows[0].price_per_ticket).toBe(59.2);
    expect(rows[0].total).toBe(118.4);
  });

  it("record releases on insert failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps, calls } = world({ insertError: "duplicate key" });
    await recordSiteHold(2233, held, buyer, deps);
    expect(calls.filter((c) => c.startsWith("release"))).toEqual(["release:H1:2"]);
  });

  it("releaseHeld gives the tickets back and never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps, calls } = world();
    await releaseHeld(held, deps);
    expect(calls).toEqual(["release:H1:2"]);
    const broken: SiteHoldDeps = { ...deps, release: async () => { throw new Error("network"); } };
    await expect(releaseHeld(held, broken)).resolves.toBeUndefined();
  });
});
