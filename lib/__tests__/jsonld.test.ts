import { describe, expect, it } from "vitest";

import {
  hubJsonLd,
  orderJsonLd,
  organizationJsonLd,
  websiteJsonLd,
  type OrderJsonLdEvent,
} from "../seo/jsonld";

const SITE = "https://www.mega-events.co.il";

const madrid = { name: "מדריד, ספרד", latitude: 40.4168, longitude: -3.7038, country_code: "ES" };
const event = (over: Partial<OrderJsonLdEvent> = {}): OrderJsonLdEvent => ({
  id: 660,
  name: "בריאן אדמס",
  date: "2026-11-10",
  location: madrid,
  card_image_url: "https://img.example/660.jpg",
  ...over,
});

type Node = Record<string, unknown>;
const graphOf = (ld: Node) => ld["@graph"] as Node[];
const byType = (ld: Node, type: string) => graphOf(ld).find((n) => n["@type"] === type);

describe("organizationJsonLd", () => {
  it("describes the agency with what the site itself shows", () => {
    const org = organizationJsonLd();
    expect(org["@type"]).toBe("TravelAgency");
    expect(org.telephone).toBe("+972-3-768-4800");
    expect(org.sameAs).toEqual([
      "https://www.facebook.com/megatravelil",
      "https://www.instagram.com/mega_events_il",
    ]);
    expect(org.logo).toBe(`${SITE}/apple-touch-icon.png`);
    expect(org.address).toMatchObject({ addressLocality: "תל אביב", addressCountry: "IL" });
    expect(JSON.stringify(org)).not.toContain("OfferCatalog");
  });
});

describe("websiteJsonLd", () => {
  it("names the site and carries no dead search action", () => {
    const site = websiteJsonLd();
    expect(site).toMatchObject({ "@type": "WebSite", url: SITE, inLanguage: "he-IL" });
    expect(site).not.toHaveProperty("potentialAction");
  });
});

describe("orderJsonLd", () => {
  it("marks up the event with a postal address and keeps the package price off it", () => {
    const ld = orderJsonLd(event(), { price: 1266, available: true });
    const ev = byType(ld, "Event");
    expect(ev).toMatchObject({
      name: "בריאן אדמס",
      startDate: "2026-11-10",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      url: `${SITE}/order/660`,
      image: ["https://img.example/660.jpg"],
      location: {
        "@type": "Place",
        name: "מדריד",
        address: { "@type": "PostalAddress", addressLocality: "מדריד", addressCountry: "ES" },
      },
    });
    expect(ev).not.toHaveProperty("offers");
  });

  it("sells the package as a trip at the card's price", () => {
    const trip = byType(orderJsonLd(event(), { price: 1266, available: true }), "TouristTrip");
    expect(trip?.offers).toEqual({
      "@type": "Offer",
      price: "1266",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE}/order/660`,
      seller: { "@id": `${SITE}/#organization` },
    });
  });

  it("puts a ticket-only price on the event itself and offers no trip", () => {
    const ld = orderJsonLd(event({ package_mode: "ticket_only" }), { price: 380, available: true });
    expect(byType(ld, "Event")?.offers).toMatchObject({ price: "380", priceCurrency: "USD" });
    expect(byType(ld, "TouristTrip")).toBeUndefined();
  });

  it("never publishes a price of 0 or a fake validFrom", () => {
    const ld = orderJsonLd(event(), { price: null, available: false });
    const json = JSON.stringify(ld);
    expect(byType(ld, "TouristTrip")).toBeUndefined();
    expect(json).not.toContain('"price"');
    expect(json).not.toContain("validFrom");
  });
});

describe("hubJsonLd", () => {
  const trail = [
    { name: "כדורגל", path: "football" },
    { name: "פרמייר ליג", path: "football/leagues/premier-league" },
  ];

  it("walks the breadcrumb from the homepage to the hub", () => {
    const crumbs = byType(hubJsonLd(trail, []), "BreadcrumbList")?.itemListElement as Node[];
    expect(crumbs.map((c) => [c.position, c.name, c.item])).toEqual([
      [1, "עמוד הבית", SITE],
      [2, "כדורגל", `${SITE}/c/football`],
      [3, "פרמייר ליג", `${SITE}/c/football/leagues/premier-league`],
    ]);
  });

  it("lists the hub's events by their order-page URL, at most 50", () => {
    const events = Array.from({ length: 60 }, (_, i) => ({ id: 1000 + i, name: `אירוע ${i}` }));
    const page = byType(hubJsonLd(trail, events), "CollectionPage");
    const items = (page?.mainEntity as Node).itemListElement as Node[];
    expect(items).toHaveLength(50);
    expect(items[0]).toEqual({ "@type": "ListItem", position: 1, url: `${SITE}/order/1000`, name: "אירוע 0" });
  });

  it("has no event list when the hub has no events", () => {
    expect(byType(hubJsonLd(trail, []), "CollectionPage")).toBeUndefined();
  });
});
