import { describe, expect, it } from "vitest";

import { hubDescription, hubTitle } from "../seo/hubMeta";

describe("hubTitle", () => {
  it("names the hub and the brand customers know", () => {
    expect(hubTitle("לונדון")).toBe("לונדון - כרטיסים, טיסה ומלון | מגה איבנטס");
  });
});

describe("hubDescription", () => {
  const london = { name: "לונדון", subtitle: null };
  const pkg = (date: string, price: number | null) => ({ date, price, ticketOnly: false });

  it("counts the events, spans their dates and gives the lowest package price", () => {
    expect(
      hubDescription(london, [pkg("2027-07-20", 1955), pkg("2027-03-05", 1224), pkg("2027-09-01", null)]),
    ).toBe(
      "לונדון: 3 אירועים בין 5.3.2027 ל-1.9.2027. חבילות עם כרטיס, טיסה ומלון, מחיר ממוצע לנוסע מ-$1,224. מגה איבנטס מבית מגה תיירות.",
    );
  });

  it("speaks of one event in the singular, with its date and price", () => {
    expect(hubDescription(london, [pkg("2027-07-20", 1955)])).toBe(
      "לונדון: אירוע אחד ב-20.7.2027. חבילה עם כרטיס, טיסה ומלון, מחיר ממוצע לנוסע $1,955. מגה איבנטס מבית מגה תיירות.",
    );
  });

  it("never prices a package with a ticket-only event", () => {
    const d = hubDescription({ name: "הופעות מוזיקה", subtitle: null }, [
      { date: "2026-12-01", price: 380, ticketOnly: true },
      pkg("2027-01-10", 1100),
    ]);
    expect(d).toContain("מחיר ממוצע לנוסע $1,100");
    expect(d).not.toContain("$380");
  });

  it("says tickets, priced per ticket, when every event is ticket-only", () => {
    expect(
      hubDescription({ name: "סומבר", subtitle: null }, [
        { date: "2026-12-01", price: 380, ticketOnly: true },
      ]),
    ).toBe("סומבר: אירוע אחד ב-1.12.2026. כרטיסים, מחיר $380 לכרטיס. מגה איבנטס מבית מגה תיירות.");
  });

  it("leaves the price out when no event has one", () => {
    expect(hubDescription(london, [pkg("2027-07-20", null)])).toBe(
      "לונדון: אירוע אחד ב-20.7.2027. חבילה עם כרטיס, טיסה ומלון. מגה איבנטס מבית מגה תיירות.",
    );
  });

  it("falls back to the staff subtitle when there are no events", () => {
    expect(hubDescription({ name: "קולדפליי", subtitle: "  הלהקה הבריטית  " }, [])).toBe(
      "הלהקה הבריטית",
    );
  });

  it("falls back to a sentence without numbers when there is nothing else", () => {
    expect(hubDescription({ name: "קולדפליי", subtitle: null }, [])).toBe(
      "קולדפליי: חבילות עם כרטיס, טיסה ומלון לאירועים בחו״ל. מגה איבנטס מבית מגה תיירות.",
    );
  });
});
