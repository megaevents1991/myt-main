// The customer's ticket page (lib/tixstock-booking/ticket-page.ts): found by its token alone, and it lists a file
// only once the booking's tickets were released to the customer.
import { describe, expect, it } from "vitest";
import {
  fileNameFor,
  loadTicketPage,
  summaryState,
  type TicketPageDeps,
} from "@/lib/tixstock-booking/ticket-page";
import type { BookingStatus } from "@/lib/tixstock-booking/rules";

const TOKEN = "A".repeat(20) + "_-" + "b".repeat(21);

const world = (over: { booking?: Awaited<ReturnType<TicketPageDeps["loadBookingByToken"]>>; released?: boolean; status?: BookingStatus } = {}) => {
  const calls: string[] = [];
  const deps: TicketPageDeps = {
    loadBookingByToken: async (token) => {
      calls.push(`booking:${token}`);
      if (over.booking !== undefined) return over.booking;
      return {
        id: "b1",
        reservation_id: 2233,
        status: over.status ?? "approved",
        quantity: 2,
        listing: { category: "Curva Sud", section: "101", row: "5", generalAdmission: false, ticketType: "eTicket", splitType: "No Preferences", restrictions: ["Away fans section"], deliveryDate: "2027-06-09", deliveryType: "EMAIL", instantDownload: true, italian: false },
        released_to_customer_at: over.released ? "2026-11-11T10:00:00Z" : null,
      };
    },
    loadEvent: async (reservationId) => {
      calls.push(`event:${reservationId}`);
      return { name: "Juventus - Como", date: "2027-06-12T18:45:00.000Z" };
    },
    loadFiles: async (bookingId) => {
      calls.push(`files:${bookingId}`);
      return [
        { id: "f1", kind: "pdf", row: "5", seat: "12", url: null },
        { id: "f2", kind: "mobile_link", row: "5", seat: "13", url: "https://tickets.example/abc" },
        { id: "f3", kind: "additional", row: null, seat: null, url: null },
        { id: "f4", kind: "proof", row: null, seat: null, url: "https://proof.example/x" },
      ];
    },
  };
  return { deps, calls };
};

describe("the ticket page", () => {
  it("malformed token", async () => {
    const { deps, calls } = world();
    expect(await loadTicketPage("abc", deps)).toBeNull();
    expect(await loadTicketPage(`${TOKEN}x`, deps)).toBeNull();
    expect(await loadTicketPage(TOKEN.replace("_", "/"), deps)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("unknown token", async () => {
    const { deps, calls } = world({ booking: null });
    expect(await loadTicketPage(TOKEN, deps)).toBeNull();
    expect(calls).toEqual([`booking:${TOKEN}`]);
  });

  it("before release", async () => {
    const { deps, calls } = world({ released: false });
    const page = await loadTicketPage(TOKEN, deps);
    expect(page).toMatchObject({
      eventName: "Juventus - Como",
      eventDate: "2027-06-12T18:45:00.000Z",
      category: "Curva Sud",
      section: "101",
      row: "5",
      ticketType: "eTicket",
      quantity: 2,
      deliveryDate: "2027-06-09",
      restrictions: ["Away fans section"],
      released: false,
      externalTransfer: false,
      files: [],
    });
    // Nothing of an unreleased booking's files is even read.
    expect(calls.some((c) => c.startsWith("files"))).toBe(false);
  });

  it("after release", async () => {
    const { deps } = world({ released: true });
    const page = await loadTicketPage(TOKEN, deps);
    expect(page?.released).toBe(true);
    expect(page?.files).toEqual([
      { id: "f1", kind: "pdf", row: "5", seat: "12" },
      { id: "f2", kind: "mobile_link", row: "5", seat: "13", url: "https://tickets.example/abc" },
      { id: "f3", kind: "additional", row: null, seat: null },
    ]);
  });

  it("a mobile link is listed only when it is an http(s) link: a seller's text never becomes a script on our page", async () => {
    const { deps } = world({ released: true });
    const loadFiles: typeof deps.loadFiles = async () => [
      { id: "m1", kind: "mobile_link", row: "5", seat: "12", url: "javascript:alert(document.cookie)" },
      { id: "m2", kind: "mobile_link", row: "5", seat: "13", url: " JaVaScRiPt:alert(1)" },
      { id: "m3", kind: "mobile_link", row: "5", seat: "14", url: "data:text/html,<script>alert(1)</script>" },
      { id: "m4", kind: "mobile_link", row: "5", seat: "15", url: null },
      { id: "m5", kind: "mobile_link", row: "5", seat: "16", url: "https://tickets.example/ok" },
    ];
    const page = await loadTicketPage(TOKEN, { ...deps, loadFiles });
    expect(page?.files).toEqual([{ id: "m5", kind: "mobile_link", row: "5", seat: "16", url: "https://tickets.example/ok" }]);
  });

  it("a ticket the seller sent as a link (not as a file) opens at that link, never at our file route", async () => {
    // TixStock fills `file` with the PDF's bytes or with a URL. A URL has nothing stored behind our own route -
    // a link to it there is a 404 for the customer.
    const { deps } = world({ released: true });
    const loadFiles: typeof deps.loadFiles = async () => [
      { id: "p1", kind: "pdf", row: "5", seat: "12", url: "https://cdn.example/ticket-12.pdf" },
      { id: "p2", kind: "pdf", row: "5", seat: "13", url: null },
      { id: "p3", kind: "pdf", row: "5", seat: "14", url: "javascript:alert(1)" },
      { id: "a1", kind: "additional", row: null, seat: null, url: "https://cdn.example/letter.pdf" },
    ];
    const page = await loadTicketPage(TOKEN, { ...deps, loadFiles });
    expect(page?.files).toEqual([
      { id: "p1", kind: "pdf", row: "5", seat: "12", url: "https://cdn.example/ticket-12.pdf" },
      { id: "p2", kind: "pdf", row: "5", seat: "13" },
      { id: "a1", kind: "additional", row: null, seat: null, url: "https://cdn.example/letter.pdf" },
    ]);
  });

  it("an external transfer says so: the seller sends the tickets himself", async () => {
    const { deps } = world({
      released: true,
      booking: { id: "b1", reservation_id: 2233, status: "commissionable", quantity: 2, listing: { category: "Curva Sud", ticketType: "External Transfer" }, released_to_customer_at: "2026-11-11T10:00:00Z" },
    });
    expect((await loadTicketPage(TOKEN, deps))?.externalTransfer).toBe(true);
  });

  it("a cancelled booking has no ticket page", async () => {
    const { deps } = world({ released: true, status: "cancelled" });
    expect(await loadTicketPage(TOKEN, deps)).toBeNull();
  });
});

describe("what the confirmation page says about the tickets", () => {
  it("summary state", () => {
    expect(summaryState("approved", "2026-11-11T10:00:00Z")).toBe("ordered");
    expect(summaryState("commissionable", "2026-11-11T10:00:00Z")).toBe("ordered");
    for (const status of ["approved", "on_hold", "ordering", "sale_on_hold", "holding"] as const) {
      expect(summaryState(status, null)).toBe("pending");
    }
    expect(summaryState("sale_on_hold", "2026-11-11T10:00:00Z")).toBe("pending");
    for (const status of ["failed", "uncertain", "released", "cancelled"] as const) {
      expect(summaryState(status, null)).toBe("problem");
      expect(summaryState(status, "2026-11-11T10:00:00Z")).toBe("problem");
    }
  });
});

describe("the name a ticket file is served under", () => {
  it("keeps letters, digits, dash and underscore of the seller's free text, and nothing else", () => {
    expect(fileNameFor("pdf", "5", "12")).toBe("pdf-5-12.pdf");
    expect(fileNameFor("additional", null, null)).toBe("additional.pdf");
    // Each of `"; =\r\n./` becomes one dash: nothing of the seller's text can end or add a header.
    expect(fileNameFor("pdf", 'A"; x=1\r\n', "../12")).toBe("pdf-A---x-1------12.pdf");
    expect(/^[A-Za-z0-9_.-]+$/.test(fileNameFor("pdf", 'A"; x=1\r\n', "../12"))).toBe(true);
  });
});
