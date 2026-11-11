// The sandbox ticket step's rules (lib/tixstock-booking/sandbox-ticket.ts): which cards the step may show, and the
// ticket the order carries for the card the customer picked. Test events only - a real event never reaches them.
import { describe, expect, it } from "vitest";
import type { EventTicket } from "@/lib/app.types";
import type { SandboxCard } from "@/lib/tixstock-booking/sandbox-cards";
import { cardToKeep, deliveryDay, sandboxOrderTicket, shownSandboxCards } from "@/lib/tixstock-booking/sandbox-ticket";

const card = (over: Partial<SandboxCard> = {}): SandboxCard => ({
  category: "Curva Sud",
  listingId: "L1",
  pricePerTicketUsd: 121,
  listingAmountUsd: 120.4,
  ticketType: "eTicket",
  splitType: "No Preferences",
  singleSeats: false,
  restrictions: [],
  deliveryDate: null,
  instantDownload: false,
  available: 4,
  ...over,
});

const row = (over: Partial<EventTicket> = {}): EventTicket => ({
  id: "row-curva",
  category: "Curva Sud",
  price: 121,
  description: "",
  colorOnTheMap: "",
  eid: "TX-EVENT",
  supplier: "tixstock",
  available: true,
  ...over,
});

describe("the cards the sandbox ticket step shows", () => {
  it("pairs a card with the event's ticket row of its category", () => {
    const { shown, orphans } = shownSandboxCards([card()], [row()]);
    expect(shown).toHaveLength(1);
    expect(shown[0].row.id).toBe("row-curva");
    expect(shown[0].card.listingId).toBe("L1");
    expect(orphans).toEqual([]);
  });

  it("does not show a card whose category has no row on the event, and names it", () => {
    const { shown, orphans } = shownSandboxCards([card(), card({ category: "Tribuna Est", listingId: "L2" })], [row()]);
    expect(shown.map((s) => s.card.listingId)).toEqual(["L1"]);
    expect(orphans).toEqual(["Tribuna Est"]);
  });

  it("matches the category the way the site matches TixStock names (accents, codes in brackets, case)", () => {
    const { shown } = shownSandboxCards(
      [card({ category: "Categoría 2 Fondo" })],
      [row({ id: "row-cat2", category: "CATEGORÍA 2 (CAT2) - FONDO" })],
    );
    expect(shown.map((s) => s.row.id)).toEqual(["row-cat2"]);
  });

  it("never pairs a card with a row that is off sale", () => {
    const { shown, orphans } = shownSandboxCards([card()], [row({ available: false })]);
    expect(shown).toEqual([]);
    expect(orphans).toEqual(["Curva Sud"]);
  });

  it("pairs only with a TixStock row: another supplier's row of the same category is not this card's", () => {
    const { shown } = shownSandboxCards(
      [card()],
      [row({ id: "row-live", supplier: "livetickets" }), row({ id: "row-tx" })],
    );
    expect(shown.map((s) => s.row.id)).toEqual(["row-tx"]);
  });

  it("keeps the cards in the order they came in (cheapest first)", () => {
    const { shown } = shownSandboxCards(
      [card({ category: "B", listingId: "LB", pricePerTicketUsd: 80 }), card({ category: "A", listingId: "LA", pricePerTicketUsd: 95 })],
      [row({ id: "ra", category: "A" }), row({ id: "rb", category: "B" })],
    );
    expect(shown.map((s) => s.row.id)).toEqual(["rb", "ra"]);
  });
});

describe("the ticket the order carries for a sandbox card", () => {
  const picked = shownSandboxCards([card({ singleSeats: true, splitType: "Single Seats" })], [row({ zoneLabel: "יציע דרומי", description: "מאחורי השער" })]).shown[0];

  it("carries the event row's id, the listing's id and the card's price", () => {
    const ticket = sandboxOrderTicket(picked, { quantity: 3, tixEventId: "TX-EVENT", venueCountryCode: "GB" });
    expect(ticket).toMatchObject({
      id: "row-curva",
      supplier: "tixstock",
      eid: "TX-EVENT",
      category: "Curva Sud",
      supplierCategory: "Curva Sud",
      price: 121,
      quantity: 3,
      zoneLabel: "יציע דרומי",
      description: "מאחורי השער",
      tixstock: { listingId: "L1", italian: false, singleSeats: true },
    });
  });

  it("asks for the Italian details only when the TixStock event's venue is in Italy", () => {
    const at = (code: string | null) =>
      sandboxOrderTicket(picked, { quantity: 2, tixEventId: "TX-EVENT", venueCountryCode: code }).tixstock?.italian;
    expect(at("IT")).toBe(true);
    expect(at("it")).toBe(true);
    expect(at("GB")).toBe(false);
    expect(at(null)).toBe(false);
  });

  it("is a ticket the order form accepts: its id is on the event and it is on sale", () => {
    const ticket = sandboxOrderTicket(picked, { quantity: 2, tixEventId: "TX-EVENT", venueCountryCode: null });
    expect(ticket.id).not.toBe("");
    expect([row()].some((t) => t.id === ticket.id && t.available !== false)).toBe(true);
  });
});

describe("which card stays selected when the cards are read again", () => {
  const shown = shownSandboxCards(
    [card({ category: "B", listingId: "LB", pricePerTicketUsd: 80 }), card({ category: "A", listingId: "LA", pricePerTicketUsd: 95 })],
    [row({ id: "ra", category: "A" }), row({ id: "rb", category: "B" })],
  ).shown;

  it("keeps the category the customer had, whichever listing prices it now", () => {
    expect(cardToKeep(shown, "ra")?.card.listingId).toBe("LA");
  });

  it("opens on the cheapest when the customer had nothing, or their category is gone", () => {
    expect(cardToKeep(shown, undefined)?.card.listingId).toBe("LB");
    expect(cardToKeep(shown, "row-gone")?.card.listingId).toBe("LB");
  });

  it("selects nothing when there is no card", () => {
    expect(cardToKeep([], "ra")).toBeNull();
  });
});

describe("the delivery date as the customer reads it", () => {
  it("prints the feed's date as day/month/year", () => {
    expect(deliveryDay("2026-05-20")).toBe("20/05/2026");
    expect(deliveryDay("2026-05-20T18:00:00+0000")).toBe("20/05/2026");
  });

  it("prints a value it cannot read as it came, and nothing for no date", () => {
    expect(deliveryDay("on the day")).toBe("on the day");
    expect(deliveryDay("  ")).toBeNull();
    expect(deliveryDay(null)).toBeNull();
  });
});
