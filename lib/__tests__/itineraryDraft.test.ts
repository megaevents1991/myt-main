import { describe, expect, it } from "vitest";
import type { Event, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import { defaultTripDates, moves } from "../itinerary/dates";
import {
  ITINERARY_DRAFT_KEY,
  ITINERARY_DRAFT_TTL_MS,
  ITINERARY_DRAFT_VERSION,
  draftMayRestore,
  parseDraft,
  sameRouteIds,
  serializeDraft,
} from "../itinerary/draft";
import { INITIAL_ITINERARY_STATE, type ItineraryState } from "../itinerary/state";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };

const ev = (id: number, date: string, city: City) =>
  ({ id, name: `event ${id}`, date: `${date}T20:00:00`, type: "music_event", location: { ...city, country_code: "XX" } }) as unknown as Event;

const celine = ev(618, "2027-05-12", PARIS);
const chelsea = ev(702, "2027-05-15", LONDON);
const ajax = ev(810, "2027-05-18", AMSTERDAM);
const catalog = new Map([celine, chelsea, ajax].map((e) => [e.id, e]));

const route = [celine, chelsea];
const dates = { ...defaultTripDates(route), depart: "2027-05-10" };
const trainKey = moves(route)[0].key;

const NOW = Date.UTC(2027, 3, 1, 12, 0, 0);
const MIN = 60_000;

const ticket = (id: string, quantity = 2) =>
  ({ id, category: `cat ${id}`, zoneLabel: `zone ${id}`, price: 321, quantity, supplier: "tixstock" }) as unknown as OrderTicket;

const travellers = {
  contact: { firstName: "Dana", lastName: "Levi", phone: "050-123-4567", email: "dana@example.com" },
  others: [{ firstName: "Avi", lastName: "Cohen" }],
};

/** At the summary, with everything picked. */
const state: ItineraryState = {
  ...INITIAL_ITINERARY_STATE,
  step: "summary",
  mode: "route",
  route,
  dates,
  pax: 2,
  tickets: { 618: ticket("t618"), 702: ticket("t702") },
  train: [trainKey],
  flight: { id: "f1", price: 1300, outbound: { departureTime: "2027-05-10T05:40:00" } } as unknown as ItineraryFlight,
  hotels: { "618": { id: "h1", price: "900" } as unknown as OrderHotel },
  activeEvent: 1,
  activeStay: 1,
};

const saved = (over: Record<string, unknown> = {}, now = NOW) => {
  const raw = JSON.parse(serializeDraft(state, now, { form: { travellers, termsAccepted: true } }));
  return JSON.stringify({ ...raw, ...over });
};

describe("serializeDraft / parseDraft - a refresh keeps the trip", () => {
  it("the route, dates, party, train moves and the travellers' form come back", () => {
    const d = parseDraft(saved(), NOW + 5 * MIN, catalog);
    expect(d?.route.map((e) => e.id)).toEqual([618, 702]);
    expect(d?.route[0]).toBe(celine); // the catalog's own row
    expect(d?.mode).toBe("route");
    expect(d?.dates).toEqual(dates);
    expect(d?.pax).toBe(2);
    expect(d?.train).toEqual([trainKey]);
    expect(d?.form).toEqual({ travellers, termsAccepted: true });
  });

  it("the tickets come back as the category held - never a price - and the flow reopens on the tickets step", () => {
    const d = parseDraft(saved(), NOW, catalog);
    expect(d?.step).toBe("tickets");
    expect(d?.savedStep).toBe("summary");
    expect(d?.held).toEqual({
      618: { id: "t618", category: "cat t618", zoneLabel: "zone t618", quantity: 2 },
      702: { id: "t702", category: "cat t702", zoneLabel: "zone t702", quantity: 2 },
    });
  });

  it("never stores a price, a flight or a hotel", () => {
    const raw = JSON.parse(serializeDraft(state, NOW, { form: { travellers, termsAccepted: true } }));
    expect(Object.keys(raw).sort()).toEqual(
      ["dates", "form", "mode", "pax", "route", "savedAt", "step", "tickets", "train", "v"].sort(),
    );
    expect(raw.route).toEqual([618, 702]);
    expect(raw.tickets).toEqual({
      618: { id: "t618", category: "cat t618", zoneLabel: "zone t618", quantity: 2 },
      702: { id: "t702", category: "cat t702", zoneLabel: "zone t702", quantity: 2 },
    });
  });

  it("a held ticket not picked again yet is kept for the next refresh", () => {
    const held = { 702: { id: "t702", category: "cat t702", quantity: 2 } };
    const raw = JSON.parse(serializeDraft({ ...state, tickets: { 618: ticket("t618") } }, NOW, { held }));
    expect(raw.tickets[702]).toEqual({ id: "t702", category: "cat t702", quantity: 2 });
    // A pick made in the step wins over the held one.
    const picked = JSON.parse(serializeDraft(state, NOW, { held }));
    expect(picked.tickets[702].zoneLabel).toBe("zone t702");
  });

  it("a draft that carries a flight, hotels or prices anyway: none of them comes back", () => {
    const d = parseDraft(
      saved({
        flight: state.flight,
        hotels: state.hotels,
        tickets: { 618: { id: "t618", category: "a", price: 1, quantity: 2 } },
      }),
      NOW,
      catalog,
    );
    expect(d).not.toBeNull();
    expect(d).not.toHaveProperty("flight");
    expect(d).not.toHaveProperty("hotels");
    expect(d?.held[618]).toEqual({ id: "t618", category: "a", quantity: 2 });
    expect(d?.held[618]).not.toHaveProperty("price");
  });

  it("a held ticket for another party size is dropped (the tickets step picks again)", () => {
    const d = parseDraft(saved({ tickets: { 618: { id: "t618", category: "a", quantity: 3 } } }), NOW, catalog);
    expect(d?.held).toEqual({});
  });

  it("restored state is never an earlier route's: the held tickets of events outside it are dropped", () => {
    const d = parseDraft(saved({ tickets: { 810: { id: "t810", category: "a", quantity: 2 } } }), NOW, catalog);
    expect(d?.held).toEqual({});
  });

  it("before the tickets the flow reopens where it was (build)", () => {
    expect(parseDraft(saved({ step: "build" }), NOW, catalog)?.step).toBe("build");
    expect(parseDraft(saved({ step: "nowhere" }), NOW, catalog)?.step).toBe("build");
  });
});

describe("parseDraft - anything doubtful is dropped", () => {
  it("rejects another version (0 or a future one)", () => {
    expect(ITINERARY_DRAFT_VERSION).toBe(1);
    expect(parseDraft(saved({ v: 0 }), NOW, catalog)).toBeNull();
    expect(parseDraft(saved({ v: 2 }), NOW, catalog)).toBeNull();
  });

  it("rejects a draft older than 30 minutes, keeps one just under", () => {
    expect(ITINERARY_DRAFT_TTL_MS).toBe(30 * MIN);
    expect(parseDraft(saved(), NOW + 31 * MIN, catalog)).toBeNull();
    expect(parseDraft(saved(), NOW + 29 * MIN, catalog)).not.toBeNull();
    // Saved "in the future" by more than a minute: not ours to trust.
    expect(parseDraft(saved(), NOW - 2 * MIN, catalog)).toBeNull();
  });

  it("drops an event the catalog no longer holds - the rest of the trip comes back", () => {
    const d = parseDraft(saved({ route: [618, 702, 999] }), NOW, catalog);
    expect(d?.route.map((e) => e.id)).toEqual([618, 702]);
    const one = parseDraft(saved({ route: [618, 999] }), NOW, catalog);
    expect(one?.route.map((e) => e.id)).toEqual([618]);
    // One event is not a trip yet: back to the build step, the held tickets of the gone one dropped.
    expect(one?.step).toBe("build");
    expect(one?.held).toEqual({ 618: { id: "t618", category: "cat t618", zoneLabel: "zone t618", quantity: 2 } });
    expect(parseDraft(saved({ route: [999] }), NOW, catalog)).toBeNull();
  });

  it("a train move that no longer exists is dropped", () => {
    expect(parseDraft(saved({ train: [trainKey, "1>2"] }), NOW, catalog)?.train).toEqual([trainKey]);
  });

  it("rejects nothing stored, broken JSON, a wrong shape or a party out of range", () => {
    expect(parseDraft(null, NOW, catalog)).toBeNull();
    expect(parseDraft("{", NOW, catalog)).toBeNull();
    expect(parseDraft("[]", NOW, catalog)).toBeNull();
    expect(parseDraft(saved({ route: "618,702" }), NOW, catalog)).toBeNull();
    expect(parseDraft(saved({ pax: 0 }), NOW, catalog)).toBeNull();
    expect(parseDraft(saved({ pax: 10 }), NOW, catalog)).toBeNull();
    expect(parseDraft(saved({ pax: 2.5 }), NOW, catalog)).toBeNull();
  });

  it("broken dates fall back to the route's own; a broken form is left out", () => {
    const d = parseDraft(saved({ dates: { depart: "soon" }, form: { travellers: "x" } }), NOW, catalog);
    expect(d?.dates).toEqual(defaultTripDates(route));
    expect(d?.form).toBeNull();
  });

  it("the stored form is cleaned: strings only, the party's rows", () => {
    const d = parseDraft(
      saved({
        pax: 3,
        tickets: {},
        form: { travellers: { contact: { firstName: 5, email: "a@b.co" }, others: [{ firstName: "Avi" }] }, termsAccepted: "yes" },
      }),
      NOW,
      catalog,
    );
    expect(d?.form).toEqual({
      travellers: {
        contact: { firstName: "", lastName: "", phone: "", email: "a@b.co" },
        others: [
          { firstName: "Avi", lastName: "" },
          { firstName: "", lastName: "" },
        ],
      },
      termsAccepted: false,
    });
  });
});

describe("sameRouteIds - the URL wins over a draft for another trip", () => {
  it("the same events, whatever the order", () => {
    expect(sameRouteIds([celine, chelsea], [chelsea, celine])).toBe(true);
    expect(sameRouteIds([celine, chelsea], [celine, ajax])).toBe(false);
    expect(sameRouteIds([celine], [celine, chelsea])).toBe(false);
    expect(sameRouteIds([], [])).toBe(false);
  });

  it("one key for the tab", () => {
    expect(ITINERARY_DRAFT_KEY).toBe("myt:itinerary-draft");
  });
});

describe("draftMayRestore - only a reload or back / forward of the builder itself", () => {
  const BUILD = "/euro-trip/build";
  const at = (path: string) => `http://localhost:3200${path}`;

  it("a refresh of the builder, or the browser's back / forward to it, brings the draft back", () => {
    expect(draftMayRestore({ type: "reload", name: at("/euro-trip/build?events=872,644") }, BUILD)).toBe(true);
    expect(draftMayRestore({ type: "back_forward", name: at("/euro-trip/build?events=872,644") }, BUILD)).toBe(true);
    expect(draftMayRestore({ type: "reload", name: at("/euro-trip/build/") }, BUILD)).toBe(true);
  });

  it("a fresh visit starts clean (a hub card, a link, a typed address)", () => {
    expect(draftMayRestore({ type: "navigate", name: at("/euro-trip/build?events=872,644") }, BUILD)).toBe(false);
    expect(draftMayRestore({ type: "prerender", name: at(BUILD) }, BUILD)).toBe(false);
  });

  it("a reload of ANOTHER page, then a click into the builder, is not a reload of the builder", () => {
    expect(draftMayRestore({ type: "reload", name: at("/euro-trip") }, BUILD)).toBe(false);
  });

  it("the browser does not say: no restore", () => {
    expect(draftMayRestore(null, BUILD)).toBe(false);
    expect(draftMayRestore(undefined, BUILD)).toBe(false);
    expect(draftMayRestore({ type: "reload" }, BUILD)).toBe(false);
    expect(draftMayRestore({ type: "reload", name: "not a url" }, BUILD)).toBe(false);
  });
});
