import { describe, expect, it } from "vitest";

import { orderDescription, orderTitle, type OrderMetaEvent } from "../seo/orderMeta";

const london = { name: "לונדון, בריטניה", latitude: 51.5072, longitude: -0.1276 };
const manchester = { name: "מנצ'סטר, בריטניה", latitude: 53.4808, longitude: -2.2426 };

const event = (over: Partial<OrderMetaEvent> = {}): OrderMetaEvent => ({
  name: "בריאן אדמס",
  date: "2027-07-20",
  location: london,
  ...over,
});

describe("orderTitle", () => {
  it("names the event, its city and its date in Hebrew", () => {
    expect(orderTitle(event())).toBe(
      "בריאן אדמס בלונדון · 20.7.2027 | כרטיס, טיסה ומלון - מגה איבנטס",
    );
  });

  it("uses the event city on a two-city event, not the flight city", () => {
    expect(orderTitle(event({ name: "אואזיס", event_location: manchester }))).toBe(
      "אואזיס במנצ'סטר · 20.7.2027 | כרטיס, טיסה ומלון - מגה איבנטס",
    );
  });

  it("does not repeat a city the name already carries", () => {
    expect(orderTitle(event({ name: "אואזיס - לונדון" }))).toBe(
      "אואזיס - לונדון · 20.7.2027 | כרטיס, טיסה ומלון - מגה איבנטס",
    );
  });

  it("tells two shows of the same artist apart by their date", () => {
    expect(orderTitle(event({ date: "2027-07-20" }))).not.toBe(
      orderTitle(event({ date: "2027-07-21" })),
    );
  });

  it("says tickets, not a package, for a ticket-only event", () => {
    expect(orderTitle(event({ package_mode: "ticket_only" }))).toBe(
      "בריאן אדמס בלונדון · 20.7.2027 | כרטיסים - מגה איבנטס",
    );
  });

  it("leaves the date out when it cannot be read", () => {
    expect(orderTitle(event({ date: null }))).toBe(
      "בריאן אדמס בלונדון | כרטיס, טיסה ומלון - מגה איבנטס",
    );
  });

  it("reads a date that carries a time", () => {
    expect(orderTitle(event({ date: "2027-07-05T19:30:00" }))).toContain("· 5.7.2027 |");
  });
});

describe("orderDescription", () => {
  it("states the package price the way the event cards do", () => {
    expect(orderDescription(event(), 1266)).toBe(
      "בריאן אדמס בלונדון, 20.7.2027: חבילה עם כרטיס, טיסה ומלון. מחיר ממוצע $1,266 לנוסע. מגה איבנטס מבית מגה תיירות.",
    );
  });

  it("drops the price sentence when there is no price", () => {
    const d = orderDescription(event(), null);
    expect(d).not.toContain("$");
    expect(d).toBe(
      "בריאן אדמס בלונדון, 20.7.2027: חבילה עם כרטיס, טיסה ומלון. מגה איבנטס מבית מגה תיירות.",
    );
  });

  it("prices a ticket-only event per ticket and promises no flight", () => {
    const d = orderDescription(event({ package_mode: "ticket_only" }), 340);
    expect(d).toContain("מחיר $340 לכרטיס");
    expect(d).not.toContain("טיסה");
  });
});
