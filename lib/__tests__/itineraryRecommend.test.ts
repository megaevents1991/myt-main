import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { dayDiff, eventDay, eventKind, eventPoint, haversineKm } from "../itinerary/geo";
import { compatibility, sortRoute } from "../itinerary/rules";
import { recommendRoutes, type RecommendedRoute } from "../itinerary/recommend";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם", city_iata: "AMS" };
const MADRID: City = { latitude: 40.42, longitude: -3.7, name: "מדריד", city_iata: "MAD" };
const MILAN: City = { latitude: 45.46, longitude: 9.19, name: "מילאנו", city_iata: "MIL" };
const BERLIN: City = { latitude: 52.52, longitude: 13.4, name: "ברלין", city_iata: "BER" };
const KRAKOW: City = { latitude: 50.06, longitude: 19.94, name: "קרקוב", city_iata: "KRK" };

const TODAY = "2027-01-01";

/** One available ticket: without it the event reads as sold out and is not eligible. */
const TICKET = {
  id: "t1",
  category: "A",
  price: 100,
  available: true,
  description: "",
  colorOnTheMap: "",
};

/** A partial but ELIGIBLE event: only what the rules and the eligibility read. */
const ev = (
  id: number,
  name: string,
  date: string,
  city: City,
  type = "music_event",
  over: Record<string, unknown> = {},
) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
    tickets_and_rates: [TICKET],
    ...over,
  }) as unknown as Event;

const celine = ev(1, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(2, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const gracie = ev(3, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const realBarca = ev(4, "ריאל - ברסה", "2027-05-09", MADRID, "sports_event");
const arsenal = ev(5, "ארסנל - ליברפול", "2027-05-15", LONDON, "sports_event");
const interLazio = ev(6, "אינטר - לאציו", "2027-05-23", MILAN, "sports_event");
const berlin = ev(7, "קונצרט בברלין", "2027-05-13", BERLIN);
// The same artist on a second night in Paris (trailing space: names are compared trimmed). Next to
// Gracie (1 day, 430 km) and Céline (same city) it would be the best pairing there is - but never twice.
const gracieParis = ev(8, "גרייסי אברמס ", "2027-05-11", PARIS);

const MAIN = [celine, chelsea, gracie, realBarca, arsenal, interLazio, berlin];

const idsOf = (routes: RecommendedRoute[]) => routes.map((r) => r.ids);
const byId = (events: Event[]) => new Map(events.map((e) => [e.id, e]));

/** The brief's score, written out independently of the implementation. */
function expectedScore(events: Event[], ids: number[]): number {
  const route = sortRoute(ids.map((id) => byId(events).get(id) as Event));
  let gaps = 0;
  let km = 0;
  for (let i = 1; i < route.length; i++) {
    gaps += dayDiff(eventDay(route[i - 1]), eventDay(route[i]));
    km += haversineKm(eventPoint(route[i - 1]), eventPoint(route[i]));
  }
  const kinds = new Set(route.map(eventKind));
  return gaps + km / 200 - (kinds.size === 2 ? 2 : 0) - (route.length === 3 ? 1 : 0);
}

/** How many routes of one size each event is in. */
function countsBySize(routes: RecommendedRoute[], size: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of routes.filter((x) => x.ids.length === size)) {
    for (const id of r.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

describe("recommendRoutes", () => {
  const all = recommendRoutes(MAIN, S, TODAY, 48);

  it("builds the Gracie -> Céline -> Chelsea triple, in trip order", () => {
    expect(idsOf(all)).toContainEqual([3, 1, 2]);
  });

  it("never puts Madrid in a route with Paris (and nothing is within 1000 km of it)", () => {
    expect(all.filter((r) => r.ids.includes(4) && r.ids.includes(1))).toEqual([]);
    expect(all.filter((r) => r.ids.includes(4))).toEqual([]);
  });

  it("never puts two events with the same name in one route, names compared trimmed", () => {
    const named = [...MAIN, gracieParis];
    const routes = recommendRoutes(named, S, TODAY, 48);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      const names = r.ids.map((id) => (byId(named).get(id) as Event).name.trim());
      expect(new Set(names).size).toBe(names.length);
    }
    // The rule is what refuses it: next to Gracie, her second night (1 day, 430 km) is a perfect pair.
    expect(compatibility([gracie], gracieParis, S).status).toBe("best");
    expect(
      routes.filter((r) => r.ids.includes(3) && r.ids.includes(8)),
      "Gracie + her own second night",
    ).toEqual([]);
    // ...while the second night still travels with the others.
    expect(routes.some((r) => r.ids.includes(8))).toBe(true);
  });

  it("puts an event in at most 2 pairs and at most 2 triples (counted apart)", () => {
    const pairs = countsBySize(all, 2);
    const triples = countsBySize(all, 3);
    expect(Math.max(...pairs.values())).toBe(2); // the cap is what stopped it, not a short list
    expect(Math.max(...triples.values())).toBeLessThanOrEqual(2);
    expect(triples.size).toBeGreaterThan(0);
  });

  it("returns only addable pairs and triples (best / same / ok), never a warn gap", () => {
    for (const r of all) {
      const route = sortRoute(r.ids.map((id) => byId(MAIN).get(id) as Event));
      expect([2, 3]).toContain(route.length);
      expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 1), route[1], S).status);
      if (route.length === 3) {
        expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 2), route[2], S).status);
      }
    }
  });

  it("does not suggest a long gap (warn) - unless the settings make it an ok one", () => {
    // Chelsea -> Inter is 8 days and 960 km: a "warn" with the default 5 ok days.
    expect(compatibility([chelsea], interLazio, S).status).toBe("warn");
    expect(recommendRoutes([chelsea, interLazio], S, TODAY)).toEqual([]);
    expect(idsOf(recommendRoutes([chelsea, interLazio], { ...S, okGapDays: 10 }, TODAY))).toEqual([[2, 6]]);
  });

  it("does not suggest a pair that is too far apart or too many days apart", () => {
    expect(recommendRoutes([celine, realBarca], S, TODAY)).toEqual([]); // Paris - Madrid, 1054 km
    expect(recommendRoutes([celine, interLazio], S, TODAY)).toEqual([]); // 11 days
    expect(recommendRoutes([chelsea, arsenal], S, TODAY)).toEqual([]); // the same day
  });

  it("scores a route as day gaps + km / 200 - 2 (both kinds) - 1 (three events)", () => {
    for (const r of all) expect(r.score).toBeCloseTo(expectedScore(MAIN, r.ids), 2);
  });

  it("lists the best (lowest score) first", () => {
    for (let i = 1; i < all.length; i++) expect(all[i].score).toBeGreaterThanOrEqual(all[i - 1].score);
  });

  it("with only Gracie, Céline and Chelsea, returns their three pairs and the triple", () => {
    const three = [gracie, celine, chelsea];
    const routes = recommendRoutes(three, S, TODAY);
    // A pair's events each sit in 2 pairs, and in the 1 triple: the cap counts them apart.
    expect(idsOf(routes)).toEqual(expect.arrayContaining([[3, 1], [1, 2], [3, 2], [3, 1, 2]]));
    expect(routes).toHaveLength(4);
    const triple = routes.find((r) => r.ids.length === 3) as RecommendedRoute;
    // Amsterdam -> Paris -> London, 2 + 3 days, both kinds present, three events.
    const km = haversineKm(eventPoint(gracie), eventPoint(celine)) + haversineKm(eventPoint(celine), eventPoint(chelsea));
    expect(triple.score).toBeCloseTo(5 + km / 200 - 2 - 1, 2);
  });

  it("keeps a triple reachable from two different pairs once", () => {
    const routes = recommendRoutes([gracie, celine, chelsea], S, TODAY);
    expect(routes.filter((r) => r.ids.length === 3)).toHaveLength(1);
  });

  it("returns at most `limit` routes, defaulting to maxAutoRoutes", () => {
    expect(recommendRoutes(MAIN, S, TODAY, 3)).toHaveLength(3);
    expect(recommendRoutes(MAIN, S, TODAY, 3)).toEqual(all.slice(0, 3));
    expect(recommendRoutes(MAIN, { ...S, maxAutoRoutes: 2 }, TODAY)).toHaveLength(2);
    expect(recommendRoutes(MAIN, S, TODAY, 0)).toEqual([]);
    expect(recommendRoutes(MAIN, S, TODAY).length).toBeLessThanOrEqual(S.maxAutoRoutes);
  });

  it("is deterministic: the same input gives the same list, whatever order it arrives in", () => {
    expect(recommendRoutes(MAIN, S, TODAY, 48)).toEqual(all);
    expect(recommendRoutes([...MAIN].reverse(), S, TODAY, 48)).toEqual(all);
    expect(recommendRoutes([...MAIN].sort((a, b) => a.name.localeCompare(b.name)), S, TODAY, 48)).toEqual(all);
  });

  it("leaves out events that are not eligible", () => {
    const soldOut = ev(20, "סולד אאוט בפריז", "2027-05-11", PARIS, "music_event", {
      tickets_and_rates: [{ ...TICKET, available: false }],
    });
    const ticketOnly = ev(21, "כרטיס בלבד בפריז", "2027-05-11", PARIS, "music_event", { package_mode: "ticket_only" });
    const us = ev(22, "קונצרט בניו יורק", "2027-05-11", PARIS, "music_event", {
      location: { ...PARIS, country_code: "US" },
    });
    const routes = recommendRoutes([...MAIN, soldOut, ticketOnly, us], S, TODAY, 48);
    expect(routes).toEqual(all);
    for (const id of [20, 21, 22]) expect(routes.some((r) => r.ids.includes(id))).toBe(false);
  });

  it("leaves out events closer than the 3-day sell window to `todayIso`", () => {
    // Today 2027-05-09: Madrid (05-09) and Gracie (05-10) are too soon; Céline (05-12) is exactly 3 days off.
    const routes = recommendRoutes(MAIN, S, "2027-05-09", 48);
    for (const id of [3, 4]) expect(routes.some((r) => r.ids.includes(id))).toBe(false);
    expect(idsOf(routes)).toContainEqual([1, 2]);
  });

  it("builds no triples when the trip holds two events", () => {
    const routes = recommendRoutes(MAIN, { ...S, maxEvents: 2 }, TODAY, 48);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.ids.length === 2)).toBe(true);
  });

  it("returns nothing for fewer than two eligible events", () => {
    expect(recommendRoutes([], S, TODAY)).toEqual([]);
    expect(recommendRoutes([celine], S, TODAY)).toEqual([]);
  });

  it("does not modify its input", () => {
    const input = [...MAIN].reverse();
    const before = input.map((e) => e.id);
    recommendRoutes(input, S, TODAY, 48);
    expect(input.map((e) => e.id)).toEqual(before);
  });
});

describe("recommendRoutes on a larger catalog", () => {
  // A deterministic spread: 60 events over the cities, two months, a few repeated names.
  const CITIES = [PARIS, LONDON, AMSTERDAM, MADRID, MILAN, BERLIN, KRAKOW];
  const events: Event[] = Array.from({ length: 60 }, (_, i) => {
    const day = 1 + ((i * 3) % 50); // 1..50 -> May 1 .. Jun 19, three days apart in a run
    const date = new Date(Date.UTC(2027, 4, day)).toISOString().slice(0, 10);
    return ev(
      100 + i,
      `אירוע ${i % 45}`, // ids 145.. repeat the names of 100..
      date,
      CITIES[(i * 3) % CITIES.length],
      i % 2 ? "sports_event" : "music_event",
    );
  });
  const routes = recommendRoutes(events, S, TODAY, 48);

  it("keeps every promise at once", () => {
    expect(routes.length).toBeGreaterThan(12);
    expect(routes.length).toBeLessThanOrEqual(48);

    for (const size of [2, 3]) {
      for (const n of countsBySize(routes, size).values()) expect(n).toBeLessThanOrEqual(2);
    }

    const sets = routes.map((r) => [...r.ids].sort((a, b) => a - b).join(","));
    expect(new Set(sets).size).toBe(sets.length);

    const lookup = byId(events);
    for (const r of routes) {
      const route = sortRoute(r.ids.map((id) => lookup.get(id) as Event));
      expect(r.ids).toEqual(route.map((e) => e.id));
      const names = route.map((e) => e.name.trim());
      expect(new Set(names).size).toBe(names.length);
      expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 1), route[1], S).status);
      if (route.length === 3) {
        expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 2), route[2], S).status);
      }
      expect(r.score).toBeCloseTo(expectedScore(events, r.ids), 2);
    }
  });

  it("is deterministic", () => {
    expect(recommendRoutes([...events].reverse(), S, TODAY, 48)).toEqual(routes);
  });
});
