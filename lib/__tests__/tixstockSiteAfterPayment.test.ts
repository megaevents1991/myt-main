// After the payment of a TixStock SANDBOX test order (lib/tixstock-booking/site-booking.ts, payment half): order as
// Sale on Hold, approve, send the ticket-page link; release the hold when the payment failed. A real order has no
// `source = site` booking row and gets `none` after one lookup.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TixstockCall } from "@/lib/tixstock-booking/client";
import { ourOrderId, ticketPageUrl, type BookingStatus } from "@/lib/tixstock-booking/rules";
import {
  bookSiteOrderAfterPayment,
  releaseSiteHoldFor,
  type SiteBookingRow,
  type SitePaymentDeps,
} from "@/lib/tixstock-booking/site-booking";

const BOOKING = "9f3a1c2e-1111-4222-8333-444455556666";
const OUR = ourOrderId(2233, BOOKING);
const TOKEN = "t".repeat(43);
const ok = <T>(data: T): TixstockCall<T> => ({ ok: true, data });
const refused = (status: number, message: string): TixstockCall<never> => ({ ok: false, kind: "refused", status, message });
const noAnswer: TixstockCall<never> = { ok: false, kind: "no_answer", detail: "timeout" };
type AddAnswer = TixstockCall<{ orderId: string; status: string; currency: string | null; total: number | null }>;
const added = (over: Partial<{ currency: string | null; total: number | null }> = {}): AddAnswer =>
  ok({ orderId: "TX-ORDER-1", status: "Sale on Hold", currency: "USD", total: 118.4, ...over });

const row = (over: Partial<SiteBookingRow> = {}): SiteBookingRow => ({
  id: BOOKING,
  reservation_id: 2233,
  status: "on_hold",
  hold_id: "H1",
  listing_id: "L1",
  quantity: 2,
  listing: { category: "Curva Sud", section: "101", row: "5", generalAdmission: false, ticketType: "eTicket", splitType: "No Preferences", restrictions: [], deliveryDate: null, deliveryType: null, instantDownload: false, italian: false },
  price_per_ticket: 59.2,
  buyer: { first_name: "Dana", last_name: "Levi", email: "dana@example.com", phone: "0501234567" },
  attendees: [
    { first_name: "Dana", last_name: "Levi" },
    { first_name: "Omer", last_name: "Levi" },
  ],
  customer_token: TOKEN,
  link_email_sent_at: null,
  ...over,
});

type World = {
  row: SiteBookingRow | null;
  addAnswers: AddAnswer[];
  holdAnswers: Array<TixstockCall<{ holdId: string }>>;
  updateAnswer: TixstockCall<{ status: string }>;
  mailFails: boolean;
};

const world = (over: Partial<World> = {}) => {
  const w: World = { row: row(), addAnswers: [added()], holdAnswers: [ok({ holdId: "H2" })], updateAnswer: ok({ status: "Approved" }), mailFails: false, ...over };
  const calls: string[] = [];
  const bodies: Array<Record<string, unknown>> = [];
  const mails: Array<{ to: string; eventName: string; url: string }> = [];
  let clock = Date.parse("2026-11-11T10:00:00Z");
  const deps: SitePaymentDeps = {
    now: () => new Date(clock),
    loadSiteBooking: async (reservationId) => {
      calls.push(`load:${reservationId}`);
      return w.row ? { ...w.row } : null;
    },
    // The real one is a single UPDATE ... WHERE status = from: the check and the write are one step.
    moveStatus: async (id, from, to, atIso, patch) => {
      if (!w.row || w.row.id !== id || w.row.status !== from) return false;
      w.row = { ...w.row, ...(patch ?? {}), status: to } as SiteBookingRow;
      calls.push(`move:${from}>${to}`);
      void atIso;
      return true;
    },
    hold: async (listingId, qty) => {
      calls.push(`hold:${listingId}:${qty}`);
      return w.holdAnswers.shift() ?? refused(422, "no tickets");
    },
    release: async (holdId, qty) => {
      calls.push(`release:${holdId}:${qty}`);
      return ok(true as const);
    },
    addOrder: async (holdId, qty, body) => {
      calls.push(`addOrder:${holdId}:${qty}`);
      bodies.push(body);
      return w.addAnswers.shift() ?? noAnswer;
    },
    updateOrder: async (orderId, body) => {
      calls.push(`updateOrder:${orderId}:${String(body.order_status)}`);
      return w.updateAnswer;
    },
    loadEventName: async () => "Juventus - Como",
    claimLinkEmail: async (id) => {
      if (!w.row || w.row.id !== id || w.row.link_email_sent_at !== null) return false;
      w.row = { ...w.row, link_email_sent_at: "claimed" };
      calls.push("claimLink");
      return true;
    },
    unclaimLinkEmail: async () => {
      if (w.row) w.row = { ...w.row, link_email_sent_at: null };
      calls.push("unclaimLink");
    },
    sendTicketLinkEmail: async (to, eventName, url) => {
      if (w.mailFails) throw new Error("smtp down");
      mails.push({ to, eventName, url });
    },
  };
  return { deps, calls, bodies, mails, state: () => w.row, tick: (ms: number) => (clock += ms) };
};

const statusOf = (s: ReturnType<typeof world>): BookingStatus | undefined => s.state()?.status;

afterEach(() => vi.restoreAllMocks());

describe("after a payment that succeeded", () => {
  it("none for orders without a site booking", async () => {
    const s = world({ row: null });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("none");
    expect(s.calls).toEqual(["load:2233"]);
    expect(await bookSiteOrderAfterPayment("not-a-number", s.deps)).toBe("none");
    expect(s.calls).toEqual(["load:2233"]);
  });

  it("sale on hold then approved", async () => {
    const s = world();
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("approved");
    expect(s.calls).toEqual([
      "load:2233",
      "move:on_hold>ordering",
      "addOrder:H1:2",
      "move:ordering>sale_on_hold",
      `updateOrder:${OUR}:Approved`,
      "move:sale_on_hold>approved",
      "claimLink",
    ]);
    expect(s.bodies[0].order_status).toBe("Sale on Hold");
    expect(s.bodies[0].order_id).toBe(OUR);
    expect((s.bodies[0].items as Array<{ price: number }>).map((i) => i.price)).toEqual([59.2, 59.2]);
    expect(s.state()).toMatchObject({ status: "approved", tixstock_order_id: "TX-ORDER-1", order_currency: "USD", order_total: 118.4 });
    expect(s.mails).toEqual([{ to: "dana@example.com", eventName: "Juventus - Como", url: ticketPageUrl(TOKEN) }]);
    expect(s.state()?.link_email_sent_at).not.toBeNull();
  });

  it("warns when TixStock registered another total or currency, and still books", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const dearer = world({ addAnswers: [added({ total: 120 })] });
    expect(await bookSiteOrderAfterPayment("2233", dearer.deps)).toBe("approved");
    expect(warn.mock.calls.some((c) => String(c[0]).includes("tixstock_order_total_mismatch"))).toBe(true);

    warn.mockClear();
    const euros = world({ addAnswers: [added({ currency: "EUR" })] });
    expect(await bookSiteOrderAfterPayment("2233", euros.deps)).toBe("approved");
    expect(warn.mock.calls.some((c) => String(c[0]).includes("tixstock_order_total_mismatch"))).toBe(true);

    warn.mockClear();
    const exact = world();
    await bookSiteOrderAfterPayment("2233", exact.deps);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("tixstock_order_total_mismatch"))).toBe(false);
  });

  it("one orders/add when two callers race", async () => {
    const s = world();
    const [a, b] = await Promise.all([bookSiteOrderAfterPayment("2233", s.deps), bookSiteOrderAfterPayment("2233", s.deps)]);
    expect([a, b].sort()).toEqual(["approved", "busy"]);
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(1);
  });

  it("a row still `ordering` an hour later is busy too: the claim never expires here", async () => {
    const s = world({ row: row({ status: "ordering" }) });
    s.tick(60 * 60 * 1000);
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("busy");
    expect(s.calls).toEqual(["load:2233"]);
  });

  it("re-holds once after an expired hold", async () => {
    const s = world({ addAnswers: [refused(404, "Resource Not Found"), added()] });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("approved");
    expect(s.calls.filter((c) => c.startsWith("hold"))).toEqual(["hold:L1:2"]);
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toEqual(["addOrder:H1:2", "addOrder:H2:2"]);
    expect(s.state()?.hold_id).toBe("H2");
  });

  it("an expired hold whose second order is refused too: the new hold is released, failed, no third call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ addAnswers: [refused(404, "Resource Not Found"), refused(404, "Resource Not Found"), added()] });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("failed");
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(2);
    expect(s.calls.filter((c) => c.startsWith("hold"))).toHaveLength(1);
    expect(s.calls.filter((c) => c.startsWith("release"))).toEqual(["release:H2:2"]);
    expect(s.state()).toMatchObject({ status: "failed" });
    expect(String(s.state()?.last_error ?? "")).not.toBe("");
  });

  it("an expired hold and a listing that is gone: failed, nothing to release", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ addAnswers: [refused(404, "Resource Not Found")], holdAnswers: [refused(422, "not enough tickets")] });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("failed");
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(1);
    expect(s.calls.some((c) => c.startsWith("release"))).toBe(false);
    expect(statusOf(s)).toBe("failed");
  });

  it("any other refusal does not re-hold", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ addAnswers: [refused(400, "Validation failed")] });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("failed");
    expect(s.calls.filter((c) => c.startsWith("release"))).toEqual(["release:H1:2"]);
    expect(s.calls.some((c) => c.startsWith("hold"))).toBe(false);
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(1);
    expect(statusOf(s)).toBe("failed");
  });

  it("no answer is uncertain", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = world({ addAnswers: [noAnswer] });
    expect(await bookSiteOrderAfterPayment("2233", first.deps)).toBe("uncertain");
    expect(statusOf(first)).toBe("uncertain");
    expect(first.calls.some((c) => c.startsWith("updateOrder") || c.startsWith("release") || c.startsWith("hold"))).toBe(false);
    expect(first.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(1);

    const afterRehold = world({ addAnswers: [refused(404, "Resource Not Found"), noAnswer] });
    expect(await bookSiteOrderAfterPayment("2233", afterRehold.deps)).toBe("uncertain");
    expect(statusOf(afterRehold)).toBe("uncertain");
    expect(afterRehold.calls.some((c) => c.startsWith("updateOrder") || c.startsWith("release"))).toBe(false);
    expect(afterRehold.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(2);
  });

  it("paid after the hold was released", async () => {
    const s = world({ row: row({ status: "released" }) });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("approved");
    expect(s.calls.slice(0, 4)).toEqual(["load:2233", "move:released>ordering", "hold:L1:2", "addOrder:H2:2"]);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gone = world({ row: row({ status: "released" }), holdAnswers: [refused(422, "not enough tickets")] });
    expect(await bookSiteOrderAfterPayment("2233", gone.deps)).toBe("failed");
    expect(gone.calls.some((c) => c.startsWith("addOrder"))).toBe(false);
    expect(statusOf(gone)).toBe("failed");
  });

  it("a hold placed for a released row is never replaced again: its refusal ends the booking", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ row: row({ status: "released" }), addAnswers: [refused(404, "Resource Not Found"), added()], holdAnswers: [ok({ holdId: "H2" }), ok({ holdId: "H3" })] });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("failed");
    expect(s.calls.filter((c) => c.startsWith("hold"))).toHaveLength(1);
    expect(s.calls.filter((c) => c.startsWith("addOrder"))).toHaveLength(1);
    expect(s.calls.filter((c) => c.startsWith("release"))).toEqual(["release:H2:2"]);
  });

  it("approve failure leaves sale on hold", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = world({ updateAnswer: refused(500, "try later") });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("sale_on_hold");
    expect(statusOf(s)).toBe("sale_on_hold");
    expect(s.mails).toEqual([]);
  });

  it("a link e-mail that fails gives its claim back, and the order stays approved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ mailFails: true });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("approved");
    expect(s.calls).toContain("unclaimLink");
    expect(s.state()?.link_email_sent_at).toBeNull();
  });

  it("an order body that cannot be built orders nothing: the hold goes back and the row is failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = world({ row: row({ attendees: [{ first_name: "Dana", last_name: "Levi" }] }) });
    expect(await bookSiteOrderAfterPayment("2233", s.deps)).toBe("failed");
    expect(s.calls.some((c) => c.startsWith("addOrder"))).toBe(false);
    expect(s.calls.filter((c) => c.startsWith("release"))).toEqual(["release:H1:2"]);
    expect(statusOf(s)).toBe("failed");
  });
});

describe("after a payment that failed", () => {
  it("payment failed releases", async () => {
    const s = world();
    await releaseSiteHoldFor("2233", s.deps);
    expect(s.calls).toEqual(["load:2233", "move:on_hold>released", "release:H1:2"]);
    expect(statusOf(s)).toBe("released");
  });

  it("touches nothing that is not an open hold of the site", async () => {
    const none = world({ row: null });
    await releaseSiteHoldFor("2233", none.deps);
    expect(none.calls).toEqual(["load:2233"]);

    const approved = world({ row: row({ status: "approved" }) });
    await releaseSiteHoldFor("2233", approved.deps);
    expect(approved.calls).toEqual(["load:2233"]);
    expect(statusOf(approved)).toBe("approved");
  });
});
